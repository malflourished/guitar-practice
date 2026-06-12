import type { KeyMode, NoteName } from '../../types/music';
import type { NotationPreference } from './notes';
import { CHROMATIC, ENHARMONIC_FLAT, noteToSemitone, semitoneToNote } from './notes';

/** Major keys in circle-of-fifths order, clockwise from C at the top. */
export const CIRCLE_MAJOR_KEYS: NoteName[] = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'G#',
  'D#',
  'A#',
  'F',
];

export interface CircleKeyEntry {
  major: NoteName;
  relativeMinor: NoteName;
  sharpCount: number;
  flatCount: number;
}

export function getCircleKeyEntries(): CircleKeyEntry[] {
  return CIRCLE_MAJOR_KEYS.map((major, index) => {
    const sharpCount = index <= 6 ? index : 0;
    const flatCount = index >= 6 ? 12 - index : 0;
    const relativeMinor = semitoneToNote(noteToSemitone(major) + 9);
    return { major, relativeMinor, sharpCount, flatCount };
  });
}

export function getRelativeMinor(major: NoteName): NoteName {
  return semitoneToNote(noteToSemitone(major) + 9);
}

export function getRelativeMajor(minor: NoteName): NoteName {
  return semitoneToNote(noteToSemitone(minor) + 3);
}

export function usesFlatCircleSpelling(entry: CircleKeyEntry): boolean {
  return entry.flatCount > 0 && entry.sharpCount === 0;
}

/** Spell each key by its circle position — flats on the flat side, sharps on the sharp side. */
export function formatCircleKeyLabel(
  note: NoteName,
  entry: CircleKeyEntry,
): string {
  if (usesFlatCircleSpelling(entry)) {
    return ENHARMONIC_FLAT[note] ?? note;
  }
  return note;
}

export function formatCircleKey(
  note: NoteName,
  notation: NotationPreference,
): string {
  if (notation === 'flats') {
    return ENHARMONIC_FLAT[note] ?? note;
  }
  return note;
}

export function getAccidentalLabel(entry: CircleKeyEntry): string {
  if (entry.sharpCount > 0) {
    return `${entry.sharpCount}♯`;
  }
  if (entry.flatCount > 0) {
    return `${entry.flatCount}♭`;
  }
  return 'none';
}

/** Accidentals in the order they accumulate in sharp key signatures. */
export const SHARP_SIGNATURE_LABELS = [
  'F♯',
  'C♯',
  'G♯',
  'D♯',
  'A♯',
  'E♯',
  'B♯',
] as const;

/** Accidentals in the order they accumulate in flat key signatures. */
export const FLAT_SIGNATURE_LABELS = [
  'B♭',
  'E♭',
  'A♭',
  'D♭',
  'G♭',
  'C♭',
  'F♭',
] as const;

export function isEnharmonicCircleIndex(index: number): boolean {
  return index === 5 || index === 6 || index === 7;
}

export function getSharpSignatureLabels(count: number): string[] {
  return SHARP_SIGNATURE_LABELS.slice(0, count);
}

export function getFlatSignatureLabels(count: number): string[] {
  return FLAT_SIGNATURE_LABELS.slice(0, count);
}

function displayNote(note: NoteName): string {
  return note.replace('#', '♯');
}

function displayFlatNote(note: NoteName): string {
  const flat = ENHARMONIC_FLAT[note];
  if (flat) {
    return flat.replace('b', '♭');
  }
  return displayNote(note);
}

export interface CircleKeyDisplay {
  major: string;
  minor: string;
  majorAlt?: string;
  minorAlt?: string;
}

/** Major/minor labels as shown on a textbook circle (with enharmonic pairs at the bottom). */
export function getCircleKeyDisplay(
  entry: CircleKeyEntry,
  index: number,
): CircleKeyDisplay {
  if (index === 5) {
    return {
      major: 'B',
      majorAlt: 'C♭',
      minor: 'G♯m',
      minorAlt: 'A♭m',
    };
  }
  if (index === 6) {
    return {
      major: 'G♭',
      majorAlt: 'F♯',
      minor: 'E♭m',
      minorAlt: 'D♯m',
    };
  }
  if (index === 7) {
    return {
      major: 'D♭',
      majorAlt: 'C♯',
      minor: 'B♭m',
      minorAlt: 'A♯m',
    };
  }

  const major = usesFlatCircleSpelling(entry)
    ? displayFlatNote(entry.major)
    : displayNote(entry.major);
  const minor = usesFlatCircleSpelling(entry)
    ? `${displayFlatNote(entry.relativeMinor)}m`
    : `${displayNote(entry.relativeMinor)}m`;

  return { major, minor };
}

export interface CircleKeySignatures {
  sharp?: string[];
  flat?: string[];
}

/** Key-signature accidentals for the middle ring of the circle diagram. */
export function getCircleKeySignatures(
  entry: CircleKeyEntry,
  index: number,
): CircleKeySignatures {
  if (isEnharmonicCircleIndex(index)) {
    const flatCount = index === 5 ? 7 : index === 6 ? 6 : 5;
    return {
      sharp: getSharpSignatureLabels(entry.sharpCount),
      flat: getFlatSignatureLabels(flatCount),
    };
  }
  if (entry.sharpCount > 0) {
    return { sharp: getSharpSignatureLabels(entry.sharpCount) };
  }
  if (entry.flatCount > 0) {
    return { flat: getFlatSignatureLabels(entry.flatCount) };
  }
  return {};
}

export function findCircleEntry(
  note: NoteName,
  keyMode: KeyMode,
): CircleKeyEntry | undefined {
  const entries = getCircleKeyEntries();
  if (keyMode === 'major') {
    return entries.find((entry) => entry.major === note);
  }
  return entries.find((entry) => entry.relativeMinor === note);
}

/** Next key clockwise on the circle (adds a sharp / removes a flat). */
export function nextCircleKey(note: NoteName): NoteName {
  const index = CIRCLE_MAJOR_KEYS.indexOf(note);
  if (index === -1) return note;
  return CIRCLE_MAJOR_KEYS[(index + 1) % CIRCLE_MAJOR_KEYS.length];
}

/** Previous key counter-clockwise on the circle. */
export function prevCircleKey(note: NoteName): NoteName {
  const index = CIRCLE_MAJOR_KEYS.indexOf(note);
  if (index === -1) return note;
  return CIRCLE_MAJOR_KEYS[(index + 11) % CIRCLE_MAJOR_KEYS.length];
}

export function isOnCircle(note: NoteName): boolean {
  return CIRCLE_MAJOR_KEYS.includes(note);
}

/** All 12 pitch classes as spelled in chromatic order — useful for the "12 notes" topic. */
export function chromaticLabels(notation: NotationPreference): string[] {
  return CHROMATIC.map((note) => formatCircleKey(note, notation));
}
