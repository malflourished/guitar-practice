import type { NoteName } from '../types/music';

/** Chromatic note color palette. */
export const NOTE_COLORS: Record<NoteName, string> = {
  C: '#F5CF00', // Yellow
  'C#': '#D4A800', // Amber
  D: '#28A83C', // Green
  'D#': '#147038', // Forest
  E: '#19ACAA', // Teal
  F: '#2088E0', // Blue
  'F#': '#0A40C0', // Dark blue
  G: '#8B2BBF', // Purple
  'G#': '#B0186A', // Magenta
  A: '#D81E1E', // Red
  'A#': '#AA1212', // Crimson
  B: '#A84800', // Orange — kept below bright-key contrast threshold
};

/** All 12 chromatic notes in order. */
export const ALL_NOTES: NoteName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
