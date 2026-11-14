// Where the day's plan sits on the neck: the box, and the chords of the
// Changes block inside that box. See docs/specs/E-adaptive-practice.md.
import type { ChordQuality, FretPosition, NoteName } from '../../types/music';
import { MINOR_PENTATONIC, buildChordPositions, buildScalePositions, getPositionsForIntervals,
  nearestRegionIndex, noteToSemitone, semitoneToNote, type Position } from '../music';
import type { KeyQuality } from './plan';

const LOW_E = 5;
const LOW_E_OPEN_PC = 4;

/**
 * The pentatonic box with the usual minor numbering: box 1 starts on the minor
 * root on the low E string, box 2 on the ♭3, then the 4, the 5 and the ♭7. A
 * major key keeps its relative minor's numbers, so C major's box 1 is A
 * minor's. Box 0 is the lowest box on the neck, as sessions saved before
 * plans used.
 */
export function boxRegion(root: NoteName, quality: KeyQuality, box: number): Position {
  const regions = buildScalePositions(root, quality === 'minor' ? 'minorPentatonic' : 'majorPentatonic');
  if (box < 1) return regions[0];
  const framePc = (noteToSemitone(root) + (quality === 'minor' ? 0 : 9)) % 12;
  const anchorPc = (framePc + MINOR_PENTATONIC[box - 1]) % 12;
  return regions.find((region) => {
    const lowest = Math.min(...region.positions.filter((p) => p.string === LOW_E).map((p) => p.fret));
    return (LOW_E_OPEN_PC + lowest) % 12 === anchorPc;
  }) ?? regions[0];
}

export interface ChangesChord {
  root: NoteName;
  quality: ChordQuality;
  numeral: string;
  /** Root, 3rd and 5th wherever they fall inside the box's frets. */
  tones: FretPosition[];
  /** The full chord shape nearest the box, for the backing guitar. */
  grip: FretPosition[];
}

/** i–iv–V (minor) or I–IV–V (major), every chord shown in the one window. */
export function changesChords(root: NoteName, quality: KeyQuality, region: Position): ChangesChord[] {
  const rootPc = noteToSemitone(root);
  const minor = quality === 'minor';
  const chords: { root: NoteName; quality: ChordQuality; numeral: string }[] = [
    { root, quality: minor ? 'minor' : 'major', numeral: minor ? 'i' : 'I' },
    { root: semitoneToNote(rootPc + 5), quality: minor ? 'minor' : 'major', numeral: minor ? 'iv' : 'IV' },
    { root: semitoneToNote(rootPc + 7), quality: 'major', numeral: 'V' },
  ];
  return chords.map((chord) => {
    const shapes = buildChordPositions(chord.root, chord.quality);
    return { ...chord,
      tones: getPositionsForIntervals(chord.root, chord.quality === 'minor' ? [0, 3, 7] : [0, 4, 7])
        .filter((p) => p.fret >= region.startFret && p.fret <= region.endFret),
      grip: shapes[nearestRegionIndex(shapes, region)].positions };
  });
}
