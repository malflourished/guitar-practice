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

export type StudyMode = 'notes' | 'chords' | 'scales' | 'arpeggios';

/** Complexity tier that progressively unlocks features. */
export type Tier = 'basic' | 'intermediate' | 'advanced';

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
