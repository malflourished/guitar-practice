import type { Box, Point } from './noteTypes';

const round = (value: number) => Math.round(value);

/** Add a pointer position to a stroke, unless it has barely moved. */
export function addPoint(points: Point[], x: number, y: number, minStep = 3): Point[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(x - last[0], y - last[1]) < minStep) return points;
  return [...points, [round(x), round(y)]];
}

/** A stroke as an SVG path, rounded through the midpoints so it reads as a pen line. */
export function strokePath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (rest.length === 0) return `M${first[0]} ${first[1]}l0.01 0`;
  if (rest.length === 1) return `M${first[0]} ${first[1]}L${rest[0][0]} ${rest[0][1]}`;
  let path = `M${first[0]} ${first[1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i];
    const [nextX, nextY] = points[i + 1];
    path += `Q${x} ${y} ${(x + nextX) / 2} ${(y + nextY) / 2}`;
  }
  const last = points[points.length - 1];
  return `${path}L${last[0]} ${last[1]}`;
}

export function boundsOf(strokes: Point[][]): Box | null {
  const points = strokes.flat();
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** A stroke that comes back near where it began: a circle around something. */
export function isLoop(points: Point[]): boolean {
  if (points.length < 4) return false;
  const box = boundsOf([points])!;
  const size = Math.hypot(box.width, box.height);
  const [startX, startY] = points[0];
  const [endX, endY] = points[points.length - 1];
  return size > 12 && Math.hypot(endX - startX, endY - startY) < size * 0.35;
}

/**
 * What a stroke points at: the middle of a loop, or the end of a line, which
 * is where an arrow lands.
 */
export function anchorOf(points: Point[]): { x: number; y: number } {
  if (isLoop(points)) {
    const box = boundsOf([points])!;
    return { x: round(box.x + box.width / 2), y: round(box.y + box.height / 2) };
  }
  const [x, y] = points[points.length - 1];
  return { x, y };
}

/** Keep a floating box of a known size inside the window, below `near` if it fits, else above. */
export function placeBeside(
  near: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
): { left: number; top: number } {
  const edge = 8;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const left = clamp(near.x, edge, viewport.width - size.width - edge);
  const below = near.y + near.height + gap;
  if (below + size.height <= viewport.height - edge) return { left, top: below };
  const above = near.y - gap - size.height;
  if (above >= edge) return { left, top: above };
  // No room above or below: sit beside it.
  const right = near.x + near.width + gap;
  const beside =
    right + size.width <= viewport.width - edge ? right : near.x - gap - size.width;
  return {
    left: clamp(beside, edge, viewport.width - size.width - edge),
    top: clamp(near.y, edge, viewport.height - size.height - edge),
  };
}
