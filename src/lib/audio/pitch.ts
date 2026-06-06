import type { FretPosition, NoteName } from '../../types/music';

/**
 * Absolute MIDI note number of each open string in standard tuning.
 * Index 0 = high e (E4 = 64) ... index 5 = low E (E2 = 40), matching the
 * string ordering used everywhere else in the app (see STRING_LABELS /
 * OPEN_STRING_SEMITONES in lib/music/tuning.ts). These are the single source
 * of truth for octave information, which the pitch-class model otherwise lacks.
 */
export const OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40] as const;

/** Convert a {string, fret} location into an absolute MIDI note number. */
export function fretToMidi(stringIndex: number, fret: number): number {
  return OPEN_STRING_MIDI[stringIndex] + fret;
}

/** Convert a rendered FretPosition into an absolute MIDI note number. */
export function positionToMidi(position: FretPosition): number {
  return fretToMidi(position.string, position.fret);
}

export type ScaleDirection = 'ascending' | 'descending';

/**
 * Order positions into a musical scale run anchored on the root.
 *
 * Positions are sorted by pitch, then trimmed to begin at the lowest root note
 * (anything below the root in the box is dropped). The ascending run plays from
 * that root up to the highest note; the descending run is its reverse, so it
 * runs from the top down and resolves on the root.
 */
export function orderScalePositions(
  positions: FretPosition[],
  root: NoteName,
  direction: ScaleDirection,
): FretPosition[] {
  const sorted = [...positions].sort(
    (a, b) => positionToMidi(a) - positionToMidi(b),
  );
  // Window boxes can place the same pitch on two strings (e.g. open B and
  // G-string fret 4). Collapse those unisons so a run never repeats a note.
  const ascending = sorted.filter(
    (position, index) =>
      index === 0 || positionToMidi(position) !== positionToMidi(sorted[index - 1]),
  );
  const rootIndex = ascending.findIndex((position) => position.note === root);
  const fromRoot = rootIndex >= 0 ? ascending.slice(rootIndex) : ascending;
  return direction === 'ascending' ? fromRoot : [...fromRoot].reverse();
}
