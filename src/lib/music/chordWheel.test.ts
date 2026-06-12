import { describe, expect, it } from 'vitest';
import {
  getChordWheelWedges,
  getDiatonicHighlights,
  getSelectedWheelIndex,
} from './chordWheel';

describe('chordWheel', () => {
  it('places I, vi, ii, and dim chords on each wedge', () => {
    const cWedge = getChordWheelWedges()[0];
    expect(cWedge.major).toBe('C');
    expect(cWedge.labels.I).toBe('C');
    expect(cWedge.labels.vi).toBe('Am');
    expect(cWedge.labels.ii).toBe('Dm');
    expect(cWedge.labels.dim).toBe('B°');
  });

  it('highlights the diatonic family for C major', () => {
    const highlights = getDiatonicHighlights(0);
    const numerals = highlights.map((item) => item.numeral).sort();

    expect(numerals).toEqual(['I', 'IV', 'V', 'ii', 'iii', 'vi', 'vii°']);

    const byNumeral = Object.fromEntries(
      highlights.map((item) => [item.numeral, item]),
    );

    expect(byNumeral.I).toEqual({ wedgeIndex: 0, ring: 'I', numeral: 'I' });
    expect(byNumeral.ii).toEqual({ wedgeIndex: 0, ring: 'ii', numeral: 'ii' });
    expect(byNumeral.vi).toEqual({ wedgeIndex: 0, ring: 'vi', numeral: 'vi' });
    expect(byNumeral.IV).toEqual({ wedgeIndex: 11, ring: 'I', numeral: 'IV' });
    expect(byNumeral.V).toEqual({ wedgeIndex: 1, ring: 'I', numeral: 'V' });
    expect(byNumeral.iii).toEqual({ wedgeIndex: 1, ring: 'vi', numeral: 'iii' });
    expect(byNumeral['vii°']).toEqual({
      wedgeIndex: 0,
      ring: 'dim',
      numeral: 'vii°',
    });
  });

  it('resolves the selected wheel index from key state', () => {
    expect(getSelectedWheelIndex('C', 'major')).toBe(0);
    expect(getSelectedWheelIndex('A', 'minor')).toBe(0);
    expect(getSelectedWheelIndex('G', 'major')).toBe(1);
    expect(getSelectedWheelIndex('E', 'minor')).toBe(1);
  });
});
