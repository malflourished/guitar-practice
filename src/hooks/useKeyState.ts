import { useEffect, useMemo } from 'react';
import { ALL_NOTES } from '../lib/colors';
import { getRootNote } from '../lib/displayTitle';
import type { NotationPreference } from '../lib/music';
import type { KeyMode, NoteName, StudyMode } from '../types/music';
import { isSingleRootMode } from '../modes/studyModes';
import { oneOf, usePersistentState } from './usePersistentState';

const isNoteArray = (value: unknown): value is NoteName[] =>
  Array.isArray(value) &&
  value.every(
    (note) => typeof note === 'string' && (ALL_NOTES as string[]).includes(note),
  );

export type NoteSetUpdater =
  | Set<NoteName>
  | ((prev: Set<NoteName>) => Set<NoteName>);

/**
 * The key the player is in: the selected notes, the key center, major or
 * minor, and sharps or flats. Every mode reads this.
 */
export function useKeyState(studyMode: StudyMode) {
  const [activeNoteList, setActiveNoteList] = usePersistentState<NoteName[]>(
    'active-notes',
    ['C'],
    isNoteArray,
  );
  const activeNotes = useMemo(() => new Set(activeNoteList), [activeNoteList]);
  const setActiveNotes = (updater: NoteSetUpdater) => {
    setActiveNoteList((prevList) => {
      const next =
        typeof updater === 'function' ? updater(new Set(prevList)) : updater;
      return ALL_NOTES.filter((note) => next.has(note));
    });
  };
  const [notation, setNotation] = usePersistentState<NotationPreference>(
    'notation',
    'sharps',
    oneOf(['sharps', 'flats'] as const),
  );
  const [keyMode, setKeyMode] = usePersistentState<KeyMode>(
    'key-mode',
    'major',
    oneOf(['major', 'minor'] as const),
  );
  // The key center is the app's tonal home. It only moves on explicit key
  // changes (Key row, theory wheel, relative-key link) — never while browsing
  // chords inside the key — so the ambient background stays put.
  const [keyCenter, setKeyCenter] = usePersistentState<NoteName>(
    'key-center',
    'C',
    oneOf(ALL_NOTES),
  );

  const rootNote = useMemo(() => getRootNote(activeNotes), [activeNotes]);

  // One-time alignment: older sessions persisted a root but no key center.
  useEffect(() => {
    if (isSingleRootMode(studyMode) && rootNote !== keyCenter) {
      setKeyCenter(rootNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const applyKey = (note: NoteName, action: 'select' | 'deselect' | 'set') => {
    if (action === 'set') {
      setActiveNotes(new Set([note]));
      setKeyCenter(note);
      return;
    }

    setActiveNotes((prev) => {
      const next = new Set(prev);
      if (action === 'select') {
        next.add(note);
      } else {
        next.delete(note);
      }
      return next;
    });
  };

  return {
    activeNotes,
    setActiveNotes,
    notation,
    setNotation,
    keyMode,
    setKeyMode,
    keyCenter,
    setKeyCenter,
    rootNote,
    applyKey,
  };
}

export type KeyState = ReturnType<typeof useKeyState>;
