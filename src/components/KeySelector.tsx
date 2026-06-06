import { useCallback, useRef, useState } from 'react';
import type { NoteName } from '../types/music';
import { ALL_NOTES } from '../lib/colors';
import {
  ENHARMONIC_FLAT,
  formatNoteDisplay,
  isAccidental,
  type NotationPreference,
} from '../lib/music';
import { NotationToggle } from './NotationToggle';
import glass from '../styles/glass.module.css';
import styles from './KeySelector.module.css';

export type KeyApplyAction = 'select' | 'deselect' | 'set';

interface KeySelectorProps {
  activeNotes: Set<NoteName>;
  notation: NotationPreference;
  singleRootMode: boolean;
  onApplyKey: (note: NoteName, action: KeyApplyAction) => void;
  onNotationChange: (notation: NotationPreference) => void;
}

interface DragState {
  action: KeyApplyAction;
  visited: Set<NoteName>;
}

function noteFromPointer(clientX: number, clientY: number): NoteName | null {
  const target = document.elementFromPoint(clientX, clientY);
  const button = target?.closest<HTMLElement>('[data-note-key]');
  const note = button?.dataset.noteKey;
  if (!note || !ALL_NOTES.includes(note as NoteName)) return null;
  return note as NoteName;
}

export function KeySelector({
  activeNotes,
  notation,
  singleRootMode,
  onApplyKey,
  onNotationChange,
}: KeySelectorProps) {
  const keysRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyToNote = useCallback(
    (note: NoteName) => {
      const drag = dragRef.current;
      if (!drag || drag.visited.has(note)) return;

      drag.visited.add(note);
      onApplyKey(note, drag.action);
    },
    [onApplyKey],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    note: NoteName,
  ) => {
    if (event.button !== 0) return;

    const action: KeyApplyAction = singleRootMode
      ? 'set'
      : activeNotes.has(note)
        ? 'deselect'
        : 'select';

    dragRef.current = { action, visited: new Set() };
    setIsDragging(true);
    keysRef.current?.setPointerCapture(event.pointerId);
    applyToNote(note);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const note = noteFromPointer(event.clientX, event.clientY);
    if (note) applyToNote(note);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    if (keysRef.current?.hasPointerCapture(event.pointerId)) {
      keysRef.current.releasePointerCapture(event.pointerId);
    }
    endDrag();
  };

  const handlePointerCancel = () => {
    endDrag();
  };

  return (
    <div className={styles.strip}>
      <div
        ref={keysRef}
        className={`${styles.keys} ${isDragging ? styles.dragging : ''}`}
        role="group"
        aria-label="Select key"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {ALL_NOTES.map((note) => {
          const isActive = activeNotes.has(note);
          const label = formatNoteDisplay(note, notation);
          const altName = ENHARMONIC_FLAT[note];
          const accidental = isAccidental(note);

          let className = accidental ? glass.keyTileAccidental : glass.keyTile;
          if (isActive) {
            className = accidental
              ? glass.keyTileAccidentalActive
              : glass.keyTileActive;
          }

          return (
            <button
              key={note}
              type="button"
              className={className}
              data-note-key={note}
              onPointerDown={(event) => handlePointerDown(event, note)}
              aria-pressed={isActive}
              title={
                altName
                  ? `${formatNoteDisplay(note, 'sharps')} = ${formatNoteDisplay(note, 'flats')}`
                  : note
              }
            >
              {label}
            </button>
          );
        })}
        <NotationToggle notation={notation} onChange={onNotationChange} />
      </div>
      {!singleRootMode && (
        <span className={styles.hint}>Multi-select in Notes mode</span>
      )}
    </div>
  );
}
