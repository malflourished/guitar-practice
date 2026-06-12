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

/** How scale positions are sequenced before root resolution is applied. */
export type ScaleOrdering = 'pitch' | 'builtIn';

/** Which chord tone a scale run starts from. */
export type ScaleAnchor = 'root' | 'third' | 'fifth';

export interface ScalePlaybackContext {
  /** `pitch` for CAGED/box shapes; `builtIn` preserves 3NPS walk order. */
  ordering?: ScaleOrdering;
  /**
   * Pitch class (0–11) the run starts on. Defaults to matching the root by
   * note name. Lets the player anchor runs on the 3rd or 5th instead.
   */
  anchorPc?: number;
}

function dedupeByPitch(positions: FretPosition[]): FretPosition[] {
  const sorted = [...positions].sort(
    (a, b) => positionToMidi(a) - positionToMidi(b),
  );
  // Window boxes can place the same pitch on two strings (e.g. open B and
  // G-string fret 4). Collapse those unisons so a run never repeats a note.
  return sorted.filter(
    (position, index) =>
      index === 0 || positionToMidi(position) !== positionToMidi(sorted[index - 1]),
  );
}

/**
 * Order positions into a musical scale run anchored on a chord tone.
 *
 * Ascending runs start on the lowest occurrence of the anchor (the root by
 * default) and play every remaining note up to the top of the shape, so the
 * run always covers what's drawn on the fretboard. Descending runs start on
 * the highest anchor occurrence and walk down to the bottom of the shape.
 * `builtIn` ordering preserves the 3NPS string walk; `pitch` sorts box shapes
 * by pitch and collapses unison doublings.
 */
export function orderScalePositions(
  positions: FretPosition[],
  root: NoteName,
  direction: ScaleDirection,
  context: ScalePlaybackContext = {},
): FretPosition[] {
  const { ordering = 'pitch', anchorPc } = context;
  const sequence =
    ordering === 'builtIn' ? positions : dedupeByPitch(positions);
  const isAnchor = (position: FretPosition) =>
    anchorPc !== undefined
      ? positionToMidi(position) % 12 === anchorPc
      : position.note === root;

  if (direction === 'ascending') {
    const start = sequence.findIndex(isAnchor);
    return start > 0 ? sequence.slice(start) : [...sequence];
  }

  let lastAnchor = -1;
  for (let index = 0; index < sequence.length; index += 1) {
    if (isAnchor(sequence[index])) lastAnchor = index;
  }
  const run =
    lastAnchor >= 0 ? sequence.slice(0, lastAnchor + 1) : [...sequence];
  return run.reverse();
}
