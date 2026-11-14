import { useMemo } from 'react';
import {
  CHORD_QUALITIES,
  CHORD_VOICINGS,
  TRIAD_STRING_SET_IDS,
  buildChordPositionViews,
  showsTriads,
  type ChordVoicing,
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
  // Full CAGED shapes, or small triads on one set of three strings.
  const [chordVoicing, setChordVoicing] = usePersistentState<ChordVoicing>(
    'chord-voicing',
    'shapes',
    oneOf(CHORD_VOICINGS),
  );
  const [triadStrings, setTriadStrings] = usePersistentState<string>(
    'triad-strings',
    TRIAD_STRING_SET_IDS[0],
    oneOf(TRIAD_STRING_SET_IDS),
  );
  return {
    chordQuality,
    setChordQuality,
    chordVoicing,
    setChordVoicing,
    triadStrings,
    setTriadStrings,
    /** Triads were chosen and this chord has them (a seventh chord shows its shapes). */
    triadsShown: showsTriads(chordQuality, chordVoicing),
  };
}

export type ChordsState = ReturnType<typeof useChordsState>;

/** The chord's shapes up the neck, for the side panel's Positions strip. */
export function useChordPositionViews(
  studyMode: StudyMode,
  rootNote: NoteName,
  chords: Pick<ChordsState, 'chordQuality' | 'chordVoicing' | 'triadStrings'>,
  notation: NotationPreference,
) {
  const { chordQuality, chordVoicing, triadStrings } = chords;
  return useMemo(() => {
    if (studyMode !== 'chords') return [];
    return buildChordPositionViews(rootNote, chordQuality, notation, chordVoicing, triadStrings);
  }, [studyMode, rootNote, chordQuality, notation, chordVoicing, triadStrings]);
}
