import { MINOR_PENTATONIC } from './scales';

/**
 * One note in a box shape, expressed as a fret offset from that box's low-E
 * anchor fret. String index follows the rest of the app: 0 = high e … 5 = low E.
 * Offsets may be negative (inner strings often dip a fret below the anchor).
 */
export interface BoxCell {
  string: number;
  offset: number;
}

/** Expand a per-string `{ stringIndex: offsets }` map into a flat cell list. */
function shape(byString: Record<number, number[]>): BoxCell[] {
  const cells: BoxCell[] = [];
  for (const [string, offsets] of Object.entries(byString)) {
    for (const offset of offsets) cells.push({ string: Number(string), offset });
  }
  return cells;
}

/**
 * The five canonical minor-pentatonic box shapes, indexed by **pentatonic
 * ordinal from the root** — i.e. `MINOR_PENT_SHAPES[i]` is the box whose low-E
 * anchor sits on the scale tone `MINOR_PENTATONIC[i]` (0 = root, 1 = ♭3,
 * 2 = 4, 3 = 5, 4 = ♭7). Keying by ordinal rather than by sorted fret position
 * is what keeps the shapes correct in every key, not just A-minor / C-major.
 *
 * Each shape is two notes per string, verified against A-minor pentatonic: at
 * its anchor the box reproduces the standard fingering, and consecutive boxes
 * share a rung on the low E so they tile the neck with no gaps.
 *
 * Major pentatonic, blues, and CAGED all reuse these same physical shapes via
 * the relative-minor frame (see `buildBoxPositions` in positions.ts); the blue
 * note and diatonic passing tones are layered on at build time.
 */
export const MINOR_PENT_SHAPES: BoxCell[][] = [
  // ord 0 — root box (e.g. A-min pent frets 5–8, root on the low E).
  shape({ 5: [0, 3], 4: [0, 2], 3: [0, 2], 2: [0, 2], 1: [0, 3], 0: [0, 3] }),
  // ord 1 — ♭3 box (frets 7–10). Inner strings reach a fret below the anchor.
  shape({ 5: [0, 2], 4: [-1, 2], 3: [-1, 2], 2: [-1, 1], 1: [0, 2], 0: [0, 2] }),
  // ord 2 — 4 box (frets 9–13).
  shape({ 5: [0, 2], 4: [0, 2], 3: [0, 2], 2: [-1, 2], 1: [0, 3], 0: [0, 2] }),
  // ord 3 — 5 box (the open-position box, frets 0–3 in A-min / C-major).
  shape({ 5: [0, 3], 4: [0, 3], 3: [0, 2], 2: [0, 2], 1: [1, 3], 0: [0, 3] }),
  // ord 4 — ♭7 box (frets 2–5).
  shape({ 5: [0, 2], 4: [0, 2], 3: [-1, 2], 2: [-1, 2], 1: [0, 2], 0: [0, 2] }),
];

if (MINOR_PENT_SHAPES.length !== MINOR_PENTATONIC.length) {
  throw new Error('MINOR_PENT_SHAPES must have one shape per pentatonic degree');
}
