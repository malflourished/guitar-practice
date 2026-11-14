import { NECK_FRETS } from './music/neckChordMap';
import { STRING_COUNT } from './music/tuning';

/*
 * Where everything sits on the vertical neck (Theory › Neck, package H2).
 * Pure: it takes the stage's size in px and returns positions in px, so the
 * size rule is easy to test. The figure is drawn 1:1, no scaling.
 *
 * The rule (docs/specs/H2-vertical-neck.md, "Size"): frets 0 to 12 are always
 * shown, spaced like a real neck (each space about 0.944 of the one above),
 * and no fret space is under 1.15 × the marker's diameter. Where space runs
 * short, the markers shrink from 27 px towards 20 px first, and only then does
 * the spacing blend towards even.
 */

/** Marker diameter in px where there is room, and the least before the spacing gives way. */
export const MARKER_MAX = 27;
export const MARKER_MIN = 20;
/** The least a fret space may be, as a share of the marker's diameter. */
export const FRET_ROOM = 1.15;
/** Only a stage far shorter than the app's smallest window (960×640) goes below MARKER_MIN. */
const MARKER_FLOOR = 12;

/**
 * Margins above the open-string row and under the board, in px at MARKER_MAX
 * markers; all of them scale with the markers. Taken from the approved
 * mock-up (docs/design/theory-neck/).
 */
const NAME_Y = 30;
const OPEN_TOP = 48.5;
const OPEN_TO_NUT = 10.5;
const LEGEND_BOTTOM = 20.5;
const BOARD_TO_LEGEND = 32.5;
const MARGIN = OPEN_TOP + OPEN_TO_NUT + LEGEND_BOTTOM + BOARD_TO_LEGEND;

/** px of margin per px of marker, so the whole figure shrinks with its markers. */
const MARGIN_PER_MARKER = MARGIN / MARKER_MAX;

/** The fraction of the board's length that fret `n` sits at: 0 at the nut, 1 at fret 12. */
export function fretFraction(n: number, blend = 0): number {
  const real = 2 * (1 - 2 ** (-n / 12));
  return (1 - blend) * real + (blend * n) / NECK_FRETS;
}

/** The last fret space as a share of the board when the spacing is graduated (about 0.0595). */
const LAST_SPACE = fretFraction(NECK_FRETS) - fretFraction(NECK_FRETS - 1);

const floorQuarter = (value: number) => Math.floor(value * 4) / 4;

export interface VerticalNeckLayout {
  width: number;
  height: number;
  /** Marker diameter and radius in px: 27 down to 20 (less only in a stage far too short). */
  markerD: number;
  markerR: number;
  /** 0: the spacing of a real neck. 1: even. */
  blend: number;
  /** The markers' size as a share of MARKER_MAX: the margins and text follow it. */
  scale: number;
  stringGap: number;
  /** x of each string by the app's string index: [0] is the high e (right), [5] the low E (left). */
  stringX: number[];
  /** Where the neck's middle falls: the inlays sit here. */
  centerX: number;
  /** The fret wires run from here to there; fret numbers are right-aligned at numberX. */
  boardLeft: number;
  boardRight: number;
  numberX: number;
  /** Baseline of the string names. */
  nameY: number;
  /** Middle of the open-string markers. */
  openY: number;
  /** fretY[0] is the nut, fretY[1] to fretY[12] the fret wires. */
  fretY: number[];
  /** markerY[0] is the open-string row above the nut; markerY[n] is the middle of fret space n. */
  markerY: number[];
  /** Middle of the legend row. */
  legendY: number;
}

/** The markers' diameter and the spacing blend that fit a stage `height` px tall. */
function fitMarkers(height: number): { markerD: number; blend: number } {
  const perMarker = MARGIN_PER_MARKER + 2;
  // 1. Real spacing, markers as large as the rule allows (27 down to 20).
  const graduated = height / (perMarker + FRET_ROOM / LAST_SPACE);
  if (graduated >= MARKER_MIN) {
    return { markerD: Math.min(MARKER_MAX, floorQuarter(graduated)), blend: 0 };
  }
  // 2. Markers at 20 px: blend the spacing towards even, just enough.
  const board = height - perMarker * MARKER_MIN;
  const need = FRET_ROOM * MARKER_MIN;
  const realLeast = LAST_SPACE * board;
  const evenLeast = board / NECK_FRETS;
  if (evenLeast >= need) {
    const blend = (need - realLeast) / (evenLeast - realLeast);
    return { markerD: MARKER_MIN, blend: Math.min(1, Math.max(0, Math.ceil(blend * 1000) / 1000)) };
  }
  // 3. Not even that fits (a stage under about 400 px): the markers shrink further, so the rule still holds.
  const evenFit = height / (perMarker + FRET_ROOM * NECK_FRETS);
  return { markerD: Math.max(MARKER_FLOOR, floorQuarter(evenFit)), blend: 1 };
}

