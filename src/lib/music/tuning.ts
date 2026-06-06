export const FRET_COUNT = 24;

/** Open-string semitones, high e (index 0) → low E (index 5). */
export const OPEN_STRING_SEMITONES = [4, 11, 7, 2, 9, 4] as const;

/**
 * Open-string absolute MIDI pitches, high e (E4 = 64) → low E (E2 = 40).
 * Matches OPEN_STRING_SEMITONES mod 12. Used for octave-aware ordering.
 */
export const OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40] as const;

/** Absolute MIDI pitch of a fretted note. */
export function midiAt(stringIndex: number, fret: number): number {
  return OPEN_STRING_MIDI[stringIndex] + fret;
}

export const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] as const;

export const STRING_COUNT = OPEN_STRING_SEMITONES.length;
