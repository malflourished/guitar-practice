import { describe, expect, it } from 'vitest';
import {
  CHORD_GUIDE,
  CHORD_MENU_GROUPS,
  SCALE_GUIDE,
  SCALE_MENU_ROWS,
  SCALE_SYSTEM_LINE,
  formulaSemitones,
} from './chordGuide';
import { CHORD_DEFS, CHORD_QUALITIES } from './chords';
import { SCALE_DEFS, SCALE_QUALITIES } from './scales';

/**
 * One line in the deck at its narrowest: 1100 px wide with the side panel
 * docked leaves about 750 px, at a little over 6 px a character.
 */
const ONE_LINE = 116;

describe('the chord guide', () => {
  it('every formula is the chord the neck shows', () => {
    for (const quality of CHORD_QUALITIES) {
      expect(formulaSemitones(CHORD_GUIDE[quality].formula), quality).toEqual(CHORD_DEFS[quality].intervals);
    }
  });

  it('every chord has a button, a formula and one line that fits the deck', () => {
    for (const quality of CHORD_QUALITIES) {
      const { symbol, sound } = CHORD_GUIDE[quality];
      expect(symbol.length, quality).toBeGreaterThan(0);
      expect(sound.length, quality).toBeGreaterThan(40);
      expect(sound.length, `${quality}: ${sound}`).toBeLessThanOrEqual(ONE_LINE);
      expect(sound.endsWith('.'), quality).toBe(true);
    }
    expect(new Set(CHORD_QUALITIES.map((q) => CHORD_GUIDE[q].symbol)).size).toBe(CHORD_QUALITIES.length);
  });

  it('the menu has three groups holding every chord once', () => {
    expect(CHORD_MENU_GROUPS.map((g) => g.label)).toEqual(['Triads', 'Sevenths', 'Extended']);
    const listed = CHORD_MENU_GROUPS.flatMap((g) => g.qualities);
    expect([...listed].sort()).toEqual([...CHORD_QUALITIES].sort());
    // Triads have three notes, the middle group four, extended five or six.
    const sizes = CHORD_MENU_GROUPS.map((g) => new Set(g.qualities.map((q) => CHORD_DEFS[q].intervals.length)));
    expect(sizes).toEqual([new Set([3]), new Set([4]), new Set([5, 6])]);
  });

  it('what the lines claim is true of the notes', () => {
    const pcs = (root: number, intervals: number[]) => new Set(intervals.map((i) => (root + i) % 12));
    // C6 holds the notes of A minor 7, a minor 3rd below.
    expect(pcs(0, CHORD_DEFS.maj6.intervals)).toEqual(pcs(9, CHORD_DEFS.min7.intervals));
    // A dominant 7's 3rd and b7 are a tritone apart.
    expect(CHORD_DEFS.dom7.intervals[3] - CHORD_DEFS.dom7.intervals[1]).toBe(6);
    // A major 7's 7th is one fret under the root.
    expect(12 - CHORD_DEFS.maj7.intervals[3]).toBe(1);
    // dim7 is the same chord every three frets, aug every four.
    expect(pcs(3, CHORD_DEFS.dim7.intervals)).toEqual(pcs(0, CHORD_DEFS.dim7.intervals));
    expect(pcs(4, CHORD_DEFS.aug.intervals)).toEqual(pcs(0, CHORD_DEFS.aug.intervals));
    // C11 without its 3rd holds B flat major (B flat, D, F).
    const c11 = pcs(0, CHORD_DEFS.dom11.intervals);
    for (const pc of pcs(10, CHORD_DEFS.major.intervals)) expect(c11.has(pc)).toBe(true);
    // A minor 11 holds the whole minor pentatonic.
    const m11 = pcs(0, CHORD_DEFS.min11.intervals);
    for (const pc of pcs(0, SCALE_DEFS.minorPentatonic.intervals)) expect(m11.has(pc)).toBe(true);
    // Minor 6 and minor 13 sit inside Dorian; minor 6 inside melodic minor too.
    const dorian = pcs(0, SCALE_DEFS.dorian.intervals);
    for (const q of ['min6', 'min13'] as const) {
      for (const pc of pcs(0, CHORD_DEFS[q].intervals)) expect(dorian.has(pc), q).toBe(true);
    }
    const melodic = pcs(0, SCALE_DEFS.melodicMinor.intervals);
    for (const pc of pcs(0, CHORD_DEFS.min6.intervals)) expect(melodic.has(pc)).toBe(true);
    // The diminished triad on the 7th of a major scale: B D F in C.
    const major = pcs(0, SCALE_DEFS.major.intervals);
    for (const pc of pcs(11, CHORD_DEFS.dim.intervals)) expect(major.has(pc)).toBe(true);
    // m7b5 is the ii chord of a minor key: D F A flat C in C minor.
    const minor = pcs(0, SCALE_DEFS.minor.intervals);
    for (const pc of pcs(2, CHORD_DEFS.m7b5.intervals)) expect(minor.has(pc)).toBe(true);
  });
});

