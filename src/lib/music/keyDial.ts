import type {
  KeyMode,
  Letter,
  NoteName,
  SpelledNote,
  TheoryDiagram,
} from '../../types/music';
import { semitoneToNote } from './notes';
import type { NotationPreference } from './notes';
import {
  getSpelledScaleNotes,
  pitchClassOf,
  spelledRootFromNoteName,
} from './noteSpelling';

/*
 * The key dial: one circle for keys and chords (Theory › Roman Numerals).
 *
 * Names here are the ones the dial prints (♯ and ♭, never # and b). A "key" is
 * always named by its major key; a minor key is its relative major plus
 * mode 'minor'. Scales are spelled by `noteSpelling.ts`, so the dial agrees
 * with the key panel and the fretboard labels.
 */

/** What the dial shows: the key's own window, a parallel window, or the dominants. */
export type KeyDialView = TheoryDiagram;

export type DialRing = 'major' | 'minor' | 'dim';

export interface DialCell {
  ring: DialRing;
  /** Position on the dial: 0 is C at the top, then clockwise in fifths. */
  pos: number;
  label: string;
  numeral: string;
  /** The chord the key is named for (I in major, i in minor). */
  home: boolean;
}

export interface KeyDialState {
  /** The major key, spelled as printed ("F♯"). For a minor key, its relative major. */
  major: string;
  mode: KeyMode;
  view: KeyDialView;
}

export interface KeyDialInfo {
  state: KeyDialState;
  /** Position of the major key on the dial. */
  k: number;
  major: string;
  /** The key's own tonic: the major key, or its relative minor. */
  tonic: string;
  signature: string;
  /** The key's own seven chords. */
  main: DialCell[];
  /** The borrowed window or the secondary dominants; empty in the key's own view. */
  extra: DialCell[];
  /** Degrees to turn a dashed outline from the window, or 'dominants' for the arc. */
  ghost: number | 'dominants' | null;
  caption: [string, string];
  plate: { key: string; sub: string; rel: string };
}

/** Major keys clockwise from the top, as the dial prints them. */
export const DIAL_MAJORS = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F♯',
  'D♭',
  'A♭',
  'E♭',
  'B♭',
  'F',
] as const;

/** The one position printed both ways: six sharps or six flats. */
export const DIAL_ALTERNATE: Record<number, string> = { 6: 'G♭' };

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function parseDialName(name: string): SpelledNote {
  let accidental = 0;
  for (const ch of name.slice(1)) {
    if (ch === '♯' || ch === '#') accidental += 1;
    else if (ch === '♭' || ch === 'b') accidental -= 1;
  }
  return { letter: name[0] as Letter, accidental };
}

export function formatDialName(note: SpelledNote): string {
  return (
    note.letter +
    (note.accidental > 0 ? '♯'.repeat(note.accidental) : '♭'.repeat(-note.accidental))
  );
}

/** The app's NoteName (sharp spelling) for a printed name, matched by pitch. */
export function dialNameToNote(name: string): NoteName {
  return semitoneToNote(pitchClassOf(parseDialName(name)));
}

/** Position of a major key on the dial: 0 is C at the top, then clockwise in fifths. */
export function dialPosition(major: string): number {
  return mod(pitchClassOf(parseDialName(major)) * 7, 12);
}

/** The seven notes of a major or minor scale, spelled from `tonic` (renamed if that reads better). */
function scaleNames(tonic: string, quality: 'major' | 'minor'): string[] {
  return getSpelledScaleNotes(parseDialName(tonic), quality).map(formatDialName);
}

/**
 * The name the dial uses for an app key, plus its major key. A minor key is
 * named by its relative major. The spelling follows the key panel
 * (`noteSpelling.ts`): fewer accidentals, and the preference breaks the tie.
 */
export function dialKeyFor(
  root: NoteName,
  mode: KeyMode,
  preference: NotationPreference = 'sharps',
): { major: string; tonic: string } {
  const notes = getSpelledScaleNotes(
    spelledRootFromNoteName(root, preference),
    mode,
  ).map(formatDialName);
  return mode === 'major'
    ? { major: notes[0], tonic: notes[0] }
    : { major: notes[2], tonic: notes[0] };
}

/** The key signature of a major key as the bezel prints it: "3♯", "2♭" or "0". */
export function keySignature(major: string): string {
  const notes = scaleNames(major, 'major');
  const sharps = notes.filter((n) => n.includes('♯')).length;
  const flats = notes.filter((n) => n.includes('♭')).length;
  if (sharps) return `${sharps}♯`;
  if (flats) return `${flats}♭`;
  return '0';
}

/** The label of a ring at a position when no key is lit. */
export function defaultCellLabel(ring: DialRing, pos: number): string {
  const major = DIAL_MAJORS[pos];
  if (ring === 'major') return major;
  const notes = scaleNames(major, 'major');
  return ring === 'minor' ? `${notes[5]}m` : `${notes[6]}°`;
}

/** What the bezel prints at a position when it is not the key's own. */
export function defaultSignature(pos: number): string {
  return pos === 6 ? '6♯ 6♭' : keySignature(DIAL_MAJORS[pos]);
}

