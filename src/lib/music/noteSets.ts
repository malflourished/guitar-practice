import type { ChordQuality, NoteName, ScaleQuality } from '../../types/music';
import { CHORD_DEFS, getChordQualityLabel } from './chords';
import { INTERVALS } from './intervals';
import { CHROMATIC, formatNoteDisplay, noteToSemitone, type NotationPreference } from './notes';
import { SCALE_DEFS, getQualityLabel } from './scales';

/**
 * What a hand-picked set of notes is: Notes mode's caption. One note gets its
 * octave shape, two notes their interval, three or more the chord or scale
 * that has exactly those notes, under each of its names.
 */
export interface NoteSetReading {
  /** How many notes ("4 notes"), or the one note's name. */
  title: string;
  /** The notes, in order from C, when there are two or more. */
  notes?: string;
  /** What they are, in one line. */
  line: string;
}

// The names a player reaches for first come first.
const CHORD_ORDER: ChordQuality[] = [
  'major', 'minor', 'dim', 'aug', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'sus4', 'sus2',
  'maj6', 'min6', 'dom9', 'maj9', 'min9', 'dom11', 'min11', 'dom13', 'maj13', 'min13',
];
const SCALE_ORDER: ScaleQuality[] = [
  'major', 'minor', 'majorPentatonic', 'minorPentatonic', 'majorBlues', 'minorBlues',
  'dorian', 'mixolydian', 'lydian', 'phrygian', 'locrian', 'harmonicMinor', 'melodicMinor',
];

const key = (pcs: number[]) => [...new Set(pcs.map((pc) => ((pc % 12) + 12) % 12))].sort((a, b) => a - b).join(',');

/** Every chord and scale that holds exactly these pitch classes, best-known names first. */
export function nameNoteSet(notes: ReadonlySet<NoteName>, notation: NotationPreference): string[] {
  const pcs = CHROMATIC.filter((note) => notes.has(note)).map(noteToSemitone);
  if (pcs.length < 3) return [];
  const names: string[] = [];
  const collect = <Q extends string>(
    order: Q[],
    intervalsOf: (quality: Q) => number[],
    labelOf: (quality: Q) => string,
  ) => {
    for (const quality of order) {
      const shape = key(intervalsOf(quality));
      for (const root of pcs) {
        if (key(pcs.map((pc) => pc - root)) !== shape) continue;
        names.push(`${formatNoteDisplay(CHROMATIC[root], notation)} ${labelOf(quality).toLowerCase()}`);
      }
    }
  };
  const chords = () => collect(CHORD_ORDER, (q) => CHORD_DEFS[q].intervals, getChordQualityLabel);
  const scales = () => collect(SCALE_ORDER, (q) => SCALE_DEFS[q].intervals, (q) => `${getQualityLabel(q)} scale`);
  // Five notes or more read as a scale first; fewer as a chord.
  if (pcs.length >= 5) {
    scales();
    chords();
  } else {
    chords();
    scales();
  }
  return names;
}

export function describeNoteSet(
  notes: ReadonlySet<NoteName>,
  notation: NotationPreference,
): NoteSetReading {
  const picked = CHROMATIC.filter((note) => notes.has(note));
  const shown = picked.map((note) => formatNoteDisplay(note, notation));
  if (picked.length === 0) {
    return { title: 'No notes', line: 'Pick notes to see where they sit on the neck.' };
  }
  if (picked.length === 1) {
    return {
      title: shown[0],
      line: `Every ${shown[0]} on the neck. The octave is two strings higher and two frets up, three frets up from the D and G strings.`,
    };
  }
  if (picked.length === 12) {
    return { title: 'All twelve notes', line: 'The chromatic scale: every fret on every string.' };
  }
  const reading = { title: `${picked.length} notes`, notes: shown.join(' ') };
  if (picked.length === 2) {
    const up = (noteToSemitone(picked[1]) - noteToSemitone(picked[0]) + 12) % 12;
    const name = (semitones: number) => INTERVALS[semitones].name.toLowerCase();
    if (up === 6) {
      return { ...reading, line: 'A tritone, whichever of the two is on the bottom: six frets, the most restless interval.' };
    }
    return {
      ...reading,
      line: `${shown[0]} up to ${shown[1]} is a ${name(up)}; ${shown[1]} up to ${shown[0]} is a ${name(12 - up)}.`,
    };
  }
  const names = nameNoteSet(notes, notation);
  if (names.length === 0) {
    return { ...reading, line: 'No common chord or scale has exactly these notes.' };
  }
  const [first, second, ...rest] = names;
  const also = second ? `, or ${second}` : '';
  const more = rest.length ? ` (and ${rest.length} more ${rest.length === 1 ? 'name' : 'names'})` : '';
  return { ...reading, line: `${first[0].toUpperCase()}${first.slice(1)}${also}${more}.` };
}
