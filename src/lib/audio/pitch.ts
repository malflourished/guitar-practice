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

export interface ScalePlaybackContext {
  /** `pitch` for CAGED/box shapes; `builtIn` preserves 3NPS walk order. */
  ordering?: ScaleOrdering;
  /** Position box start fret — used for open-position prefix rules. */
  startFret?: number;
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

function findRootIndices(positions: FretPosition[], root: NoteName): number[] {
  return positions
    .map((position, index) => (position.note === root ? index : -1))
    .filter((index) => index >= 0);
}

/**
 * CAGED / box shapes: pitch-sorted run that resolves on the highest root.
 * Bass-string approach notes below the lowest root are included when the shape
 * calls for them; treble notes above the octave root are trimmed.
 */
function orderCagedBoxRun(
  positions: FretPosition[],
  root: NoteName,
  startFret?: number,
): FretPosition[] {
  const ascending = dedupeByPitch(positions);
  const rootIndices = findRootIndices(ascending, root);
  if (rootIndices.length === 0) return ascending;

  const lowRootIdx = rootIndices[0];
  const highRootIdx = rootIndices[rootIndices.length - 1];
  const rootString = ascending[lowRootIdx].string;

  let start = lowRootIdx;
  if (rootString === 5) {
    start = lowRootIdx;
  } else if (startFret === 0 && rootString >= 4) {
    start = lowRootIdx;
  } else if (rootString <= 3) {
    start = 0;
  } else if (rootString === 4) {
    const firstLowE = ascending.findIndex(
      (position, index) => index < lowRootIdx && position.string === 5,
    );
    start = firstLowE >= 0 ? firstLowE : lowRootIdx;
  }

  return ascending.slice(start, highRootIdx + 1);
}

/** 3NPS: keep the built low-E → high-e walk; cap at the last root. */
function orderBuiltInRun(positions: FretPosition[], root: NoteName): FretPosition[] {
  const rootIndices = findRootIndices(positions, root);
  if (rootIndices.length === 0) return positions;
  const highRootIdx = rootIndices[rootIndices.length - 1];
  return positions.slice(0, highRootIdx + 1);
}

/**
 * Order positions into a musical scale run anchored on the root.
 *
 * Ascending runs resolve on the highest root in the position. CAGED-style boxes
 * may include bass-string approach notes before the lowest root; 3NPS shapes
 * keep their built-in string walk. Descending is the reverse of ascending.
 */
export function orderScalePositions(
  positions: FretPosition[],
  root: NoteName,
  direction: ScaleDirection,
  context: ScalePlaybackContext = {},
): FretPosition[] {
  const { ordering = 'pitch', startFret } = context;
  const ascending =
    ordering === 'builtIn'
      ? orderBuiltInRun(positions, root)
      : orderCagedBoxRun(positions, root, startFret);
  return direction === 'ascending' ? ascending : [...ascending].reverse();
}
