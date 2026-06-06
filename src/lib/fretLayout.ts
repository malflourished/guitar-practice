import { FRET_COUNT } from './music';

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
