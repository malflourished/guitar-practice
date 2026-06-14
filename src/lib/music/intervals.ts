import type { NoteName } from '../../types/music';
import { getIntervalShape } from './chordTones';
import type { ChordToneShape } from './chordTones';
import { noteToSemitone, semitoneToNote } from './notes';

export type IntervalQuality =
  | 'perfect'
  | 'major'
  | 'minor'
  | 'augmented'
  | 'diminished';

export interface IntervalDef {
  /** Distance from the root in semitones (0–12). */
  semitones: number;
  /** Full name, e.g. "Major 3rd". */
  name: string;
  /** Compact academic abbreviation, e.g. "M3", "P5", "TT". */
  abbr: string;
  /** Root-relative function label (Gardiner/Quayle shorthand), e.g. "♭7". */
  functionLabel: string;
  /** Scale-degree label (key-relative reading), e.g. "♭7". */
  degreeLabel: string;
  quality: IntervalQuality;
  /** One-line character description for the catalog. */
  character: string;
  /** Whether the interval belongs to the major scale. */
  diatonicMajor: boolean;
  /** A familiar tune that opens with this interval (ascending). */
  mnemonic?: string;
}

/**
 * The thirteen intervals within an octave, measured up from the root. Function
 * and degree labels share the same shorthand the rest of the app uses for chord
 * tones (see chordTones.ts) so the visual language stays consistent.
 */
export const INTERVALS: IntervalDef[] = [
  {
    semitones: 0,
    name: 'Unison',
    abbr: 'P1',
    functionLabel: 'R',
    degreeLabel: '1',
    quality: 'perfect',
    character: 'The root itself — total rest.',
    diatonicMajor: true,
  },
  {
    semitones: 1,
    name: 'Minor 2nd',
    abbr: 'm2',
    functionLabel: '♭2',
    degreeLabel: '♭2',
    quality: 'minor',
    character: 'Sharp dissonance, leaning hard toward the root.',
    diatonicMajor: false,
    mnemonic: 'Jaws theme',
  },
  {
    semitones: 2,
    name: 'Major 2nd',
    abbr: 'M2',
    functionLabel: '2',
    degreeLabel: '2',
    quality: 'major',
    character: 'Mild tension — one whole step up.',
    diatonicMajor: true,
    mnemonic: 'Happy Birthday',
  },
  {
    semitones: 3,
    name: 'Minor 3rd',
    abbr: 'm3',
    functionLabel: '♭3',
    degreeLabel: '♭3',
    quality: 'minor',
    character: 'Warm and minor — the color of a minor chord.',
    diatonicMajor: false,
    mnemonic: 'Greensleeves',
  },
  {
    semitones: 4,
    name: 'Major 3rd',
    abbr: 'M3',
    functionLabel: '3',
    degreeLabel: '3',
    quality: 'major',
    character: 'Bright and major — half of every major chord.',
    diatonicMajor: true,
    mnemonic: 'When the Saints Go Marching In',
  },
  {
    semitones: 5,
    name: 'Perfect 4th',
    abbr: 'P4',
    functionLabel: '4',
    degreeLabel: '4',
    quality: 'perfect',
    character: 'Open and stable — the same in major and minor.',
    diatonicMajor: true,
    mnemonic: 'Here Comes the Bride',
  },
  {
    semitones: 6,
    name: 'Tritone',
    abbr: 'TT',
    functionLabel: '♭5',
    degreeLabel: '♭5',
    quality: 'diminished',
    character: 'Maximum tension — the devil in the dyad.',
    diatonicMajor: false,
    mnemonic: 'The Simpsons theme',
  },
  {
    semitones: 7,
    name: 'Perfect 5th',
    abbr: 'P5',
    functionLabel: '5',
    degreeLabel: '5',
    quality: 'perfect',
    character: 'Hollow and strong — adds little harmonic color (the "potato").',
    diatonicMajor: true,
    mnemonic: 'Twinkle, Twinkle, Little Star',
  },
  {
    semitones: 8,
    name: 'Minor 6th',
    abbr: 'm6',
    functionLabel: '♭6',
    degreeLabel: '♭6',
    quality: 'minor',
    character: 'Bittersweet — the natural minor 6th.',
    diatonicMajor: false,
    mnemonic: 'The Entertainer',
  },
  {
    semitones: 9,
    name: 'Major 6th',
    abbr: 'M6',
    functionLabel: '6',
    degreeLabel: '6',
    quality: 'major',
    character: 'Sweet and open — the 13th, an octave down.',
    diatonicMajor: true,
    mnemonic: 'My Bonnie Lies Over the Ocean',
  },
  {
    semitones: 10,
    name: 'Minor 7th',
    abbr: 'm7',
    functionLabel: '♭7',
    degreeLabel: '♭7',
    quality: 'minor',
    character: 'Bluesy pull — the color tone of a dominant chord.',
    diatonicMajor: false,
    mnemonic: 'Star Trek theme',
  },
  {
    semitones: 11,
    name: 'Major 7th',
    abbr: 'M7',
    functionLabel: '7',
    degreeLabel: '7',
    quality: 'major',
    character: 'Lush dissonance — leans up into the octave.',
    diatonicMajor: true,
    mnemonic: 'Take On Me (chorus leap)',
  },
  {
    semitones: 12,
    name: 'Octave',
    abbr: 'P8',
    functionLabel: 'R',
    degreeLabel: '8',
    quality: 'perfect',
    character: 'The same note, an octave higher.',
    diatonicMajor: true,
    mnemonic: 'Somewhere Over the Rainbow',
  },
];

