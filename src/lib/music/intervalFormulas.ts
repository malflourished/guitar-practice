import type { ChordQuality, ScaleQuality } from '../../types/music';
import { getChordIntervals, getChordQualityLabel } from './chords';
import { getIntervalLabel } from './intervals';
import { MAJOR_SCALE, getQualityLabel, getScaleIntervals } from './scales';

export type FormulaKind = 'scale' | 'chord';

export interface FormulaTone {
  /** Semitone distance from the root (within one octave for the curated set). */
  interval: number;
  /** Function label, e.g. "R", "♭3", "5". */
  label: string;
  /** True when this tone is not in the major scale — a "tweak from major". */
  altered: boolean;
}

export interface FormulaSpec {
  kind: FormulaKind;
  label: string;
  tones: FormulaTone[];
}

export interface FormulaTarget {
  id: string;
  kind: FormulaKind;
  quality: ScaleQuality | ChordQuality;
  label: string;
}

const MAJOR_PCS = new Set(MAJOR_SCALE);

/**
 * Curated build targets whose tones all sit within a single octave, so each
 * tone reads as a clean function label. These are the scales and chords most
 * useful for demonstrating "everything is the major scale, tweaked".
 */
export const FORMULA_TARGETS: FormulaTarget[] = [
  { id: 'scale:major', kind: 'scale', quality: 'major', label: 'Major' },
  { id: 'scale:minor', kind: 'scale', quality: 'minor', label: 'Natural Minor' },
  { id: 'scale:dorian', kind: 'scale', quality: 'dorian', label: 'Dorian' },
  { id: 'scale:mixolydian', kind: 'scale', quality: 'mixolydian', label: 'Mixolydian' },
  { id: 'scale:lydian', kind: 'scale', quality: 'lydian', label: 'Lydian' },
  { id: 'scale:phrygian', kind: 'scale', quality: 'phrygian', label: 'Phrygian' },
  {
    id: 'scale:majorPentatonic',
    kind: 'scale',
    quality: 'majorPentatonic',
    label: 'Major Pentatonic',
  },
  {
    id: 'scale:minorPentatonic',
    kind: 'scale',
    quality: 'minorPentatonic',
    label: 'Minor Pentatonic',
  },
  { id: 'chord:major', kind: 'chord', quality: 'major', label: 'Major triad' },
  { id: 'chord:minor', kind: 'chord', quality: 'minor', label: 'Minor triad' },
  { id: 'chord:maj7', kind: 'chord', quality: 'maj7', label: 'Major 7' },
  { id: 'chord:dom7', kind: 'chord', quality: 'dom7', label: 'Dominant 7' },
  { id: 'chord:min7', kind: 'chord', quality: 'min7', label: 'Minor 7' },
  { id: 'chord:m7b5', kind: 'chord', quality: 'm7b5', label: 'Minor 7♭5' },
];

function intervalsForTarget(target: FormulaTarget): number[] {
  return target.kind === 'scale'
    ? getScaleIntervals(target.quality as ScaleQuality)
    : getChordIntervals(target.quality as ChordQuality);
}

function labelForTarget(target: FormulaTarget): string {
  return target.kind === 'scale'
    ? getQualityLabel(target.quality as ScaleQuality)
    : getChordQualityLabel(target.quality as ChordQuality);
}

/**
 * Decompose a build target into ordered interval functions, flagging tones that
 * differ from the major scale. This is the data behind the formula builder:
 * a scale or chord seen as the root plus a sequence of two-point intervals.
 */
export function buildFormulaSpec(target: FormulaTarget): FormulaSpec {
  const tones = intervalsForTarget(target).map<FormulaTone>((interval) => ({
    interval,
    label: getIntervalLabel(interval, 'function'),
    altered: !MAJOR_PCS.has(((interval % 12) + 12) % 12),
  }));
  return { kind: target.kind, label: labelForTarget(target), tones };
}

/** Look up a build target by its id. */
export function getFormulaTarget(id: string): FormulaTarget {
  return FORMULA_TARGETS.find((t) => t.id === id) ?? FORMULA_TARGETS[0];
}
