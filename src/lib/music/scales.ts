import type { ScaleQuality } from '../../types/music';

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
export const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
export const MINOR_PENTATONIC = [0, 3, 5, 7, 10];

interface ScaleDef {
  label: string;
  /** Semitone intervals from the root. */
  intervals: number[];
  /** Letters above the root for each tone (for key-aware spelling). */
  letterSteps: number[];
}

const DIATONIC_STEPS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Scale definitions. 7-note scales advance one letter per degree. Pentatonics
 * skip degrees; blues scales include a chromatic "blue note" that reuses a
 * letter (e.g. minor blues has both G♭ and G), which the letter steps capture.
 */
export const SCALE_DEFS: Record<ScaleQuality, ScaleDef> = {
  major: { label: 'Major', intervals: MAJOR_SCALE, letterSteps: DIATONIC_STEPS },
  minor: { label: 'Minor', intervals: NATURAL_MINOR, letterSteps: DIATONIC_STEPS },
  dorian: {
    label: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    letterSteps: DIATONIC_STEPS,
  },
  phrygian: {
    label: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    letterSteps: DIATONIC_STEPS,
  },
  lydian: {
    label: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    letterSteps: DIATONIC_STEPS,
  },
  mixolydian: {
    label: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    letterSteps: DIATONIC_STEPS,
  },
  locrian: {
    label: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    letterSteps: DIATONIC_STEPS,
  },
  harmonicMinor: {
    label: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    letterSteps: DIATONIC_STEPS,
  },
  melodicMinor: {
    label: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    letterSteps: DIATONIC_STEPS,
  },
  majorPentatonic: {
    label: 'Major Pentatonic',
    intervals: MAJOR_PENTATONIC,
    letterSteps: [0, 1, 2, 4, 5],
  },
  minorPentatonic: {
    label: 'Minor Pentatonic',
    intervals: MINOR_PENTATONIC,
    letterSteps: [0, 2, 3, 4, 6],
  },
  majorBlues: {
    label: 'Major Blues',
    intervals: [0, 2, 3, 4, 7, 9],
    letterSteps: [0, 1, 2, 2, 4, 5],
  },
  minorBlues: {
    label: 'Minor Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    letterSteps: [0, 2, 3, 4, 4, 6],
  },
};

export const SCALE_QUALITIES = Object.keys(SCALE_DEFS) as ScaleQuality[];

/** Grouped for the scale-type dropdown. */
export const SCALE_QUALITY_GROUPS: { label: string; qualities: ScaleQuality[] }[] = [
  { label: 'Pentatonic', qualities: ['majorPentatonic', 'minorPentatonic'] },
  { label: 'Diatonic', qualities: ['major', 'minor'] },
  { label: 'Blues', qualities: ['majorBlues', 'minorBlues'] },
  {
    label: 'Modes',
    qualities: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'],
  },
  { label: 'Other', qualities: ['harmonicMinor', 'melodicMinor'] },
];

export function getScaleIntervals(quality: ScaleQuality): number[] {
  return SCALE_DEFS[quality].intervals;
}

export function getScaleLetterSteps(quality: ScaleQuality): number[] {
  return SCALE_DEFS[quality].letterSteps;
}

export function getQualityLabel(quality: ScaleQuality): string {
  return SCALE_DEFS[quality].label;
}

export function isPentatonic(quality: ScaleQuality): boolean {
  return quality === 'majorPentatonic' || quality === 'minorPentatonic';
}
