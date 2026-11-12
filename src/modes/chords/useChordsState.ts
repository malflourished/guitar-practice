import { useMemo } from 'react';
import {
  CHORD_QUALITIES,
  buildChordPositionViews,
  type NotationPreference,
} from '../../lib/music';
import { oneOf, usePersistentState } from '../../hooks/usePersistentState';
import type { ChordQuality, NoteName, StudyMode } from '../../types/music';

export function useChordsState() {
  const [chordQuality, setChordQuality] = usePersistentState<ChordQuality>(
    'chord-quality',
    'major',
    oneOf(CHORD_QUALITIES),
  );
  return { chordQuality, setChordQuality };
}

export type ChordsState = ReturnType<typeof useChordsState>;

/** The chord's shapes up the neck, for the side panel's Positions strip. */
export function useChordPositionViews(
  studyMode: StudyMode,
  rootNote: NoteName,
  chordQuality: ChordQuality,
  notation: NotationPreference,
) {
  return useMemo(() => {
    if (studyMode !== 'chords') return [];
    return buildChordPositionViews(rootNote, chordQuality, notation);
  }, [studyMode, rootNote, chordQuality, notation]);
}
