import type { ChordQuality, ScaleQuality } from '../../types/music';

/**
 * What the Chords and Scales decks say about each chord and scale: a short
 * name for its button, its formula in scale degrees, and one line a teacher
 * would say to an improvising guitarist. The tests hold every formula to the
 * intervals in `CHORD_DEFS` and `SCALE_DEFS`, so the words cannot drift from
 * what the neck shows.
 */
export interface ChordGuide {
  /** The button's text: the chord symbol's suffix, or the plain name for a triad. */
  symbol: string;
  /** Scale degrees from the root. A tone in brackets is usually left out when played. */
  formula: string;
  /** How it sounds and where it is used. One line. */
  sound: string;
}

export const CHORD_GUIDE: Record<ChordQuality, ChordGuide> = {
  major: {
    symbol: 'Major',
    formula: '1 3 5',
    sound: 'Bright and settled, the sound of home. The 3rd is the note that says major: land on it.',
  },
  minor: {
    symbol: 'Minor',
    formula: '1 ♭3 5',
    sound: 'Darker and inward. Only the 3rd changes, one fret lower than major, and it carries the whole mood.',
  },
  dim: {
    symbol: 'Dim',
    formula: '1 ♭3 ♭5',
    sound: 'Tense and unstable: two minor 3rds stacked. The vii chord of a major key, pulling up a fret to home.',
  },
  aug: {
    symbol: 'Aug',
    formula: '1 3 ♯5',
    sound: 'Major with its 5th pushed up a fret: bright but unsettled. The same shape every four frets, leaning upward.',
  },
  sus2: {
    symbol: 'Sus2',
    formula: '1 2 5',
    sound: 'Open and airy. The 2nd stands in for the 3rd, so it is neither major nor minor until you bring the 3rd back.',
  },
  sus4: {
    symbol: 'Sus4',
    formula: '1 4 5',
    sound: 'A held breath: the 4th stands in for the 3rd and wants to fall back to it. The classic move is sus4 to major.',
  },
  maj6: {
    symbol: '6',
    formula: '1 3 5 6',
    sound: 'Major with a sweet 6th: swing, country, an old-time ending. The same notes as the minor 7 a minor 3rd below.',
  },
  min6: {
    symbol: 'm6',
    formula: '1 ♭3 5 6',
    sound: 'Minor with a bittersweet major 6th: gypsy jazz, film noir. The home chord of Dorian and melodic minor.',
  },
  maj7: {
    symbol: 'maj7',
    formula: '1 3 5 7',
    sound: 'Lush and dreamy. The 7th sits one fret under the root: lean on the 7th and the 3rd rather than the root.',
  },
  dom7: {
    symbol: '7',
    formula: '1 3 5 ♭7',
    sound: 'Restless and bluesy: its 3rd and ♭7 are a tritone apart and want to resolve. The V chord, and all of the blues.',
  },
  min7: {
    symbol: 'm7',
    formula: '1 ♭3 5 ♭7',
    sound: 'Smooth and mellow, minor without the gloom. The ii chord in jazz, the home chord of funk and Dorian vamps.',
  },
  m7b5: {
    symbol: 'm7♭5',
    formula: '1 ♭3 ♭5 ♭7',
    sound: 'Half-diminished: dark and searching. The ii chord of a minor key, on its way to the V.',
  },
  dim7: {
    symbol: 'dim7',
    formula: '1 ♭3 ♭5 ♭♭7',
    sound: 'All minor 3rds, so the same chord every three frets. A passing chord that slides up one fret into the next.',
  },
  dom9: {
    symbol: '9',
    formula: '1 3 5 ♭7 9',
    sound: 'A dominant 7 with more colour: funk, soul, jazz-blues. Play it wherever you would play a 7 chord.',
  },
  maj9: {
    symbol: 'maj9',
    formula: '1 3 5 7 9',
    sound: 'A major 7 opened wider: glossy and modern. The 9th is the 2nd an octave up, a safe note to hold.',
  },
  min9: {
    symbol: 'm9',
    formula: '1 ♭3 5 ♭7 9',
    sound: 'A minor 7 with a wistful 9th on top: neo-soul and ballads. The 9th rubbing against the ♭3 is the colour.',
  },
  dom11: {
    symbol: '11',
    formula: '1 (3) 5 ♭7 9 11',
    sound: 'A dominant that floats instead of pulling: gospel, 70s soul. Played with no 3rd: C11 is B♭ major over C.',
  },
  min11: {
    symbol: 'm11',
    formula: '1 ♭3 5 ♭7 9 11',
    sound: 'Wide and misty: the whole minor pentatonic at once, plus the 9th. Modal jazz and slow vamps.',
  },
  dom13: {
    symbol: '13',
    formula: '1 3 5 ♭7 9 13',
    sound: 'The big jazz-blues dominant: the 13th (the 6th, an octave up) rings over the ♭7. A favourite last chord.',
  },
  maj13: {
    symbol: 'maj13',
    formula: '1 3 5 7 9 13',
    sound: 'A major 7 with the 6th on top: bright, rich and at rest. A chord to end on.',
  },
  min13: {
    symbol: 'm13',
    formula: '1 ♭3 5 ♭7 9 13',
    sound: 'A minor 7 with a major 6th on top: the Dorian sound in a single chord.',
  },
};

/**
 * The Chord menu: triads, four-note chords, extended chords. The two sixth
 * chords sit with the sevenths: like them they are a triad plus one note.
 */
