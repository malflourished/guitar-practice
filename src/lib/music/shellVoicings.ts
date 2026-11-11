import type { ChordQuality, NoteName } from '../../types/music';
import { getChordIntervals } from './chords';
import { noteToSemitone } from './notes';

/**
 * The three seventh-chord qualities Jack Gardiner builds from one root to hear
 * how flattening the 3rd and 7th changes the sound. Order matters: maj7 is the
 * baseline, dom7 flattens the 7, min7 also flattens the 3.
 */
export const SHELL_QUALITIES: ChordQuality[] = ['maj7', 'dom7', 'min7'];

export interface ShellDef {
  quality: ChordQuality;
  label: string;
  /** Root, 3rd, 7th semitone offsets — the 5th (the "potato") is dropped. */
  intervals: number[];
  /** The 3rd's semitone offset (3 or 4). */
  third: number;
  /** The 7th's semitone offset (10 or 11). */
  seventh: number;
}

const SHELL_LABEL: Record<string, string> = {
  maj7: 'Major 7',
  dom7: 'Dominant 7',
  min7: 'Minor 7',
};

/**
 * Reduce a chord to its shell — root, 3rd, 7th — by filtering the full interval
 * set (Decision 10: generated). The 3rd is the first tone at 3 or 4 semitones;
 * the 7th the first at 10 or 11.
 */
export function getShellDef(quality: ChordQuality): ShellDef {
  const intervals = getChordIntervals(quality);
  const third = intervals.find((i) => i === 3 || i === 4) ?? 4;
  const seventh = intervals.find((i) => i === 10 || i === 11) ?? 10;
  return {
    quality,
    label: SHELL_LABEL[quality] ?? quality,
    intervals: [0, third, seventh],
    third,
    seventh,
  };
}

/** The shell's three pitch classes for a given root. */
export function getShellPitchClasses(
  root: NoteName,
  quality: ChordQuality,
): Set<number> {
  const rootPc = noteToSemitone(root);
  return new Set(getShellDef(quality).intervals.map((i) => (rootPc + i) % 12));
}

/** The two color tones — 3rd and 7th — that define the chord's quality. */
export function getColorTonePitchClasses(
  root: NoteName,
  quality: ChordQuality,
): Set<number> {
  const rootPc = noteToSemitone(root);
  const { third, seventh } = getShellDef(quality);
  return new Set([(rootPc + third) % 12, (rootPc + seventh) % 12]);
}

/**
 * Whether a set of chosen pitch classes completes the shell. Used to validate a
 * built voicing regardless of which octaves/strings the player picks.
 */
export function isShellComplete(
  root: NoteName,
  chosen: Iterable<number>,
  quality: ChordQuality,
): boolean {
  const needed = getShellPitchClasses(root, quality);
  const have = new Set<number>();
  for (const pc of chosen) have.add(((pc % 12) + 12) % 12);
  for (const pc of needed) {
    if (!have.has(pc)) return false;
  }
  return true;
}