/** Everything's position on a stage `height` px tall and `width` px wide. */
export function verticalNeckLayout(height: number, width: number): VerticalNeckLayout {
  const { markerD, blend } = fitMarkers(height);
  const markerR = markerD / 2;
  const scale = markerD / MARKER_MAX;

  const nameY = NAME_Y * scale;
  const openY = OPEN_TOP * scale + markerR;
  const nutY = openY + markerR + OPEN_TO_NUT * scale;
  const legendY = height - (LEGEND_BOTTOM * scale + markerR);
  const endY = legendY - markerR - BOARD_TO_LEGEND * scale;
  const board = endY - nutY;

  const fretY = Array.from({ length: NECK_FRETS + 1 }, (_, n) => nutY + board * fretFraction(n, blend));
  const markerY = fretY.map((y, n) => (n === 0 ? openY : (fretY[n - 1] + y) / 2));

  // The strings: wider with the stage, but never so close that markers touch.
  const roomForStrings = (width - 64) / (STRING_COUNT - 1);
  const stringGap = Math.max(markerD + 6, Math.min(54, Math.max(40, width * 0.085), roomForStrings));
  const neckWidth = (STRING_COUNT - 1) * stringGap;
  // The 10 px shifts the neck right to balance the fret numbers on its left.
  const lowE = (width - neckWidth) / 2 + 10;
  const stringX = Array.from({ length: STRING_COUNT }, (_, string) => lowE + (STRING_COUNT - 1 - string) * stringGap);

  return {
    width,
    height,
    markerD,
    markerR,
    blend,
    scale,
    stringGap,
    stringX,
    centerX: lowE + neckWidth / 2,
    boardLeft: lowE - 8,
    boardRight: lowE + neckWidth + 8,
    numberX: lowE - 28,
    nameY,
    openY,
    fretY,
    markerY,
    legendY,
  };
}

/** Advance widths in em of what a numeral is spelled with (Inter at the weight the markers use). */
const NUMERAL_EM: Record<string, number> = {
  I: 0.29,
  V: 0.79,
  i: 0.3,
  v: 0.63,
  '♭': 0.7,
  '°': 0.46,
  '/': 0.41,
};

/** The em width of a numeral such as "vii°" or "V/iii" (a safe upper figure). */
export function numeralEm(label: string): number {
  return [...label].reduce((sum, ch) => sum + (NUMERAL_EM[ch] ?? 0.8), 0);
}

/** A numeral's share of the marker it must fit inside. */
const NUMERAL_SPAN = 0.84;

/**
 * Font size in px for a numeral in a marker `markerD` px across: 11 for one or
 * two characters and 9.5 for longer ones at full size, shrinking with the
 * marker, and smaller still wherever the label would not fit ("V/iii").
 */
export function numeralFontSize(label: string, markerD: number): number {
  const base = (label.length >= 3 ? 9.5 : 11) * (markerD / MARKER_MAX) ** 0.6;
  const fit = (NUMERAL_SPAN * markerD) / numeralEm(label);
  return Math.round(Math.min(base, fit) * 10) / 10;
}

/** The legend's words are 11 px, lowercase and slightly tracked. */
export const LEGEND_FONT = 11;
const LEGEND_EM = 0.62;
const LEGEND_MARKER_TO_WORD = 8;

export interface LegendLayout {
  /** Centre of each item's marker, and where its word starts. */
  markerX: number[];
  wordX: number[];
  /** The row's width from first marker edge to last word end, before `fit`. */
  total: number;
  /**
   * 1 where the row fits. In a stage too narrow for it (a window between the
   * app's smallest and about 1200 px wide, with the side panel docked) the row
   * is drawn at this share of its size about `centerX`, so it stays one line
   * inside the figure.
   */
  fit: number;
}

/** One line of legend items, centred on `centerX`; the gaps give way first if the row is wide. */
export function legendLayout(
  words: string[],
  markerD: number,
  width: number,
  centerX = width / 2,
): LegendLayout {
  const widths = words.map((word) => markerD + LEGEND_MARKER_TO_WORD + word.length * LEGEND_FONT * LEGEND_EM);
  const content = widths.reduce((sum, w) => sum + w, 0);
  const idealGap = 20 * (markerD / MARKER_MAX);
  const gap = Math.max(8, Math.min(idealGap, (width - 16 - content) / Math.max(1, words.length - 1)));
  const total = content + gap * (words.length - 1);
  let x = centerX - total / 2;
  const markerX: number[] = [];
  const wordX: number[] = [];
  widths.forEach((w) => {
    markerX.push(x + markerD / 2);
    wordX.push(x + markerD + LEGEND_MARKER_TO_WORD);
    x += w + gap;
  });
  return { markerX, wordX, total, fit: Math.min(1, (width - 8) / total) };
}
