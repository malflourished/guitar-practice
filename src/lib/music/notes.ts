import type { NoteName } from '../../types/music';

/**
 * The 12 semitones of Western music. On guitar, each fret advances one entry
 * in this cycle. E→F and B→C have no sharp/flat between them (1-fret gaps).
 * C#/Db, D#/Eb, etc. are enharmonic — same fret, we label with sharps.
 */
export const CHROMATIC: NoteName[] = [
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

export const NATURAL_NOTES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const ACCIDENTAL_NOTES: NoteName[] = ['C#', 'D#', 'F#', 'G#', 'A#'];

/** Flat-name equivalents for display (same pitch as the sharp). */
export const ENHARMONIC_FLAT: Partial<Record<NoteName, string>> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

export function semitoneToNote(semitone: number): NoteName {
  return CHROMATIC[((semitone % 12) + 12) % 12];
}

export function noteToSemitone(note: NoteName): number {
  return CHROMATIC.indexOf(note);
}

export type NotationPreference = 'sharps' | 'flats';

export function isAccidental(note: NoteName): boolean {
  return note.includes('#');
}

export function formatNoteDisplay(
  note: NoteName,
  preference: NotationPreference,
): string {
  if (preference === 'flats') {
    return ENHARMONIC_FLAT[note] ?? note;
  }
  return note;
}
