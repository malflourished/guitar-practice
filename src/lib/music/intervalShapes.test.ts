import { describe, expect, it } from 'vitest';
import type { FretPosition } from '../../types/music';
import { MAX_DYAD_REACH, getIntervalDyadShapes } from './intervalShapes';

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

  it('never offers a shape spanning more than 4 frets', () => {
    for (let string = 0; string < 6; string += 1) {
      for (let fret = 0; fret <= 12; fret += 1) {
        const anchor: FretPosition = { string, fret, note: 'C' };
        for (let semitones = 1; semitones <= 12; semitones += 1) {
          for (const shape of getIntervalDyadShapes(anchor, semitones)) {
            expect(Math.abs(shape.fretOffset)).toBeLessThanOrEqual(MAX_DYAD_REACH);
          }
        }
      }
    }
  });

  it('drops the six-fret string skip for a major 3rd', () => {
    // Low E fret 7 (B): the major 3rd (D#) on the D string is fret 1, six
    // frets back, so only the same-string and adjacent shapes remain.
    const lowEB: FretPosition = { string: 5, fret: 7, note: 'B' };
    const shapes = getIntervalDyadShapes(lowEB, 4);
    expect(shapes.map((s) => s.relationship)).toEqual(['same-string', 'adjacent']);
  });
});
