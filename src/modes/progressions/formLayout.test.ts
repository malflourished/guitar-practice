import { describe, expect, it } from 'vitest';
import {
  PROGRESSION_LIBRARY,
  entryToProgressionDef,
  getProgressionLibraryEntry,
  resolveProgression,
} from '../../lib/music';
import { nextChange } from '../../lib/audio/jamSchedule';
import { BARS_PER_LINE, formLines, formatNextChange, repeatedBars } from './formLayout';
import { jamChordsOf } from './jamChords';

const steps = (id: string, key = 'C' as const) =>
  resolveProgression(key, entryToProgressionDef(getProgressionLibraryEntry(id)!), 'sharps');

describe('formLines', () => {
  it('12 bars give lines of [4, 4, 4], 5 give [4, 1], 4 give [4]', () => {
    expect(formLines(12)).toEqual([4, 4, 4]);
    expect(formLines(5)).toEqual([4, 1]);
    expect(formLines(4)).toEqual([4]);
  });

  it('short and odd lengths: 1, 2, 3, 6, 7, 8, 9 bars', () => {
    expect(formLines(1)).toEqual([1]);
    expect(formLines(2)).toEqual([2]);
    expect(formLines(3)).toEqual([3]);
    expect(formLines(6)).toEqual([4, 2]);
    expect(formLines(7)).toEqual([4, 3]);
    expect(formLines(8)).toEqual([4, 4]);
    expect(formLines(9)).toEqual([4, 4, 1]);
  });

  it('no bars, no lines; the lines always add up to the bars', () => {
    expect(formLines(0)).toEqual([]);
    expect(formLines(-3)).toEqual([]);
    for (let bars = 0; bars <= 33; bars++) {
      expect(formLines(bars).reduce((a, b) => a + b, 0)).toBe(bars);
    }
    expect(BARS_PER_LINE).toBe(4);
  });

  it('every entry in the library fits on at most three lines', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      expect(formLines(entry.steps.length).length, entry.id).toBeLessThanOrEqual(3);
    }
  });
});

describe('repeatedBars', () => {
  it('12-bar blues: the changes are bright, the holds dim, and bar 1 is never dimmed', () => {
    const blues = jamChordsOf(steps('blues-12'));
    const repeated = repeatedBars(blues);
    // I7 I7 I7 I7 / IV7 IV7 I7 I7 / V7 IV7 I7 V7
    expect(repeated).toEqual([false, true, true, true, false, true, false, true, false, false, false, false]);
  });

  it('a four-chord loop has no repeats', () => {
    expect(repeatedBars(jamChordsOf(steps('turnaround-1625')))).toEqual([false, false, false, false]);
  });

  it('a different quality or slash bass on the same root is a change, not a repeat', () => {
    const chord = (rootPc: number, quality: string, bassPc?: number) => ({ rootPc, quality, bassPc });
    expect(repeatedBars([chord(0, 'major'), chord(0, 'dom7'), chord(0, 'dom7'), chord(0, 'dom7', 7)])).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('a repeat is judged against the bar before, across the end of a line', () => {
    const chord = (rootPc: number) => ({ rootPc, quality: 'major' });
    // bar 5 (the first of line two) is the same chord as bar 4
    expect(repeatedBars([0, 5, 7, 7, 7, 0].map(chord))).toEqual([false, false, false, true, true, false]);
  });

  it('is empty for an empty loop', () => {
    expect(repeatedBars([])).toEqual([]);
  });
});

describe('formatNextChange', () => {
  it('"F7 in 3 bars", "F7 in 2 bars", "F7 next bar"', () => {
    expect(formatNextChange('F7', 3)).toBe('F7 in 3 bars');
    expect(formatNextChange('F7', 2)).toBe('F7 in 2 bars');
    expect(formatNextChange('F7', 1)).toBe('F7 next bar');
  });

  it('counts the blues down as it is played, in C', () => {
    const blues = steps('blues-12');
    const chords = jamChordsOf(blues);
    const say = (step: number) => {
      const next = nextChange(step, chords)!;
      return formatNextChange(blues[next.stepIndex].chordName, next.bars);
    };
    expect([0, 1, 2, 3].map(say)).toEqual(['F7 in 4 bars', 'F7 in 3 bars', 'F7 in 2 bars', 'F7 next bar']);
    expect(say(11)).toBe('C7 next bar');
  });
});