const NUMERALS = {
  major: ['IV', 'I', 'V', 'ii', 'vi', 'iii', 'vii°'],
  minor: ['VI', 'III', 'VII', 'iv', 'i', 'v', 'ii°'],
  fromParallelMinor: ['♭VI', '♭III', '♭VII', 'iv', 'i', 'v', 'ii°'],
  fromParallelMajor: ['IV', 'I', 'V', 'ii', 'vi', 'iii', 'vii°'],
};

/**
 * The seven chords of a key signature, by ring and position. Majors IV I V
 * sit side by side on the outer ring, their relative minors (ii vi iii)
 * directly inside, and vii° under V. The same shape fits every key.
 */
export function windowCells(major: string, numerals: string[]): DialCell[] {
  const k = dialPosition(major);
  const n = scaleNames(major, 'major');
  const cells: [DialRing, number, string][] = [
    ['major', k - 1, n[3]],
    ['major', k, n[0]],
    ['major', k + 1, n[4]],
    ['minor', k - 1, `${n[1]}m`],
    ['minor', k, `${n[5]}m`],
    ['minor', k + 1, `${n[2]}m`],
    ['dim', k + 1, `${n[6]}°`],
  ];
  return cells.map(([ring, pos, label], i) => ({
    ring,
    pos: mod(pos, 12),
    label,
    numeral: numerals[i],
    home: false,
  }));
}

const TURNING =
  'Clockwise adds a sharp (the new 7th). Counter-clockwise adds a flat (the new 4th).';

/** Everything the dial shows for a state. */
export function describeKeyDial(state: KeyDialState): KeyDialInfo {
  const { major } = state;
  const k = dialPosition(major);
  const notes = scaleNames(major, 'major');
  const minorMode = state.mode === 'minor';
  const tonic = minorMode ? notes[5] : major;
  const signature = keySignature(major);
  const main = windowCells(major, minorMode ? NUMERALS.minor : NUMERALS.major);
  for (const cell of main) cell.home = cell.ring === state.mode && cell.pos === k;

  let extra: DialCell[] = [];
  let ghost: KeyDialInfo['ghost'] = null;
  let caption: [string, string];

  // A parallel key may be respelled to stay readable (G♭ minor is written F♯ minor);
  // the captions then use that spelling throughout, so the example chords match.
  if (state.view === 'borrowed' && !minorMode) {
    const minorScale = scaleNames(major, 'minor');
    const parallel = minorScale[0];
    extra = windowCells(minorScale[2], NUMERALS.fromParallelMinor);
    ghost = -90;
    const [flatSix, , flatSeven] = extra;
    caption = [
      `Three steps counter-clockwise is ${parallel} minor: the same home, in the dark.`,
      `♭VI, ♭VII and iv are the chords most often borrowed. Try ${parallel} – ${flatSix.label} – ${flatSeven.label} – ${parallel}.`,
    ];
  } else if (state.view === 'borrowed') {
    const parallel = scaleNames(tonic, 'major')[0];
    extra = windowCells(parallel, NUMERALS.fromParallelMajor);
    ghost = 90;
    const [four, , five] = extra;
    caption = [
      `Three steps clockwise is ${parallel} major, the same home in daylight.`,
      `Its V, ${five.label}, gives the minor key a leading tone. Its IV, ${four.label}, is the Dorian colour: try ${parallel}m – ${four.label} – ${parallel}m.`,
    ];
  } else if (state.view === 'dominants') {
    const names = minorMode
      ? ['V/VII', 'V/iv', 'V', 'V/v']
      : ['V/V', 'V/ii', 'V/vi', 'V/iii'];
    const roots = [notes[1], notes[5], notes[2], notes[6]];
    extra = roots.map((root, i) => ({
      ring: 'major',
      pos: mod(k + 2 + i, 12),
      label: `${root}7`,
      numeral: names[i],
      home: false,
    }));
    ghost = 'dominants';
    caption = minorMode
      ? [
          'Clockwise of the window sit the dominants.',
          `${notes[2]}7 is the V that pulls hardest to ${tonic} minor. ${notes[5]}7 leads to iv, ${notes[6]}7 to v.`,
        ]
      : [
          'Clockwise of V sit the secondary dominants.',
          `Walk them back, ${notes[6]}7 → ${notes[2]}7 → ${notes[5]}7 → ${notes[1]}7 → ${notes[4]}7 → ${major}, and each chord falls a fifth into the next.`,
        ];
  } else {
    caption = minorMode
      ? [
          `${tonic} minor shares ${major} major's window: the same seven chords, with home moved to i.`,
          TURNING,
        ]
      : [
          `${major} major's seven chords sit in one window. Turn the dial: the same shape fits every key.`,
          TURNING,
        ];
  }

  return {
    state: { ...state },
    k,
    major,
    tonic,
    signature,
    main,
    extra,
    ghost,
    caption,
    plate: {
      key: tonic,
      sub: (minorMode ? 'MINOR' : 'MAJOR') + (signature === '0' ? '' : ` · ${signature}`),
      rel: minorMode ? `relative ${major} major` : `relative ${notes[5]} minor`,
    },
  };
}
