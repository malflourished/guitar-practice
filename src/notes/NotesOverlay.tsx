import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { describeTarget, pickTarget, targetSummary } from './describeTarget';
import { addPoint, anchorOf, boundsOf, placeBeside, strokePath } from './marks';
import type { Box, Note, NoteTarget, Point, Sheet, SheetContext } from './noteTypes';
import { notesAreFiles, notesBridge } from './notesStore';
import { collectSettings, countOpen, notesMarkdown, sheetId, sheetTitle } from './sheets';
import './Notes.css';

/** The note being written: marks and words, not yet saved. */
interface Draft {
  id: number;
  kind: Note['kind'];
  at: { x: number; y: number };
  /** The outline of the thing a pin is on. */
  box: Box | null;
  target: NoteTarget | null;
  strokes: Point[][];
  text: string;
}

/** A press that moves less than this is a click (a pin), not a stroke. */
const DRAW_AFTER_PX = 5;
const COMPOSER = { width: 300, height: 172 };

let draftIds = 0;

const hasContent = (draft: Draft) => draft.text.trim() !== '' || draft.strokes.length > 0;

const isChrome = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[data-notes-chrome]') !== null;

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(count);
  });

function readContext(): SheetContext {
  let settings: Record<string, unknown> = {};
  try {
    settings = collectSettings(localStorage);
  } catch {
    // no storage: the screenshot still says where we are
  }
  const themeRoot = document.querySelector('.themeRoot');
  const savedMode = settings['vibrato:study-mode'];
  const onHome = document.querySelector('[data-frame]')?.getAttribute('data-home') === 'true';
  return {
    mode: onHome ? 'home' : typeof savedMode === 'string' ? savedMode : 'app',
    theme: [
      themeRoot?.getAttribute('data-ui-theme'),
      themeRoot?.getAttribute('data-vibrato-canvas'),
    ]
      .filter(Boolean)
      .join(' '),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    settings,
  };
}

/** One note's marks: the outline of a pinned thing, the pen strokes, and its number. */
function NoteInk({ note }: { note: Pick<Note, 'n' | 'kind' | 'at' | 'box' | 'strokes'> }) {
  const pinBox = note.kind === 'pin' ? note.box : null;
  const start = note.strokes[0]?.[0];
  const badge = pinBox
    ? { x: pinBox.x - 3, y: pinBox.y - 3 }
    : start && note.kind === 'marks'
      ? { x: start[0], y: start[1] }
      : note.at;
  const x = Math.max(12, Math.min(window.innerWidth - 12, badge.x));
  const y = Math.max(12, Math.min(window.innerHeight - 12, badge.y));
  return (
    <g>
      {pinBox && (
        <rect
          className="notes-box"
          x={pinBox.x - 3}
          y={pinBox.y - 3}
          width={pinBox.width + 6}
          height={pinBox.height + 6}
          rx={6}
        />
      )}
      {note.strokes.map((points, index) => {
        const d = strokePath(points);
        return (
          <g key={index}>
            <path className="notes-halo" d={d} />
            <path className="notes-stroke" d={d} />
          </g>
        );
      })}
      <g className="notes-badge" transform={`translate(${x} ${y})`}>
        <circle r={10} />
        <text dy="0.36em">{note.n}</text>
      </g>
    </g>
  );
}

/**
 * Notes mode: a sheet laid over the whole window. The app underneath still
 * runs but cannot be clicked. Click a thing to pin a note on it, drag to
 * draw; every stroke joins the note being written until it is saved.
 */
