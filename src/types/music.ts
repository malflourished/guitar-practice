/** All 12 chromatic pitches using sharp names (standard guitar notation). */
export type NoteName =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B';

export interface FretPosition {
  string: number;
  fret: number;
  note: NoteName;
  /** Fretting finger: 1 index, 2 middle, 3 ring, 4 pinky, 0 open. */
  finger?: number;
}

export type StudyMode =
  | 'notes'
  | 'chords'
  | 'scales'
  | 'arpeggios'
  | 'progressions';

/** Major or natural minor — the key context for a progression. */
export type KeyMode = 'major' | 'minor';

/** Educational copy attached to a practice item (progression, scale, etc.). */
export interface TheoryContent {
  title: string;
  /** One or two sentences shown below the fretboard. */
  summary: string;
  /** Longer explanation paragraphs for the sidebar panel. */
  body: string[];
  examples?: { label: string; chords: string }[];
  functions?: { numeral: string; role: string }[];
}

/** One chord in a progression formula (Roman numeral + quality). */
export interface ProgressionStepDef {
  /** Scale degree 1–7 in the active key. */
  degree: number;
  quality: ChordQuality;
  /** Display numeral, e.g. "I", "vi", "ii⁷". */
  numeral: string;
}

export interface ProgressionDef {
  id: string;
  label: string;
  nickname?: string;
  keyMode: KeyMode;
  category: string;
  steps: ProgressionStepDef[];
  theory: TheoryContent;
}

/**
 * Position layout system for diatonic scales.
 * - `3nps`: three notes per string, 7 positions (cleanest, gap-free by design)
 * - `caged`: 5 box shapes (pentatonic box + the two diatonic passing tones)
 */
export type ScaleSystem = '3nps' | 'caged';

/** Chord/arpeggio qualities. */
export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'maj6'
  | 'min6'
  | 'maj7'
  | 'dom7'
  | 'min7'
  | 'm7b5'
  | 'dim7'
  | 'dom9'
  | 'maj9'
  | 'min9'
  | 'dom11'
  | 'min11'
  | 'dom13'
  | 'maj13'
  | 'min13';

/** Scale family used by the music engine (modes, pentatonics, blues, etc.). */
export type ScaleQuality =
  | 'major'
  | 'minor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'majorBlues'
  | 'minorBlues'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'harmonicMinor'
  | 'melodicMinor';

/** A note letter, A–G. The basis for key-aware spelling. */
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * A spelled note: a letter plus an accidental offset in semitones
 * (-2 double-flat … +2 double-sharp). This lets us render Bb vs A#,
 * E# vs F, etc. correctly per key.
 */
export interface SpelledNote {
  letter: Letter;
  accidental: number;
}
