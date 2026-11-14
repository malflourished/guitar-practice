import type { ChordQuality, FretPosition, NoteName } from '../../types/music';
import type { NotationPreference } from './notes';
import {
  buildSpellingMap,
  getSpelledChordNotes,
  spelledRootFromNoteName,
} from './noteSpelling';
import { buildChordPositions, ordinalPosition, type Position } from './positions';
import { formatChordName } from './progressions';
import { buildTriadPositions, getTriadStringSet, isTriadQuality } from './triads';

/**
 * How Chords mode voices a chord: the full CAGED shapes, or the small triads
 * on three neighbouring strings (major, minor, diminished and augmented only).
 */
export const CHORD_VOICINGS = ['shapes', 'triads'] as const;
export type ChordVoicing = (typeof CHORD_VOICINGS)[number];

/** Small triads are showing: they were asked for and this chord has them. */
export function showsTriads(quality: ChordQuality, voicing: ChordVoicing): boolean {
  return voicing === 'triads' && isTriadQuality(quality);
}

/** The positions Chords mode offers up the neck for this chord and voicing. */
export function buildChordsModePositions(
  root: NoteName,
  quality: ChordQuality,
  voicing: ChordVoicing = 'shapes',
  triadStrings = '',
): Position[] {
  if (voicing === 'triads' && isTriadQuality(quality)) {
    return buildTriadPositions(root, quality, getTriadStringSet(triadStrings));
  }
  return buildChordPositions(root, quality, 'caged');
}

export interface ChordPositionView {
  index: number;
  positionLabel: string;
  /** The shape's own name ("A shape", "Open C shape", "1st inversion"), when it has one. */
  shapeLabel?: string;
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
  voicing: ChordVoicing = 'shapes',
  triadStrings = '',
): ChordPositionView[] {
  const regions = buildChordsModePositions(root, quality, voicing, triadStrings);
  const spelledRoot = spelledRootFromNoteName(root, notation);
  const spelled = getSpelledChordNotes(spelledRoot, quality);
  const noteLabels = buildSpellingMap(spelled);
  const chordName = formatChordName(root, quality, notation);

  return regions.map((region, index) => ({
    index,
    positionLabel: ordinalPosition(region.number),
    shapeLabel: region.shapeLabel,
    chordName,
    positions: region.positions,
    mutedStrings: region.mutedStrings,
    startFret: region.startFret,
    endFret: region.endFret,
    noteLabels,
  }));
}