export default function NotesOverlay({ onClose }: { onClose: () => void }) {
  const bridge = useMemo(() => notesBridge(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  /** This visit's sheet: made with the first note. */
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** The stroke under the pen. */
  const [live, setLive] = useState<Point[] | null>(null);
  const [hover, setHover] = useState<{ box: Box; label: string } | null>(null);
  /** The window is being photographed: everything but the marks steps out. */
  const [capturing, setCapturing] = useState(false);
  const [saved, setSaved] = useState<Sheet[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [where, setWhere] = useState('');
  const [barOffset, setBarOffset] = useState({ x: 0, y: 0 });
  const gesture = useRef<{ pointer: number; points: Point[]; drawing: boolean } | null>(null);
  const barDrag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const hoverFrame = useRef(0);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const leaving = useRef(false);

  useEffect(() => {
    let alive = true;
    // A focused button in the app would still answer Enter and Space.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    void bridge.list().then((sheets) => alive && setSaved(sheets));
    void bridge.where().then((place) => alive && setWhere(place));
    return () => {
      alive = false;
      cancelAnimationFrame(hoverFrame.current);
    };
  }, [bridge]);

  const draftId = draft?.id;
  useEffect(() => {
    if (draftId !== undefined) textRef.current?.focus();
  }, [draftId]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 1800);
    return () => window.clearTimeout(timer);
  }, [message]);

  /** The thing in the app under a point, looking through this layer. */
  const thingAt = (x: number, y: number): { target: NoteTarget; box: Box } | null => {
    const root = rootRef.current;
    const element = document
      .elementsFromPoint(x, y)
      .find((candidate) => !root?.contains(candidate));
    if (!element || element === document.documentElement || element === document.body) return null;
    if (element.id === 'root') return null;
    const picked = pickTarget(element);
    const rect = picked.getBoundingClientRect();
    // Something as big as the window is not a thing to point at.
    if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.9) return null;
    return {
      target: describeTarget(picked),
      box: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };

  const persist = (next: Sheet): Promise<void> => {
    const run = async () => {
      flushSync(() => setCapturing(true));
      await frames(2);
      try {
        const result = await bridge.save(next);
        setSaved(result.sheets);
        setMessage('Saved');
      } catch {
        setMessage('That note could not be saved');
      }
      setCapturing(false);
    };
    saving.current = saving.current.then(run, run);
    return saving.current;
  };

  const commit = (finished: Draft): Promise<void> => {
    const base: Sheet = sheet ?? {
      id: sheetId(new Date(), readContext().mode),
      createdAt: new Date().toISOString(),
      context: readContext(),
      screenshot: null,
      notes: [],
    };
    const note: Note = {
      n: (base.notes[base.notes.length - 1]?.n ?? 0) + 1,
      text: finished.text.trim(),
      status: 'open',
      kind: finished.kind,
      at: finished.at,
      box: finished.kind === 'pin' ? finished.box : boundsOf(finished.strokes),
      target: finished.target,
      strokes: finished.strokes,
    };
    const next = { ...base, notes: [...base.notes, note] };
    setSheet(next);
    return persist(next);
  };

  const saveDraft = () => {
    if (!draft || !hasContent(draft)) return;
    setDraft(null);
    void commit(draft);
  };

  /** Leave Notes mode, keeping whatever was being written. */
  const finish = async () => {
    if (leaving.current) return;
    leaving.current = true;
    setListOpen(false);
    if (draft && hasContent(draft)) {
      setDraft(null);
      await commit(draft);
    } else {
      await saving.current;
    }
    onClose();
  };

  const pinAt = (x: number, y: number) => {
    const thing = thingAt(x, y);
    if (draft && hasContent(draft)) void commit(draft);
    draftIds += 1;
    setDraft({
      id: draftIds,
      kind: 'pin',
      at: { x: Math.round(x), y: Math.round(y) },
      box: thing?.box ?? null,
      target: thing?.target ?? null,
      strokes: [],
      text: '',
    });
  };

  const addStroke = (points: Point[]) => {
    if (draft) {
      setDraft({ ...draft, strokes: [...draft.strokes, points] });
      return;
    }
    const at = anchorOf(points);
    draftIds += 1;
    setDraft({
      id: draftIds,
      kind: 'marks',
      at,
      box: null,
      target: thingAt(at.x, at.y)?.target ?? null,
      strokes: [points],
      text: '',
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // The app's open menus close on a press outside them: this is not one.
    event.stopPropagation();
    if (event.button !== 0 || isChrome(event.target)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      pointer: event.pointerId,
      points: [[Math.round(event.clientX), Math.round(event.clientY)]],
      drawing: false,
    };
    setHover(null);
    setListOpen(false);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { clientX: x, clientY: y } = event;
    const current = gesture.current;
    if (current && current.pointer === event.pointerId) {
      const [startX, startY] = current.points[0];
      if (!current.drawing && Math.hypot(x - startX, y - startY) < DRAW_AFTER_PX) return;
      current.drawing = true;
      current.points = addPoint(current.points, x, y);
      setLive(current.points);
      return;
    }
    cancelAnimationFrame(hoverFrame.current);
    if (event.buttons !== 0 || isChrome(event.target)) {
      setHover(null);
      return;
    }
    hoverFrame.current = requestAnimationFrame(() => {
      const thing = thingAt(x, y);
      const label = thing ? targetSummary(thing.target) : '';
      setHover((previous) => {
        if (!thing) return null;
        const same =
          previous &&
          previous.label === label &&
          previous.box.x === thing.box.x &&
          previous.box.y === thing.box.y &&
          previous.box.width === thing.box.width &&
          previous.box.height === thing.box.height;
        return same ? previous : { box: thing.box, label };
      });
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    gesture.current = null;
    setLive(null);
    if (current.drawing && current.points.length > 1) addStroke(current.points);
    else pinAt(event.clientX, event.clientY);
  };

  const onPointerCancel = () => {
    gesture.current = null;
    setLive(null);
  };

  // Keys: while the sheet is up, none of them reach the app underneath.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return; // the system's own shortcuts
      const typing = event.target === textRef.current;
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (listOpen) setListOpen(false);
        else if (draft) setDraft(null);
        else void finish();
      } else if (typing) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          saveDraft();
        }
      } else if ((event.code === 'KeyN' || event.key.toLowerCase() === 'n') && !event.repeat && !event.altKey) {
        event.preventDefault();
        void finish();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  const removeNote = (id: string, n: number) => {
    void bridge.remove(id, n).then(setSaved);
    if (sheet?.id === id) {
      setSheet({ ...sheet, notes: sheet.notes.filter((note) => note.n !== n) });
    }
  };

  const copyAll = () => {
    void navigator.clipboard
      .writeText(notesMarkdown(saved))
      .then(() => setMessage('Copied'), () => setMessage('Could not copy'));
  };

  const onGripDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    barDrag.current = {
      pointer: event.pointerId,
      x: event.clientX - barOffset.x,
      y: event.clientY - barOffset.y,
    };
  };
  const onGripMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = barDrag.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    setBarOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y });
  };
  const onGripUp = () => {
    barDrag.current = null;
  };

  const nextNumber = (sheet?.notes[sheet.notes.length - 1]?.n ?? 0) + 1;
  const draftBox: Box | null = draft
    ? // Beside the first mark, so the words stay put while more marks are drawn.
      ((draft.kind === 'marks' ? boundsOf(draft.strokes.slice(0, 1)) : draft.box) ?? {
        x: draft.at.x,
        y: draft.at.y,
        width: 0,
        height: 0,
      })
    : null;
  const composerAt = draftBox
    ? placeBeside(draftBox, COMPOSER, { width: window.innerWidth, height: window.innerHeight })
    : null;
  const open = countOpen(saved);
  const listBelow = barOffset.y < -window.innerHeight / 2;

  return (
    <div
      ref={rootRef}
      className="notes-root"
      data-capturing={capturing ? 'true' : undefined}
      data-drawing={live ? 'true' : undefined}
      role="dialog"
      aria-label="Notes"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => setHover(null)}
      // Keeps the words' focus while drawing more marks for the same note.
      onMouseDown={(event) => {
        if (!isChrome(event.target)) event.preventDefault();
      }}
    >
      <div className="notes-frame notes-chrome" aria-hidden="true" />

      {hover && !live && (
        <div
          className="notes-hover notes-chrome"
          aria-hidden="true"
          data-low={hover.box.y < 28 ? 'true' : undefined}
          style={{
            left: hover.box.x - 3,
            top: hover.box.y - 3,
            width: hover.box.width + 6,
            height: hover.box.height + 6,
          }}
        >
          <span>{hover.label}</span>
        </div>
      )}

      <svg className="notes-ink" aria-hidden="true">
        {sheet?.notes.map((note) => <NoteInk key={note.n} note={note} />)}
        {draft && (
          <g className="notes-draft">
            <NoteInk note={{ ...draft, n: nextNumber }} />
          </g>
        )}
        {live && (
          <g className="notes-draft">
            <path className="notes-halo" d={strokePath(live)} />
            <path className="notes-stroke" d={strokePath(live)} />
          </g>
        )}
      </svg>

      {draft && composerAt && (
        <div
          className="notes-composer notes-panel notes-chrome"
          data-notes-chrome=""
          style={{ left: composerAt.left, top: composerAt.top, width: COMPOSER.width }}
        >
          <div className="notes-composer-head">
            <b>{nextNumber}</b>
            <span title={targetSummary(draft.target)}>{targetSummary(draft.target)}</span>
          </div>
          <textarea
            ref={textRef}
            rows={3}
            value={draft.text}
            placeholder="What about this?"
            aria-label="Your note"
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          />
          <div className="notes-composer-foot">
            <span>Enter saves · Esc discards</span>
            <button type="button" disabled={!hasContent(draft)} onClick={saveDraft}>
              Save
            </button>
          </div>
        </div>
      )}

      <div
        className="notes-bar notes-panel notes-chrome"
        data-notes-chrome=""
        style={{ transform: `translate(calc(-50% + ${barOffset.x}px), ${barOffset.y}px)` }}
      >
        <span
          className="notes-grip"
          title="Drag to move this bar out of the way"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
        >
          Notes
        </span>
        <span className="notes-hint" role="status">
          {message ?? 'Click a thing to comment on it · drag to draw'}
        </span>
        <button
          type="button"
          aria-expanded={listOpen}
          onClick={() => setListOpen((current) => !current)}
        >
          {open} open
        </button>
        <button type="button" className="notes-done" onClick={() => void finish()}>
          Done
        </button>

        {listOpen && (
          <div className="notes-list notes-panel" data-below={listBelow ? 'true' : undefined}>
            {saved.length === 0 ? (
              <p className="notes-empty">
                Nothing yet. Click something on screen, or draw around it, and say what you think.
              </p>
            ) : (
              saved.map((entry) => (
                <section key={entry.id}>
                  <h3>{sheetTitle(entry)}</h3>
                  <ul>
                    {entry.notes.map((note) => (
                      <li key={note.n} data-status={note.status}>
                        <b>{note.status === 'done' ? '✓' : note.n}</b>
                        <div>
                          <p>{note.text || 'A mark with no words'}</p>
                          <small>{targetSummary(note.target)}</small>
                          {note.reply && <small className="notes-reply">↳ {note.reply}</small>}
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete note ${note.n}`}
                          title="Delete this note"
                          onClick={() => removeNote(entry.id, note.n)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
            <footer>
              <span title={where}>
                {notesAreFiles()
                  ? `Saved with a screenshot in ${where.replace(/^\/Users\/[^/]+/, '~')}`
                  : 'Saved in this browser, without screenshots'}
              </span>
              {bridge.reveal ? (
                <button type="button" onClick={() => void bridge.reveal?.()}>
                  Show folder
                </button>
              ) : (
                <button type="button" disabled={saved.length === 0} onClick={copyAll}>
                  Copy all
                </button>
              )}
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
