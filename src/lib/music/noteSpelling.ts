import type {
  ChordQuality,
  KeyMode,
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

/** The other name of a black-key root (C# and Db), or null for any other note. */
function enharmonicRoot(root: SpelledNote): SpelledNote | null {
  const index = LETTER_ORDER.indexOf(root.letter);
  if (root.accidental === 1 && root.letter !== 'E' && root.letter !== 'B') {
    return { letter: LETTER_ORDER[(index + 1) % 7], accidental: -1 };
  }
  if (root.accidental === -1 && root.letter !== 'F' && root.letter !== 'C') {
    return { letter: LETTER_ORDER[(index + 6) % 7], accidental: 1 };
  }
  return null;
}

function accidentalTotal(notes: SpelledNote[]): number {
  return notes.reduce((sum, note) => sum + Math.abs(note.accidental), 0);
}

/**
 * Spell a scale or chord, renaming a black-key root to its other name when
 * that needs fewer accidentals. A# major becomes Bb major (two flats instead
 * of A#, B#, C##, D#, E#, F##, G##), and C# minor stays C# minor rather than
 * Db minor with Fb and Bbb. That is the circle of fifths' choice. On a tie
 * (F# or Gb major, D# or Eb minor) the root keeps the name it came in with,
 * which follows the sharps/flats preference.
 */
function spellWithBestRoot(
  root: SpelledNote,
  intervals: number[],
  letterSteps: number[],
): SpelledNote[] {
  const spelled = spellByLetterSteps(root, intervals, letterSteps);
  const other = enharmonicRoot(root);
  if (!other) return spelled;
  const otherSpelled = spellByLetterSteps(other, intervals, letterSteps);
  return accidentalTotal(otherSpelled) < accidentalTotal(spelled)
    ? otherSpelled
    : spelled;
}

export function spellChord(
  root: SpelledNote,
  quality: ChordQuality,
): SpelledNote[] {
  return spellWithBestRoot(
    root,
    getChordIntervals(quality),
    getChordLetterSteps(quality),
  );
}

export function getSpelledScaleNotes(
  root: SpelledNote,
  quality: ScaleQuality,
): SpelledNote[] {
  return spellWithBestRoot(
    root,
    getScaleIntervals(quality),
    getScaleLetterSteps(quality),
  );
}

/** A chord root's name, spelled the way its chord reads best (Bb, not A#, for a major chord). */
export function formatChordRoot(
  root: NoteName,
  quality: ChordQuality,
  preference: NotationPreference,
): string {
  return formatSpelled(spellChord(spelledRootFromNoteName(root, preference), quality)[0]);
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

/**
 * Spell the notes of a key by its own scale (C minor gives Eb, Ab, Bb; E major
 * gives F#, G#), the way the fretboard labels do. Keyed by sharp NoteName.
 */
export function getKeySpellingMap(
  keyRoot: NoteName,
  keyMode: KeyMode,
  preference: NotationPreference,
): Map<NoteName, string> {
  const spelledRoot = spelledRootFromNoteName(keyRoot, preference);
  return buildSpellingMap(getSpelledScaleNotes(spelledRoot, keyMode));
}

/** Letter steps above the tonic for each chromatic offset: ♭II is a 2nd, ♭VI a 6th, ♭VII a 7th. */
const OFFSET_LETTER_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/**
 * Name the note `offset` semitones above a key's tonic by its scale degree's
 * letter (♭VII in D is C, ♭II in C is Db), or undefined when that would need a
 * double accidental and the plain chord spelling reads better.
 */
export function spellOffsetFromKey(
  keyRoot: NoteName,
  keyMode: KeyMode,
  offset: number,
  preference: NotationPreference,
): string | undefined {
  const tonic = getSpelledScaleNotes(
    spelledRootFromNoteName(keyRoot, preference),
    keyMode,
  )[0];
  const steps = ((offset % 12) + 12) % 12;
  const letter =
    LETTER_ORDER[(LETTER_ORDER.indexOf(tonic.letter) + OFFSET_LETTER_STEPS[steps]) % 7];
  const accidental = accidentalFor(letter, (pitchClassOf(tonic) + steps) % 12);
  return Math.abs(accidental) > 1 ? undefined : formatSpelled({ letter, accidental });
}
