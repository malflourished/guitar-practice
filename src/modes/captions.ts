import {
  CHORD_GUIDE,
  SCALE_GUIDE,
  formatSpelled,
  getChordQualityLabel,
  getQualityLabel,
  getSpelledChordNotes,
  getSpelledScaleNotes,
  spelledRootFromNoteName,
  type NotationPreference,
} from '../lib/music';
import type { ChordQuality, NoteName, ScaleQuality } from '../types/music';

const MODE_NAMES = new Set<ScaleQuality>(['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian']);

/** What a deck's caption shows: a name, a formula, the notes in this key, one line. */
export interface Caption {
  name: string;
  formula: string;
  notes: string;
  line: string;
}

/** The chord's name, formula, notes in this key and its one line. */
export function chordCaption(
  root: NoteName,
  quality: ChordQuality,
  notation: NotationPreference,
): Caption {
  const spelledRoot = spelledRootFromNoteName(root, notation);
  const notes = getSpelledChordNotes(spelledRoot, quality).map(formatSpelled);
  return {
    name: `${notes[0]} ${getChordQualityLabel(quality).toLowerCase()}`,
    formula: CHORD_GUIDE[quality].formula,
    notes: notes.join(' '),
    line: CHORD_GUIDE[quality].sound,
  };
}

/** The scale's name, formula, notes in this key and its one line. */
export function scaleCaption(
  root: NoteName,
  quality: ScaleQuality,
  notation: NotationPreference,
): Caption {
  const spelledRoot = spelledRootFromNoteName(root, notation);
  const notes = getSpelledScaleNotes(spelledRoot, quality).map(formatSpelled);
  const { alias, formula, line } = SCALE_GUIDE[quality];
  // "A minor pentatonic", but "D Dorian": the modes are proper names.
  const label = MODE_NAMES.has(quality)
    ? getQualityLabel(quality)
    : getQualityLabel(quality).toLowerCase();
  return {
    name: `${notes[0]} ${label}${alias ? ` (${alias})` : ''}`,
    formula,
    notes: notes.join(' '),
    line,
  };
}