const INTERVAL_BY_SEMITONE = new Map<number, IntervalDef>(
  INTERVALS.map((interval) => [interval.semitones, interval]),
);

/** Look up the canonical interval definition for a semitone distance (0–12). */
export function getIntervalDef(semitones: number): IntervalDef {
  const within = ((semitones % 12) + 12) % 12;
  // Preserve the octave (12) as its own entry; everything else folds to 0–11.
  const key = semitones === 12 ? 12 : within;
  return INTERVAL_BY_SEMITONE.get(key) ?? INTERVALS[0];
}

/** The function or degree label for a semitone distance, per the active style. */
export function getIntervalLabel(
  semitones: number,
  style: 'function' | 'degree' = 'function',
): string {
  const def = getIntervalDef(semitones);
  return style === 'degree' ? def.degreeLabel : def.functionLabel;
}

/** Semitone distance from a root pitch class up to another note (0–11). */
export function intervalBetween(root: NoteName, note: NoteName): number {
  return (noteToSemitone(note) - noteToSemitone(root) + 12) % 12;
}

/** The note a given interval above the root. */
export function noteAtInterval(root: NoteName, semitones: number): NoteName {
  return semitoneToNote(noteToSemitone(root) + semitones);
}

/**
 * Curated palette keyed by semitone function (Decision 4: function colors in
 * interval mode only). The root is gold; the 3rd and 7th — the tones that
 * define a chord's quality — are warm and prominent; the 5th is a muted gray
 * (Gardiner's harmonically inert "potato"). Used as inline marker fills so the
 * theme-driven monochrome board elsewhere is untouched.
 */
export const INTERVAL_COLORS: Record<number, string> = {
  0: '#E6B400', // R — gold
  1: '#7E57C2', // ♭2 — violet
  2: '#42A5F5', // 2 — blue
  3: '#26A69A', // ♭3 — teal
  4: '#EF5350', // 3 — warm red (money note)
  5: '#5C6BC0', // 4 — indigo
  6: '#8D6E63', // ♭5 — neutral brown (tension)
  7: '#9E9E9E', // 5 — gray (the potato)
  8: '#AB47BC', // ♭6 — purple
  9: '#66BB6A', // 6 — green
  10: '#FB8C00', // ♭7 — orange (money note)
  11: '#FFA726', // 7 — amber (money note)
  12: '#E6B400', // octave — gold
};

/** Inline fill color for an interval marker, by semitone distance. */
export function getIntervalColor(semitones: number): string {
  const within = ((semitones % 12) + 12) % 12;
  const key = semitones === 12 ? 12 : within;
  return INTERVAL_COLORS[key] ?? INTERVAL_COLORS[0];
}

/** Relative luminance (0–1) of a #rrggbb color, for contrast decisions. */
function hexLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable label color (dark or light) for an interval marker fill. */
export function getIntervalTextColor(semitones: number): string {
  return hexLuminance(getIntervalColor(semitones)) > 0.6 ? '#1A1A1A' : '#FFFFFF';
}

export interface IntervalMarker {
  semitones: number;
  label: string;
  shape: ChordToneShape;
  color: string;
  isRoot: boolean;
}

/**
 * Everything the fretboard needs to render a note as an interval relative to a
 * root: its function/degree label, marker shape, function color, and whether it
 * is the root pitch class.
 */
export function getIntervalMarker(
  root: NoteName,
  note: NoteName,
  style: 'function' | 'degree' = 'function',
): IntervalMarker {
  const semitones = intervalBetween(root, note);
  return {
    semitones,
    label: getIntervalLabel(semitones, style),
    shape: getIntervalShape(semitones),
    color: getIntervalColor(semitones),
    isRoot: semitones === 0,
  };
}
