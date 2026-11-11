import { describe, expect, it } from 'vitest';
import type { FretPosition } from '../../types/music';
import { getIntervalDyadShapes } from './intervalShapes';

// Low E string (index 5), fret 5 = A.
const lowEA: FretPosition = { string: 5, fret: 5, note: 'A' };

describe('getIntervalDyadShapes', () => {
  it('returns no shapes for the unison/octave-down edge', () => {
    expect(getIntervalDyadShapes(lowEA, 0)).toEqual([]);
  });

  it('places the same-string major 3rd four frets up', () => {
    const same = getIntervalDyadShapes(lowEA, 4).find(
      (s) => s.relationship === 'same-string',
    );
    expect(same?.target).toEqual({ string: 5, fret: 9, note: 'C#' });
    expect(same?.fretOffset).toBe(4);
  });

  it('places a perfect 5th on the adjacent string at the same fret', () => {
    // All-fourths strings: a P5 (7 semitones) sits two frets up on the same
    // string-relationship as the power chord — adjacent string, +2 frets.
    const adjacent = getIntervalDyadShapes(lowEA, 7).find(
      (s) => s.relationship === 'adjacent',
    );
    expect(adjacent?.target.string).toBe(4);
    expect(adjacent?.fretOffset).toBe(2);
  });

  it('flags the G–B seam when the dyad crosses it', () => {
    // Root on the G string (index 2), fret 5 = C; a major 3rd lands on the B
    // string (index 1) and must shift up a fret.
    const gC: FretPosition = { string: 2, fret: 5, note: 'C' };
    const adjacent = getIntervalDyadShapes(gC, 4).find(
      (s) => s.relationship === 'adjacent',
    );
    expect(adjacent?.crossesGB).toBe(true);
  });

  it('omits shapes that fall off the neck', () => {
    // High e string (index 0) has no higher strings, so adjacent/skip drop out.
    const highE: FretPosition = { string: 0, fret: 3, note: 'G' };
    const shapes = getIntervalDyadShapes(highE, 4);
    expect(shapes.every((s) => s.relationship === 'same-string')).toBe(true);
  });
});
