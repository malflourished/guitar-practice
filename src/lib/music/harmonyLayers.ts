import type {
  ChordQuality,
  FretPosition,
  NoteName,
  ScaleQuality,
} from '../../types/music';
import { getChordIntervals } from './chords';
import { noteToSemitone } from './notes';

/**
 * The chord implied by a scale's tonic — what the arpeggio layer and chord-tone
 * overlay resolve against. Sevenths are used where the scale strongly implies
 * one (mixolydian → dom7); plain triads elsewhere.
 */
const IMPLIED_CHORD: Record<ScaleQuality, ChordQuality> = {
  major: 'major',
  minor: 'minor',
  majorPentatonic: 'major',
  minorPentatonic: 'minor',
  majorBlues: 'major',
  minorBlues: 'minor',
  dorian: 'min7',
  phrygian: 'minor',
  lydian: 'major',
  mixolydian: 'dom7',
  locrian: 'm7b5',
  harmonicMinor: 'minor',
  melodicMinor: 'minor',
};

export function getImpliedChordQuality(quality: ScaleQuality): ChordQuality {
  return IMPLIED_CHORD[quality];
}

/**
 * Reduce a set of displayed notes to the chord tones of `root`/`quality` — the
 * arpeggio living inside a scale shape, in the same position box.
 */
export function filterToChordTones(
  positions: FretPosition[],
  root: NoteName,
  quality: ChordQuality,
): FretPosition[] {
  const rootPc = noteToSemitone(root);
  const chordPcs = new Set(
    getChordIntervals(quality).map((interval) => (rootPc + interval) % 12),
  );
  return positions.filter((position) =>
    chordPcs.has(noteToSemitone(position.note)),
  );
}
