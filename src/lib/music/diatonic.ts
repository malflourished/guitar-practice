import type { ChordQuality, KeyMode, NoteName } from '../../types/music';
import { MAJOR_SCALE, NATURAL_MINOR } from './scales';
import { noteToSemitone, semitoneToNote } from './notes';

/** Default diatonic chord qualities by scale degree (1-indexed). */
const MAJOR_DIATONIC: ChordQuality[] = [
  'major',
  'minor',
  'minor',
  'major',
  'major',
  'minor',
  'dim',
];

const MINOR_DIATONIC: ChordQuality[] = [
  'minor',
  'dim',
  'major',
  'minor',
  'minor',
  'major',
  'major',
];

export function getScaleIntervalsForKeyMode(keyMode: KeyMode): number[] {
  return keyMode === 'major' ? MAJOR_SCALE : NATURAL_MINOR;
}

export function getDiatonicQuality(
  keyMode: KeyMode,
  degree: number,
): ChordQuality {
  const qualities = keyMode === 'major' ? MAJOR_DIATONIC : MINOR_DIATONIC;
  return qualities[degree - 1] ?? 'major';
}

/** Root note for a scale degree in the given key. */
export function getDiatonicRoot(
  keyRoot: NoteName,
  keyMode: KeyMode,
  degree: number,
): NoteName {
  const intervals = getScaleIntervalsForKeyMode(keyMode);
  const semitone = noteToSemitone(keyRoot) + intervals[degree - 1];
  return semitoneToNote(semitone);
}
