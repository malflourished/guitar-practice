import type { ChordQuality, FretPosition, NoteName } from '../../types/music';
import { getChordIntervals } from './chords';
import { getNoteAt } from './fretboard';
import { noteToSemitone } from './notes';
import type { Position } from './positions';
import { FRET_COUNT, OPEN_STRING_SEMITONES, midiAt, OPEN_STRING_MIDI } from './tuning';

/**
 * Small triads: three notes on three neighbouring strings, in close position.
 * These are the chords an improviser actually plays and solos around: each
 * string set has three inversions up the neck, twelve frets from one to its
 * next octave.
 */
export const TRIAD_QUALITIES = ['major', 'minor', 'dim', 'aug'] as const;
export type TriadQuality = (typeof TRIAD_QUALITIES)[number];

export function isTriadQuality(quality: ChordQuality): quality is TriadQuality {
  return (TRIAD_QUALITIES as readonly string[]).includes(quality);
}

export interface TriadStringSet {
  id: string;
  /** String indices, lowest-pitched first (0 = high e … 5 = low E). */
  strings: [number, number, number];
  /** The strings by name, lowest first. */
  label: string;
}

/** The four sets of three neighbouring strings, from the top of the neck's sound down. */
export const TRIAD_STRING_SETS: TriadStringSet[] = [
  { id: 'gbe', strings: [2, 1, 0], label: 'G B e' },
  { id: 'dgb', strings: [3, 2, 1], label: 'D G B' },
  { id: 'adg', strings: [4, 3, 2], label: 'A D G' },
  { id: 'ead', strings: [5, 4, 3], label: 'E A D' },
];

export const TRIAD_STRING_SET_IDS = TRIAD_STRING_SETS.map((set) => set.id);

export function getTriadStringSet(id: string): TriadStringSet {
  return TRIAD_STRING_SETS.find((set) => set.id === id) ?? TRIAD_STRING_SETS[0];
}

/** An inversion is named by its lowest note: the root, the 3rd or the 5th. */
export const TRIAD_INVERSIONS = [
  { label: 'Root position', badge: 'Root', lowest: 'root' },
  { label: '1st inversion', badge: '1st', lowest: '3rd' },
  { label: '2nd inversion', badge: '2nd', lowest: '5th' },
] as const;

/**
 * Fingers for three notes on neighbouring strings (given lowest string first).
 * One finger per fret from the lowest fretted note. Two notes on the lowest
 * fret share the first finger as a small barre (so do three), unless an open
 * string rings between them; two on a higher fret take a finger each, the
 * lower string first. A shape five frets wide (the root-position diminished
 * triad on the lower strings) is fingered 1, 2, 4, like two whole steps on one
 * string.
 */
export function fingerTriad(frets: number[]): number[] {
  const fretted = frets.filter((fret) => fret > 0);
  if (fretted.length === 0) return frets.map(() => 0);
  const lowest = Math.min(...fretted);
  const wide = Math.max(...fretted) - lowest > 3;
  if (frets[0] === lowest && frets[2] === lowest && frets[1] === 0) return [1, 0, 2];
  const used = new Map<number, number>();
  return frets.map((fret) => {
    if (fret === 0) return 0;
    if (fret === lowest) return 1;
    const natural = wide ? Math.max(2, fret - lowest) : fret - lowest + 1;
    const count = used.get(fret) ?? 0;
    used.set(fret, count + 1);
    const pair = fretted.filter((f) => f === fret).length > 1;
    // A pair two or three frets up is ring and little finger; one fret up, middle and ring.
    const first = pair ? Math.min(natural, 3) : natural;
    return Math.min(4, first + count);
  });
}

/**
 * Every inversion of a triad on one string set, up the neck. Each is a
 * `Position` like a chord shape: three sounded notes with fingers, the other
 * three strings muted, and the inversion as its label.
 */
export function buildTriadPositions(
  root: NoteName,
  quality: TriadQuality,
  stringSet: TriadStringSet,
): Position[] {
  const intervals = getChordIntervals(quality);
  const rootPc = noteToSemitone(root);
  const [low, mid, high] = stringSet.strings;
  const mutedStrings = [0, 1, 2, 3, 4, 5].filter((s) => !stringSet.strings.includes(s));
  const placements: Omit<Position, 'number'>[] = [];

  TRIAD_INVERSIONS.forEach((inversion, turn) => {
    // The three tones from this inversion's lowest note up, as steps in semitones.
    const tones = [0, 1, 2].map((i) => intervals[(turn + i) % 3]);
    const up1 = (tones[1] - tones[0] + 12) % 12;
    const up2 = (tones[2] - tones[1] + 12) % 12;
    const lowPc = (rootPc + tones[0]) % 12;
    const firstFret = (((lowPc - OPEN_STRING_SEMITONES[low]) % 12) + 12) % 12;

    for (let lowFret = firstFret; lowFret <= FRET_COUNT; lowFret += 12) {
      const lowMidi = midiAt(low, lowFret);
      const frets = [
        lowFret,
        lowMidi + up1 - OPEN_STRING_MIDI[mid],
        lowMidi + up1 + up2 - OPEN_STRING_MIDI[high],
      ];
      if (frets.some((fret) => fret < 0 || fret > FRET_COUNT)) continue;
      const fingers = fingerTriad(frets);
      const positions: FretPosition[] = stringSet.strings.map((string, i) => ({
        string,
        fret: frets[i],
        note: getNoteAt(string, frets[i]),
        finger: fingers[i],
      }));
      const fretted = frets.filter((fret) => fret > 0);
      placements.push({
        startFret: fretted.length ? Math.min(...fretted) : 0,
        endFret: Math.max(...frets),
        positions,
        mutedStrings,
        shapeLabel: inversion.label,
        badge: inversion.badge,
      });
    }
  });

  placements.sort((a, b) => a.startFret - b.startFret || a.endFret - b.endFret);
  return placements.map((placement, index) => ({ ...placement, number: index + 1 }));
}
