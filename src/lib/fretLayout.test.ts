import { describe, expect, it } from 'vitest';
import {
  BASE_BOARD_HEIGHT,
  FRETBOARD_LAYOUT,
  MAX_STRING_GAP,
  MIN_BOARD_SCALE,
  boardScale,
  labelScale,
  maxStringGap,
} from './fretLayout';

describe('neck scaling', () => {
  it('keeps the old 36 px gap at the smallest window and grows with width', () => {
    expect(maxStringGap(960)).toBeCloseTo(36.9, 1);
    expect(maxStringGap(1440)).toBeCloseTo(55.4, 1);
    expect(maxStringGap(1728)).toBe(MAX_STRING_GAP);
    expect(maxStringGap(400)).toBe(FRETBOARD_LAYOUT.stringGap);
  });

  it('fills the height it is given, up to the cap for the window width', () => {
    // Exactly the old board: scale 1.
    expect(boardScale(BASE_BOARD_HEIGHT, 1440)).toBe(1);
    // Plenty of height: capped by width, so a wider window gets a taller neck.
    const at1440 = boardScale(2000, 1440);
    const at1728 = boardScale(2000, 1728);
    expect(at1440 * FRETBOARD_LAYOUT.stringGap).toBeCloseTo(maxStringGap(1440));
    expect(at1728).toBeGreaterThan(at1440);
  });

  it('shrinks only a little below the old board in tiny windows', () => {
    expect(boardScale(100, 1440)).toBe(MIN_BOARD_SCALE);
    expect(boardScale(BASE_BOARD_HEIGHT * 0.9, 1440)).toBeCloseTo(0.9);
  });

  it('grows dots and letters more slowly than the gap', () => {
    expect(labelScale(1)).toBe(1);
    expect(labelScale(1.5)).toBeCloseTo(1.3);
    expect(labelScale(1.5)).toBeLessThan(1.5);
  });
});
