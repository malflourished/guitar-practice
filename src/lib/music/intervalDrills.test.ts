import { describe, expect, it } from 'vitest';
import {
  DRILLS,
  DRILL_GROUPS,
  SHELL_STEPS,
  drillsInGroup,
} from './intervalDrills';
import { FORMULA_TARGETS } from './intervalFormulas';
import {
  DEFAULT_INTERVAL_COLORS,
  INTERVAL_COLORS_KEY,
  isIntervalColorsValue,
} from '../../hooks/useIntervalColors';
import { getIntervalAccent, getIntervalMarker } from './intervals';

describe('interval drills', () => {
  it('has two groups, Learn then Train', () => {
    expect(DRILL_GROUPS.map((g) => g.label)).toEqual(['Learn', 'Train']);
  });

  it('lists See, Shapes, Find under Learn, in that order', () => {
    expect(drillsInGroup('learn').map((d) => d.label)).toEqual(['See', 'Shapes', 'Find']);
  });

  it('lists Ear, Shell chords, Guide tones under Train, in that order', () => {
    expect(drillsInGroup('train').map((d) => d.label)).toEqual([
      'Ear',
      'Shell chords',
      'Guide tones',
    ]);
  });

  it('keeps the tab order as Learn then Train, with a line for every drill', () => {
    expect(DRILLS.map((d) => d.group)).toEqual([
      'learn', 'learn', 'learn', 'train', 'train', 'train',
    ]);
    for (const drill of DRILLS) expect(drill.line.length).toBeGreaterThan(20);
  });

  it('folds Build into Shell chords as a step, with every Build target kept', () => {
    expect(SHELL_STEPS.map((s) => s.label)).toEqual(['See it', 'Build it', 'Test it']);
    expect(FORMULA_TARGETS.length).toBe(14);
  });
});

describe('interval colours setting', () => {
  it('is remembered as interval-colors and is off by default', () => {
    expect(INTERVAL_COLORS_KEY).toBe('interval-colors');
    expect(DEFAULT_INTERVAL_COLORS).toBe(false);
  });

  it('accepts only a stored true or false', () => {
    expect(isIntervalColorsValue(true)).toBe(true);
    expect(isIntervalColorsValue(false)).toBe(true);
    expect(isIntervalColorsValue('true')).toBe(false);
    expect(isIntervalColorsValue(null)).toBe(false);
  });

  it('gives no colour unless colours are on', () => {
    expect(getIntervalAccent(4, false)).toBeUndefined();
    expect(getIntervalAccent(4, true)).toBe('#EF5350');
    const off = getIntervalMarker('C', 'E');
    expect(off.color).toBeUndefined();
    expect(off.textColor).toBeUndefined();
    expect(off.shape).toBe('triangle-up');
    expect(off.label).toBe('3');
    const on = getIntervalMarker('C', 'E', 'function', true);
    expect(on.color).toBe('#EF5350');
    expect(on.textColor).toBeDefined();
  });
});
