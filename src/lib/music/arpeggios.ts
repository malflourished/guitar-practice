import type { ChordQuality } from '../../types/music';
import { getChordIntervals } from './chords';

/** An arpeggio uses the same notes as its chord. */
export function getArpeggioIntervals(quality: ChordQuality): number[] {
  return getChordIntervals(quality);
}
