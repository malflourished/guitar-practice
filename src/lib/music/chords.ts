import type { ChordQuality } from '../../types/music';

interface ChordDef {
  label: string;
  /** Semitone intervals from the root (compound for 9/11/13). */
  intervals: number[];
  /** Letters above the root for each tone (for key-aware spelling). */
  letterSteps: number[];
}

/**
 * Tertian chords (triads / 7ths / extensions) stack thirds, so each tone takes
 * every other letter: [0, 2, 4, 6, 8(9th), 10(11th), 12(13th)]. Sixth chords add
 * the 6th (letter +5); suspended chords replace the third with the 2nd or 4th.
 *
 * Extensions use the conventional chord-tone sets: 11th chords keep the 3rd in
 * the spelling, and 13th chords omit the 11th (standard practice).
 */
export const CHORD_DEFS: Record<ChordQuality, ChordDef> = {
  major: { label: 'Major', intervals: [0, 4, 7], letterSteps: [0, 2, 4] },
  minor: { label: 'Minor', intervals: [0, 3, 7], letterSteps: [0, 2, 4] },
  dim: { label: 'Diminished', intervals: [0, 3, 6], letterSteps: [0, 2, 4] },
  aug: { label: 'Augmented', intervals: [0, 4, 8], letterSteps: [0, 2, 4] },
  sus2: { label: 'Sus2', intervals: [0, 2, 7], letterSteps: [0, 1, 4] },
  sus4: { label: 'Sus4', intervals: [0, 5, 7], letterSteps: [0, 3, 4] },
  maj6: { label: 'Major 6', intervals: [0, 4, 7, 9], letterSteps: [0, 2, 4, 5] },
  min6: { label: 'Minor 6', intervals: [0, 3, 7, 9], letterSteps: [0, 2, 4, 5] },
  maj7: { label: 'Major 7', intervals: [0, 4, 7, 11], letterSteps: [0, 2, 4, 6] },
  dom7: { label: 'Dominant 7', intervals: [0, 4, 7, 10], letterSteps: [0, 2, 4, 6] },
  min7: { label: 'Minor 7', intervals: [0, 3, 7, 10], letterSteps: [0, 2, 4, 6] },
  m7b5: { label: 'Minor 7♭5', intervals: [0, 3, 6, 10], letterSteps: [0, 2, 4, 6] },
  dim7: { label: 'Diminished 7', intervals: [0, 3, 6, 9], letterSteps: [0, 2, 4, 6] },
  dom9: { label: 'Dominant 9', intervals: [0, 4, 7, 10, 14], letterSteps: [0, 2, 4, 6, 8] },
  maj9: { label: 'Major 9', intervals: [0, 4, 7, 11, 14], letterSteps: [0, 2, 4, 6, 8] },
  min9: { label: 'Minor 9', intervals: [0, 3, 7, 10, 14], letterSteps: [0, 2, 4, 6, 8] },
  dom11: {
    label: 'Dominant 11',
    intervals: [0, 4, 7, 10, 14, 17],
    letterSteps: [0, 2, 4, 6, 8, 10],
  },
  min11: {
    label: 'Minor 11',
    intervals: [0, 3, 7, 10, 14, 17],
    letterSteps: [0, 2, 4, 6, 8, 10],
  },
  dom13: {
    label: 'Dominant 13',
    intervals: [0, 4, 7, 10, 14, 21],
    letterSteps: [0, 2, 4, 6, 8, 12],
  },
  maj13: {
    label: 'Major 13',
    intervals: [0, 4, 7, 11, 14, 21],
    letterSteps: [0, 2, 4, 6, 8, 12],
  },
  min13: {
    label: 'Minor 13',
    intervals: [0, 3, 7, 10, 14, 21],
    letterSteps: [0, 2, 4, 6, 8, 12],
  },
};

export const CHORD_QUALITIES = Object.keys(CHORD_DEFS) as ChordQuality[];

/** Grouped for the chord-type dropdown. */
export const CHORD_QUALITY_GROUPS: { label: string; qualities: ChordQuality[] }[] = [
  { label: 'Triads', qualities: ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4'] },
  { label: 'Sixths', qualities: ['maj6', 'min6'] },
  { label: 'Sevenths', qualities: ['maj7', 'dom7', 'min7', 'm7b5', 'dim7'] },
  {
    label: 'Extended',
    qualities: ['dom9', 'maj9', 'min9', 'dom11', 'min11', 'dom13', 'maj13', 'min13'],
  },
];

export function getChordIntervals(quality: ChordQuality): number[] {
  return CHORD_DEFS[quality].intervals;
}

export function getChordLetterSteps(quality: ChordQuality): number[] {
  return CHORD_DEFS[quality].letterSteps;
}

export function getChordQualityLabel(quality: ChordQuality): string {
  return CHORD_DEFS[quality].label;
}
