import { ALL_NOTES } from '../lib/colors';
import type { KeyMode, NoteName, ScaleQuality, StudyMode } from '../types/music';

export const STUDY_MODES = [
  'practice',
  'notes',
  'chords',
  'scales',
  'progressions',
  'intervals',
  'theory',
] as const satisfies readonly StudyMode[];

/** Every mode except Notes works from one root note (the key). */
export function isSingleRootMode(mode: StudyMode): boolean {
  return (
    mode === 'practice' ||
    mode === 'chords' ||
    mode === 'scales' ||
    mode === 'progressions' ||
    mode === 'intervals' ||
    mode === 'theory'
  );
}

export function toSingleRoot(notes: Set<NoteName>): Set<NoteName> {
  const selected = ALL_NOTES.filter((note) => notes.has(note));
  return new Set(selected.length > 0 ? [selected[0]] : ['C']);
}

/** Scales whose tonal center reads as minor (for key-context derivation). */
const MINOR_FAMILY_SCALES = new Set<ScaleQuality>([
  'minor',
  'minorPentatonic',
  'minorBlues',
  'dorian',
  'phrygian',
  'locrian',
  'harmonicMinor',
  'melodicMinor',
]);

/** Relative-key counterpart for scale qualities that have one. */
export const RELATIVE_SCALE_QUALITY: Partial<Record<ScaleQuality, ScaleQuality>> = {
  major: 'minor',
  minor: 'major',
  majorPentatonic: 'minorPentatonic',
  minorPentatonic: 'majorPentatonic',
  majorBlues: 'minorBlues',
  minorBlues: 'majorBlues',
};

/**
 * The mode the current key reads as: drives the key-context panel and the
 * ambient background tint.
 */
export function getEffectiveKeyMode(
  studyMode: StudyMode,
  scaleQuality: ScaleQuality,
  progressionKeyMode: KeyMode,
  keyMode: KeyMode,
): KeyMode {
  if (studyMode === 'practice') return 'minor';
  if (studyMode === 'scales') {
    return MINOR_FAMILY_SCALES.has(scaleQuality) ? 'minor' : 'major';
  }
  if (studyMode === 'progressions') return progressionKeyMode;
  return keyMode;
}
