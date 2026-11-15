/**
 * How wide the docked side panel may be (roadmap package Q).
 *
 * The panel is docked only in windows of 1100 px and wider and 680 px and
 * taller; below that it is a drawer over the neck, and a drawer has no width
 * to set. So the limits only have to keep the neck usable at 1100 px, the
 * narrowest window that docks: there the panel can grow to 426 px and the
 * neck keeps 640 px. Keep these in step with `--side-max` and
 * `--side-default` in Frame.module.css (the CSS clamps the same numbers, so
 * a saved width can never crowd the neck, even in a window that shrank).
 */

export const SIDE_MIN = 280;
export const SIDE_MAX = 520;
/** The narrowest the neck may get beside a docked panel. */
export const NECK_MIN = 640;
/** The frame's padding on both sides plus the gap beside the panel. */
const FRAME_EDGES = 2 * 12 + 10;
/** One arrow key press; Shift takes the larger step. */
export const SIDE_STEP = 16;
export const SIDE_STEP_LARGE = 64;

export interface SideWidthLimits {
  min: number;
  max: number;
}

/** The widest and narrowest the panel may be in a window this wide. */
export function sideWidthLimits(windowWidth: number): SideWidthLimits {
  const roomy = Math.floor(windowWidth - FRAME_EDGES - NECK_MIN);
  return { min: SIDE_MIN, max: Math.max(SIDE_MIN, Math.min(SIDE_MAX, roomy)) };
}

/** A width brought inside the limits, in whole pixels. */
export function clampSideWidth(width: number, windowWidth: number): number {
  const { min, max } = sideWidthLimits(windowWidth);
  if (!Number.isFinite(width)) return min;
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** The width the panel has until it is dragged: 22% of the window, 280 to 340 px. */
export function defaultSideWidth(windowWidth: number): number {
  return Math.round(Math.min(340, Math.max(SIDE_MIN, windowWidth * 0.22)));
}

/** A saved width: nothing yet (the default), or a number inside the absolute limits. */
export function isSideWidth(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= SIDE_MIN &&
      value <= SIDE_MAX)
  );
}

/**
 * What a key does to the panel's width. The panel is on the right, so the
 * edge moves left to widen it: Left widens, Right narrows. Home goes to the
 * narrowest, End to the widest. Anything else is not ours (null).
 */
export function sideWidthAfterKey(
  key: string,
  shift: boolean,
  current: number,
  windowWidth: number,
): number | null {
  const step = shift ? SIDE_STEP_LARGE : SIDE_STEP;
  const { min, max } = sideWidthLimits(windowWidth);
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return clampSideWidth(current + step, windowWidth);
    case 'ArrowRight':
    case 'ArrowDown':
      return clampSideWidth(current - step, windowWidth);
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }
}