export const CHORD_MENU_GROUPS: { label: string; qualities: ChordQuality[] }[] = [
  { label: 'Triads', qualities: ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4'] },
  { label: 'Sevenths', qualities: ['maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'maj6', 'min6'] },
  {
    label: 'Extended',
    qualities: ['dom9', 'maj9', 'min9', 'dom11', 'min11', 'dom13', 'maj13', 'min13'],
  },
];

export interface ScaleGuide {
  /** The button's text. */
  short: string;
  /** Another name the scale goes by (Ionian, Aeolian). */
  alias?: string;
  /** Scale degrees from the root. */
  formula: string;
  /** Its character, then where it fits. One line. */
  line: string;
}

export const SCALE_GUIDE: Record<ScaleQuality, ScaleGuide> = {
  majorPentatonic: {
    short: 'Major',
    formula: '1 2 3 5 6',
    line: 'Sweet and open: country, soul, singing melodies. Over major and dominant 7 chords: no 4th or 7th to clash.',
  },
  minorPentatonic: {
    short: 'Minor',
    formula: '1 ♭3 4 5 ♭7',
    line: 'The rock and blues workhorse: five notes that are hard to get wrong. Over minor chords, and a whole 12-bar blues.',
  },
  majorBlues: {
    short: 'Major',
    formula: '1 2 ♭3 3 5 6',
    line: 'Major pentatonic plus a ♭3 that slides into the 3rd: country, gospel, sweet blues. Over major and 7 chords.',
  },
  minorBlues: {
    short: 'Minor',
    formula: '1 ♭3 4 ♭5 5 ♭7',
    line: 'Minor pentatonic plus the ♭5, the blue note: pass through it, never park on it. Over a whole blues, or a minor vamp.',
  },
  major: {
    short: 'Major',
    alias: 'Ionian',
    formula: '1 2 3 4 5 6 7',
    line: 'Bright and complete: the yardstick for every other scale. Over a major key\'s chords; over I, pass through the 4th.',
  },
  dorian: {
    short: 'Dorian',
    formula: '1 2 ♭3 4 5 6 ♭7',
    line: 'Minor with a raised 6th: cooler, more hopeful. Santana, funk, So What. Over minor 7 chords: the ii chord, or a vamp.',
  },
  phrygian: {
    short: 'Phrygian',
    formula: '1 ♭2 ♭3 4 5 ♭6 ♭7',
    line: 'Minor with a ♭2, one fret above the root: dark, Spanish, metal. Over a minor chord that stays put, or the iii chord.',
  },
  lydian: {
    short: 'Lydian',
    formula: '1 2 3 ♯4 5 6 7',
    line: 'Major with a raised 4th: floating, dreamlike, film scores. Over a major chord that stays put, or the IV chord.',
  },
  mixolydian: {
    short: 'Mixolydian',
    formula: '1 2 3 4 5 6 ♭7',
    line: 'Major with a ♭7: bluesy and earthy, classic rock and jam bands. Over dominant 7 chords and the V chord.',
  },
  minor: {
    short: 'Minor',
    alias: 'Aeolian',
    formula: '1 2 ♭3 4 5 ♭6 ♭7',
    line: 'Sad and serious: the minor pentatonic plus the 2nd and ♭6. Over the chords of a minor key: ballads, metal, folk.',
  },
  locrian: {
    short: 'Locrian',
    formula: '1 ♭2 ♭3 4 ♭5 ♭6 ♭7',
    line: 'The unstable one: its home chord is diminished, so it never rests. Over m7♭5 chords, the ii of a minor key.',
  },
  harmonicMinor: {
    short: 'Harmonic',
    formula: '1 2 ♭3 4 5 ♭6 7',
    line: 'Minor with a raised 7th and a wide, exotic step below it: neoclassical, tango, surf. Over the V7 of a minor key.',
  },
  melodicMinor: {
    short: 'Melodic',
    formula: '1 2 ♭3 4 5 6 7',
    line: 'A major scale with a minor 3rd: smooth, jazzy. Over a minor chord at rest (m6, m-maj7); the way into jazz colour.',
  },
};

/**
 * The Scale menu, two rows. The second row is the major scale and its modes in
 * the order of the degree each starts on, so Major (Ionian) and Minor
 * (Aeolian) sit where they belong among them.
 */
export const SCALE_MENU_ROWS: {
  label: string;
  qualities: ScaleQuality[];
  /** The buttons explain themselves: the label may go where room is short. */
  labelOptional?: boolean;
}[][] = [
  [
    { label: 'Pentatonic', qualities: ['majorPentatonic', 'minorPentatonic'] },
    { label: 'Blues', qualities: ['majorBlues', 'minorBlues'] },
    { label: 'Minor', qualities: ['harmonicMinor', 'melodicMinor'] },
  ],
  [
    {
      label: 'Major and its modes',
      labelOptional: true,
      qualities: ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'],
    },
  ],
];

/** The line under the System switch. */
export const SCALE_SYSTEM_LINE =
  'CAGED: five shapes tied to the chord shapes, for knowing where you are. 3 per string: longer runs, faster.';

const DEGREE_SEMITONES: Record<string, number> = {
  '1': 0, '2': 2, '3': 4, '4': 5, '5': 7, '6': 9, '7': 11, '9': 14, '11': 17, '13': 21,
};

/** A formula as semitones above the root: "1 ♭3 5" is [0, 3, 7]. Brackets are ignored. */
export function formulaSemitones(formula: string): number[] {
  return formula.split(' ').map((token) => {
    const bare = token.replace(/[()]/g, '');
    const flats = (bare.match(/♭/g) ?? []).length;
    const sharps = (bare.match(/♯/g) ?? []).length;
    const degree = DEGREE_SEMITONES[bare.replace(/[♭♯]/g, '')];
    if (degree === undefined) throw new Error(`Unknown degree in formula: ${token}`);
    return degree - flats + sharps;
  });
}
