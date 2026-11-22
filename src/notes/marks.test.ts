import { describe, expect, it } from 'vitest';
import { addPoint, anchorOf, boundsOf, isLoop, placeBeside, strokePath } from './marks';
import type { Point } from './noteTypes';

/** A circle of 24 points, drawn all the way round. */
const circle = (cx: number, cy: number, r: number): Point[] =>
  Array.from({ length: 25 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    return [Math.round(cx + r * Math.cos(angle)), Math.round(cy + r * Math.sin(angle))];
  });

const arrow: Point[] = [[1200, 900], [1150, 940], [1110, 960], [1085, 968]];

describe('addPoint', () => {
  it('keeps a point that has moved and rounds it', () => {
    expect(addPoint([[10, 10]], 14.4, 10.2)).toEqual([[10, 10], [14, 10]]);
  });

  it('drops a point that has barely moved', () => {
    const points: Point[] = [[10, 10]];
    expect(addPoint(points, 11, 11)).toBe(points);
  });
});

describe('strokePath', () => {
  it('draws a line through two points and a curve through more', () => {
    expect(strokePath([[0, 0], [10, 0]])).toBe('M0 0L10 0');
    expect(strokePath([[0, 0], [10, 0], [20, 10]])).toBe('M0 0Q10 0 15 5L20 10');
  });

  it('still draws a dot', () => {
    expect(strokePath([[5, 5]])).toMatch(/^M5 5l/);
    expect(strokePath([])).toBe('');
  });
});

describe('boundsOf', () => {
  it('covers every stroke', () => {
    expect(boundsOf([[[10, 20], [30, 40]], [[5, 60]]])).toEqual({ x: 5, y: 20, width: 25, height: 40 });
  });

  it('is nothing for no strokes', () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe('what a stroke points at', () => {
  it('a circle points at its middle', () => {
    const loop = circle(1093, 400, 90);
    expect(isLoop(loop)).toBe(true);
    const at = anchorOf(loop);
    expect(Math.abs(at.x - 1093)).toBeLessThanOrEqual(1);
    expect(Math.abs(at.y - 400)).toBeLessThanOrEqual(1);
  });

  it('an arrow points at its end', () => {
    expect(isLoop(arrow)).toBe(false);
    expect(anchorOf(arrow)).toEqual({ x: 1085, y: 968 });
  });

  it('a short tick is not a circle', () => {
    expect(isLoop([[0, 0], [3, 1], [5, 2], [2, 1]])).toBe(false);
  });
});

describe('placeBeside', () => {
  const viewport = { width: 1440, height: 900 };
  const size = { width: 300, height: 172 };

  it('sits under the thing when there is room', () => {
    expect(placeBeside({ x: 400, y: 300, width: 80, height: 40 }, size, viewport)).toEqual({ left: 400, top: 352 });
  });

  it('goes above at the bottom of the window', () => {
    expect(placeBeside({ x: 400, y: 800, width: 80, height: 40 }, size, viewport)).toEqual({ left: 400, top: 616 });
  });

  it('stays inside the right edge', () => {
    expect(placeBeside({ x: 1400, y: 300, width: 30, height: 30 }, size, viewport).left).toBe(1132);
  });

  it('sits beside something as tall as the window', () => {
    const at = placeBeside({ x: 1100, y: 40, width: 320, height: 840 }, size, viewport);
    expect(at).toEqual({ left: 788, top: 40 });
  });
});
