import { FRET_COUNT, STRING_COUNT } from './music';

/** Non-scaling layout dimensions in SVG units. */
export const FRETBOARD_LAYOUT = {
  nutWidth: 28,
  leftPadding: 64,
  rightPadding: 16,
  stringGap: 36,
  topPadding: 36,
  bottomPadding: 16,
  markerRadius: 4,
  maxNoteRadius: 14,
  /** Center X for open-string / muted markers, left of the nut. */
  openLaneX: 40,
  stringLabelX: 14,
} as const;

/** Room under the strings for the CAGED / position letters. */
export const BADGE_ROW_HEIGHT = 24;

/**
 * Board height at scale 1 with the badge row. A board that fills the neck
 * always reserves the badge row, so the strings sit at the same height in
 * every mode, with or without letters.
 */
export const BASE_BOARD_HEIGHT =
  FRETBOARD_LAYOUT.topPadding +
  (STRING_COUNT - 1) * FRETBOARD_LAYOUT.stringGap +
  FRETBOARD_LAYOUT.bottomPadding +
  8 +
  BADGE_ROW_HEIGHT;

/** Only reached in windows smaller than the app's minimum (960×640). */
export const MIN_BOARD_SCALE = 0.8;
export const MAX_STRING_GAP = 64;

/**
 * Largest string gap for a window this wide, so the neck grows with the
 * window instead of only with its height: 36 px at 960, about 55 at 1440,
 * and 64 from about 1660 up.
 */
export function maxStringGap(viewportWidth: number): number {
  return Math.min(
    MAX_STRING_GAP,
    Math.max(FRETBOARD_LAYOUT.stringGap, viewportWidth / 26),
  );
}

/**
 * Vertical scale of a board that fills `availableHeight`: 1 is the old fixed
 * board (36 px string gap), capped by `maxStringGap` for the window width.
 */
export function boardScale(availableHeight: number, viewportWidth: number): number {
  const cap = maxStringGap(viewportWidth) / FRETBOARD_LAYOUT.stringGap;
  const fit = availableHeight / BASE_BOARD_HEIGHT;
  return Math.min(cap, Math.max(MIN_BOARD_SCALE, fit));
}

/** Dots and letters grow more slowly than the string gap. */
export function labelScale(scale: number): number {
  return 1 + (scale - 1) * 0.6;
}

/**
 * Default scale length (nut to bridge) in SVG units.
 * Fret positions follow: distance(n) = scaleLength × (1 − 2^(−n/12))
 */
export const SCALE_LENGTH = 1400;

const { leftPadding, nutWidth, rightPadding } = FRETBOARD_LAYOUT;

export function fixedBoardWidth(): number {
  return leftPadding + nutWidth + rightPadding;
}

/** Derive scale length so the full diagram fills targetWidth. */
export function scaleLengthForTargetWidth(
  targetWidth: number,
  fretCount = FRET_COUNT,
): number {
  const playable = targetWidth - fixedBoardWidth();
  if (playable <= 0) return SCALE_LENGTH;
  const fretRatio = 1 - 2 ** (-fretCount / 12);
  return playable / fretRatio;
}

export function totalBoardWidth(
  scaleLength = SCALE_LENGTH,
  fretCount = FRET_COUNT,
): number {
  return fixedBoardWidth() + boardPlayableWidth(fretCount, scaleLength);
}

/** Distance from the nut to fret wire n (n = 0 at nut). */
export function fretDistanceFromNut(
  fret: number,
  scaleLength = SCALE_LENGTH,
): number {
  if (fret <= 0) return 0;
  return scaleLength * (1 - 2 ** (-fret / 12));
}

/** Center of the playing area for fret n (between wires n−1 and n). */
export function fretCenterOffset(fret: number, scaleLength = SCALE_LENGTH): number {
  const prev = fretDistanceFromNut(fret - 1, scaleLength);
  const curr = fretDistanceFromNut(fret, scaleLength);
  return (prev + curr) / 2;
}

/** Width of the playing area between fret wires n−1 and n. */
export function fretSpaceWidth(
  fret: number,
  scaleLength = SCALE_LENGTH,
): number {
  return (
    fretDistanceFromNut(fret, scaleLength) -
    fretDistanceFromNut(fret - 1, scaleLength)
  );
}

/** Pixel width of the board from nut through the last fret wire. */
export function boardPlayableWidth(
  fretCount = FRET_COUNT,
  scaleLength = SCALE_LENGTH,
): number {
  return fretDistanceFromNut(fretCount, scaleLength);
}
