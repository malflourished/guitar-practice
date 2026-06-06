import type { ChordQuality, FretPosition, NoteName } from '../../types/music';
import type { NotationPreference } from './notes';
import {
  buildSpellingMap,
  getSpelledChordNotes,
  spelledRootFromNoteName,
} from './noteSpelling';
import { buildChordPositions, ordinalPosition } from './positions';
import { formatChordName } from './progressions';

export interface ChordPositionView {
  index: number;
  positionLabel: string;
  chordName: string;
  positions: FretPosition[];
  mutedStrings: number[];
  startFret: number;
  endFret: number;
  noteLabels: Map<NoteName, string>;
}

export function buildChordPositionViews(
  root: NoteName,
  quality: ChordQuality,
  notation: NotationPreference,
): ChordPositionView[] {
  const regions = buildChordPositions(root, quality);
  const spelledRoot = spelledRootFromNoteName(root, notation);
  const spelled = getSpelledChordNotes(spelledRoot, quality);
  const noteLabels = buildSpellingMap(spelled);
  const chordName = formatChordName(root, quality, notation);

  return regions.map((region, index) => ({
    index,
    positionLabel: ordinalPosition(region.number),
    chordName,
    positions: region.positions,
    mutedStrings: region.mutedStrings,
    startFret: region.startFret,
    endFret: region.endFret,
    noteLabels,
  }));
}
