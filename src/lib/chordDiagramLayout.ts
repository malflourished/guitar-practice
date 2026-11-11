import { STRING_COUNT } from './music';

export const L = {
  fretLabel: 14,
  gridPad: 5,
  right: 6,
  markerRow: 17,
  stringGap: 13.5,
  fretGap: 21,
  bottom: 10,
};

export const gridLeft = L.fretLabel + L.gridPad;
export const gridWidth = (STRING_COUNT - 1) * L.stringGap;
export const nutY = L.markerRow + 9;
export const VIEW_WIDTH = gridLeft + gridWidth + L.right;

/** Nudge strip labels from item center to the string-grid center (see neckCenterX). */
const CHORD_DIAGRAM_LABEL_SHIFT =
  ((gridLeft + gridWidth / 2) / VIEW_WIDTH - 0.5) * 100;

export const CHORD_DIAGRAM_LABEL_STYLE = {
  transform: `translateX(${CHORD_DIAGRAM_LABEL_SHIFT}%)`,
} as const;

