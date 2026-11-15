import { describe, expect, it } from 'vitest';
import {
  NECK_MIN,
  SIDE_MAX,
  SIDE_MIN,
  SIDE_STEP,
  SIDE_STEP_LARGE,
  clampSideWidth,
  defaultSideWidth,
  isSideWidth,
  sideWidthAfterKey,
  sideWidthLimits,
} from './sideWidth';

describe('the side panel width limits', () => {
  it('never lets the panel go under 280 px', () => {
    expect(clampSideWidth(100, 1440)).toBe(SIDE_MIN);
    expect(clampSideWidth(-50, 1440)).toBe(SIDE_MIN);
    expect(clampSideWidth(Number.NaN, 1440)).toBe(SIDE_MIN);
  });

  it('stops the panel at 520 px however wide the window', () => {
    expect(clampSideWidth(900, 1440)).toBe(SIDE_MAX);
    expect(clampSideWidth(900, 2560)).toBe(SIDE_MAX);
    expect(sideWidthLimits(2560).max).toBe(SIDE_MAX);
  });

  it('leaves a width inside the limits alone, in whole pixels', () => {
    expect(clampSideWidth(400, 1440)).toBe(400);
    expect(clampSideWidth(400.6, 1440)).toBe(401);
  });

  it('keeps the neck at 640 px or more in every window that docks the panel', () => {
    // The panel docks from 1100 px wide; the frame's edges take 34 px.
    for (const windowWidth of [1100, 1180, 1280, 1366, 1440, 1728, 1920]) {
      const { max } = sideWidthLimits(windowWidth);
      expect(windowWidth - 34 - max).toBeGreaterThanOrEqual(NECK_MIN);
    }
    expect(sideWidthLimits(1100).max).toBe(426);
  });

  it('never lets the maximum fall under the minimum, even in a tiny window', () => {
    for (const windowWidth of [0, 300, 700, 960]) {
      const { min, max } = sideWidthLimits(windowWidth);
      expect(max).toBeGreaterThanOrEqual(min);
    }
    // At 960 px (a drawer window) there is room for 286 px beside a 640 px neck.
    expect(clampSideWidth(500, 960)).toBe(286);
    expect(clampSideWidth(500, 700)).toBe(SIDE_MIN);
  });

  it('has a default of 22% of the window between 280 and 340 px', () => {
    expect(defaultSideWidth(1100)).toBe(280);
    expect(defaultSideWidth(1440)).toBe(317);
    expect(defaultSideWidth(2560)).toBe(340);
  });
});

describe('saving the width', () => {
  it('accepts nothing (the default) or a width inside the limits', () => {
    expect(isSideWidth(null)).toBe(true);
    expect(isSideWidth(280)).toBe(true);
    expect(isSideWidth(520)).toBe(true);
    expect(isSideWidth(400.5)).toBe(true);
  });

  it('rejects anything else a stale or edited store might hold', () => {
    for (const bad of [undefined, '400', 100, 279, 521, 5000, Number.NaN, Infinity, {}, true]) {
      expect(isSideWidth(bad)).toBe(false);
    }
  });
});

describe('arrow keys on the handle', () => {
  it('widens on Left and narrows on Right, in 16 px steps', () => {
    expect(sideWidthAfterKey('ArrowLeft', false, 320, 1440)).toBe(320 + SIDE_STEP);
    expect(sideWidthAfterKey('ArrowRight', false, 320, 1440)).toBe(320 - SIDE_STEP);
  });

  it('takes 64 px with Shift', () => {
    expect(sideWidthAfterKey('ArrowLeft', true, 320, 1440)).toBe(320 + SIDE_STEP_LARGE);
    expect(sideWidthAfterKey('ArrowRight', true, 400, 1440)).toBe(400 - SIDE_STEP_LARGE);
  });

  it('stops at the limits instead of passing them', () => {
    expect(sideWidthAfterKey('ArrowRight', false, SIDE_MIN, 1440)).toBe(SIDE_MIN);
    expect(sideWidthAfterKey('ArrowLeft', false, SIDE_MAX, 1440)).toBe(SIDE_MAX);
    expect(sideWidthAfterKey('ArrowLeft', true, 500, 1440)).toBe(SIDE_MAX);
    expect(sideWidthAfterKey('ArrowLeft', false, 420, 1100)).toBe(426);
  });

  it('sends Home to the narrowest and End to the widest', () => {
    expect(sideWidthAfterKey('Home', false, 400, 1440)).toBe(SIDE_MIN);
    expect(sideWidthAfterKey('End', false, 400, 1440)).toBe(SIDE_MAX);
    expect(sideWidthAfterKey('End', false, 400, 1100)).toBe(426);
  });

  it('leaves every other key alone', () => {
    expect(sideWidthAfterKey('Enter', false, 400, 1440)).toBeNull();
    expect(sideWidthAfterKey('a', false, 400, 1440)).toBeNull();
    expect(sideWidthAfterKey('Escape', false, 400, 1440)).toBeNull();
  });
});
