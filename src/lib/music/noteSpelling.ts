import type {
  ChordQuality,
  Letter,
  NoteName,
  ScaleQuality,
  SpelledNote,
} from '../../types/music';
import { getChordIntervals, getChordLetterSteps } from './chords';
import { semitoneToNote } from './notes';
import type { NotationPreference } from './notes';
import { getScaleIntervals, getScaleLetterSteps } from './scales';

/** Letters in pitch order starting from C. */
const LETTER_ORDER: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const LETTER_SEMITONE: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ACCIDENTAL_SYMBOL: Record<number, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  [0]: '',
  [1]: '#',
  [2]: '##',
};

export function pitchClassOf(note: SpelledNote): number {
  return ((LETTER_SEMITONE[note.letter] + note.accidental) % 12 + 12) % 12;
}

export function formatSpelled(note: SpelledNote): string {
  return `${note.letter}${ACCIDENTAL_SYMBOL[note.accidental] ?? ''}`;
}

/** Smallest accidental that turns `letter` into the target pitch class. */
function accidentalFor(letter: Letter, targetPitchClass: number): number {
  const base = LETTER_SEMITONE[letter];
  let diff = ((targetPitchClass - base) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  return diff;
}

/**
 * Convert a pitch-class root (from the note pad) into a spelled root,
 * using the sharps/flats preference to disambiguate accidental keys
 * (e.g. C# vs Db).
 */
export function spelledRootFromNoteName(
  note: NoteName,
  preference: NotationPreference,
): SpelledNote {
  if (!note.includes('#')) {
    return { letter: note as Letter, accidental: 0 };
  }

  const naturalLetter = note[0] as Letter;
  if (preference === 'sharps') {
    return { letter: naturalLetter, accidental: 1 };
  }

  // Flats: spell as the next letter lowered (C# -> Db, F# -> Gb, etc.).
  const nextLetter =
    LETTER_ORDER[(LETTER_ORDER.indexOf(naturalLetter) + 1) % 7];
  return { letter: nextLetter, accidental: -1 };
}

/**
 * Spell a set of intervals by assigning each tone the letter at its given
 * letter step (relative to the root), with the accidental chosen to match the
 * target pitch. Works for scales, modes, blues, and chords alike.
 */
function spellByLetterSteps(
  root: SpelledNote,
  intervals: number[],
  letterSteps: number[],
): SpelledNote[] {
  const rootLetterIndex = LETTER_ORDER.indexOf(root.letter);
  const rootPitch = pitchClassOf(root);

  return intervals.map((interval, i) => {
    const letter = LETTER_ORDER[(rootLetterIndex + letterSteps[i]) % 7];
    const targetPitch = (rootPitch + interval) % 12;
    return { letter, accidental: accidentalFor(letter, targetPitch) };
  });
}

export function spellChord(
  root: SpelledNote,
  quality: ChordQuality,
): SpelledNote[] {
  return spellByLetterSteps(
    root,
    getChordIntervals(quality),
    getChordLetterSteps(quality),
  );
}

export function getSpelledScaleNotes(
  root: SpelledNote,
  quality: ScaleQuality,
): SpelledNote[] {
  return spellByLetterSteps(
    root,
    getScaleIntervals(quality),
    getScaleLetterSteps(quality),
  );
}

export function getSpelledChordNotes(
  root: SpelledNote,
  quality: ChordQuality,
): SpelledNote[] {
  return spellChord(root, quality);
}

/**
 * Map each pitch class (keyed by its sharp NoteName) to the correctly
 * spelled label for the active key. Used to label fretboard markers.
 */
export function buildSpellingMap(
  spelled: SpelledNote[],
): Map<NoteName, string> {
  const map = new Map<NoteName, string>();
  for (const note of spelled) {
    const pitchClassNote = semitoneToNote(pitchClassOf(note));
    map.set(pitchClassNote, formatSpelled(note));
  }
  return map;
}
