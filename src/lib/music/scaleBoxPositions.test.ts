import { describe, expect, it } from 'vitest';
import type { NoteName } from '../../types/music';
import type { Position } from './positions';
import { buildScalePositions } from './positions';

/** Sorted "string:fret" cells of a position, for set-equality assertions. */
function cells(position: Position): string[] {
  return position.positions.map((p) => `${p.string}:${p.fret}`).sort();
}

/** Build a sorted cell list from a per-string `{ string: frets }` map. */
function cellsFromMap(byString: Record<number, number[]>): string[] {
  const out: string[] = [];
  for (const [string, frets] of Object.entries(byString)) {
    for (const fret of frets) out.push(`${string}:${fret}`);
  }
  return out.sort();
}

function notes(position: Position): NoteName[] {
  return position.positions.map((p) => p.note);
}

describe('minor pentatonic boxes (A)', () => {
  const boxes = buildScalePositions('A', 'minorPentatonic');

  it('returns exactly five boxes', () => {
    expect(boxes).toHaveLength(5);
    expect(boxes.map((b) => b.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every box is two notes per string', () => {
    for (const box of boxes) expect(box.positions).toHaveLength(12);
  });

  it('pos 1 is the open box', () => {
    expect(cells(boxes[0])).toEqual(
      cellsFromMap({ 5: [0, 3], 4: [0, 3], 3: [0, 2], 2: [0, 2], 1: [1, 3], 0: [0, 3] }),
    );
  });

  it('pos 2 is the frets 2–5 box and includes its 4:3 / 1:3 tones', () => {
    expect(cells(boxes[1])).toEqual(
      cellsFromMap({ 5: [3, 5], 4: [3, 5], 3: [2, 5], 2: [2, 5], 1: [3, 5], 0: [3, 5] }),
    );
    // These belong to the 2–5 box; the original plan wrongly flagged them as bleed.
    expect(cells(boxes[1])).toContain('4:3');
    expect(cells(boxes[1])).toContain('1:3');
    // ...and it must not reach up into the root box.
    expect(cells(boxes[1])).not.toContain('5:8');
  });

  it('pos 3 is the root box (frets 5–8) without the old window bleed', () => {
    expect(cells(boxes[2])).toEqual(
      cellsFromMap({ 5: [5, 8], 4: [5, 7], 3: [5, 7], 2: [5, 7], 1: [5, 8], 0: [5, 8] }),
    );
    expect(cells(boxes[2])).toContain('5:8');
    expect(cells(boxes[2])).toContain('0:8');
    // The old [anchor, anchor+4] window leaked G-string fret 9 (an E) into this box.
    expect(cells(boxes[2])).not.toContain('2:9');
  });
});

describe('pentatonic boxes are key-correct, not just for A/C', () => {
  // Regression for the positional-indexing bug: E-minor's anchors are
  // [0,3,5,7,10], so the box at fret 0 is the ROOT box — a different shape than
  // A-minor's open box. Indexing templates by sorted position would stamp
  // A-minor's shape here and produce a broken box.
  const eMinor = buildScalePositions('E', 'minorPentatonic');

  it('E-minor pos 1 is the root box, distinct from A-minor pos 1', () => {
    expect(cells(eMinor[0])).toEqual(
      cellsFromMap({ 5: [0, 3], 4: [0, 2], 3: [0, 2], 2: [0, 2], 1: [0, 3], 0: [0, 3] }),
    );
    // Cells unique to the root box (A-minor's open box has 4:3 and 1:1 instead).
    expect(cells(eMinor[0])).toContain('4:2');
    expect(cells(eMinor[0])).toContain('1:0');
    expect(cells(eMinor[0])).not.toContain('1:1');
  });

  it('every E-minor pentatonic note is in the scale', () => {
    const scale = new Set<NoteName>(['E', 'G', 'A', 'B', 'D']);
    for (const box of eMinor) {
      for (const note of notes(box)) expect(scale.has(note)).toBe(true);
    }
  });

  it('major pentatonic shares its boxes with the relative minor', () => {
    const cMajor = buildScalePositions('C', 'majorPentatonic');
    const aMinor = buildScalePositions('A', 'minorPentatonic');
    expect(cMajor.map(cells)).toEqual(aMinor.map(cells));
  });
});

describe('blues adds the blue note to the pentatonic frame', () => {
  it('A-minor blues pos 1 = pentatonic pos 1 + the ♭5 at 3:1', () => {
    const pent = buildScalePositions('A', 'minorPentatonic');
    const blues = buildScalePositions('A', 'minorBlues');
    expect(blues).toHaveLength(5);
    expect(cells(blues[0])).toEqual([...cells(pent[0]), '3:1'].sort());
    expect(notes(blues[0])).toContain('D#'); // ♭5 of A
  });

  it('major blues stays inside the major blues scale', () => {
    const scale = new Set<NoteName>(['C', 'D', 'D#', 'E', 'G', 'A']);
    for (const box of buildScalePositions('C', 'majorBlues')) {
      for (const note of notes(box)) expect(scale.has(note)).toBe(true);
    }
  });
});

describe('CAGED diatonic boxes', () => {
  const cMajor = buildScalePositions('C', 'major', 'caged');

  it('returns five boxes whose notes are all diatonic', () => {
    expect(cMajor).toHaveLength(5);
    const scale = new Set<NoteName>(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    for (const box of cMajor) {
      for (const note of notes(box)) expect(scale.has(note)).toBe(true);
    }
  });

  it('layers both passing tones (4 and 7) onto the pentatonic frame', () => {
    const all = cMajor.flatMap(notes);
    expect(all).toContain('F'); // the 4
    expect(all).toContain('B'); // the 7
  });

  it('C major and A minor CAGED are the same boxes (relative keys)', () => {
    const aMinor = buildScalePositions('A', 'minor', 'caged');
    expect(cMajor.map(cells)).toEqual(aMinor.map(cells));
  });
});

describe('3NPS is unchanged', () => {
  it('returns seven positions for C major when system is 3nps', () => {
    expect(buildScalePositions('C', 'major', '3nps')).toHaveLength(7);
  });

  it('modes use 3NPS regardless of system', () => {
    expect(buildScalePositions('D', 'dorian', 'caged')).toHaveLength(7);
  });
});