describe('the scale guide', () => {
  it('every formula is the scale the neck shows', () => {
    for (const quality of SCALE_QUALITIES) {
      expect(formulaSemitones(SCALE_GUIDE[quality].formula), quality).toEqual(SCALE_DEFS[quality].intervals);
    }
  });

  it('every scale has one line that fits the deck', () => {
    for (const quality of SCALE_QUALITIES) {
      const { line } = SCALE_GUIDE[quality];
      expect(line.length, quality).toBeGreaterThan(60);
      expect(line.length, `${quality}: ${line}`).toBeLessThanOrEqual(ONE_LINE);
      // Character, then where it fits.
      expect(line, quality).toMatch(/Over /);
    }
    expect(SCALE_SYSTEM_LINE.length).toBeLessThanOrEqual(ONE_LINE);
  });

  it('the menu holds every scale once, with the modes in the order of their degrees', () => {
    const groups = SCALE_MENU_ROWS.flat();
    expect([...groups.flatMap((g) => g.qualities)].sort()).toEqual([...SCALE_QUALITIES].sort());
    const modes = groups.find((g) => g.label === 'Major and its modes')!.qualities;
    const major = SCALE_DEFS.major.intervals;
    modes.forEach((mode, degree) => {
      // Each mode is the major scale started from its degree.
      const rotated = major.map((_, i) => (major[(degree + i) % 7] - major[degree] + 12) % 12);
      expect(SCALE_DEFS[mode].intervals, mode).toEqual(rotated);
    });
  });

  it('what the lines claim is true of the notes', () => {
    const has = (quality: keyof typeof SCALE_DEFS, semitone: number) =>
      SCALE_DEFS[quality].intervals.includes(semitone);
    // Major pentatonic has no 4th or 7th.
    expect(has('majorPentatonic', 5) || has('majorPentatonic', 11)).toBe(false);
    // Natural minor is the minor pentatonic plus the 2nd and b6.
    expect([...SCALE_DEFS.minorPentatonic.intervals, 2, 8].sort((a, b) => a - b)).toEqual(SCALE_DEFS.minor.intervals);
    // Dorian is minor with a raised 6th; Lydian is major with a raised 4th;
    // Mixolydian is major with a b7; Phrygian is minor with a b2.
    const swap = (from: number[], out: number, into: number) =>
      from.map((i) => (i === out ? into : i)).sort((a, b) => a - b);
    expect(swap(SCALE_DEFS.minor.intervals, 8, 9)).toEqual(SCALE_DEFS.dorian.intervals);
    expect(swap(SCALE_DEFS.major.intervals, 5, 6)).toEqual(SCALE_DEFS.lydian.intervals);
    expect(swap(SCALE_DEFS.major.intervals, 11, 10)).toEqual(SCALE_DEFS.mixolydian.intervals);
    expect(swap(SCALE_DEFS.minor.intervals, 2, 1)).toEqual(SCALE_DEFS.phrygian.intervals);
    // Harmonic minor raises the 7th; melodic minor is major with a minor 3rd.
    expect(swap(SCALE_DEFS.minor.intervals, 10, 11)).toEqual(SCALE_DEFS.harmonicMinor.intervals);
    expect(swap(SCALE_DEFS.major.intervals, 4, 3)).toEqual(SCALE_DEFS.melodicMinor.intervals);
    // Locrian's home chord is diminished.
    expect([0, 3, 6].every((i) => has('locrian', i))).toBe(true);
    // The blues scales are the pentatonics plus one note.
    expect([...SCALE_DEFS.minorPentatonic.intervals, 6].sort((a, b) => a - b)).toEqual(SCALE_DEFS.minorBlues.intervals);
    expect([...SCALE_DEFS.majorPentatonic.intervals, 3].sort((a, b) => a - b)).toEqual(SCALE_DEFS.majorBlues.intervals);
  });
});
