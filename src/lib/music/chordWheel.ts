import type { KeyMode, NoteName } from '../../types/music';
import { NOTE_COLORS } from '../colors';
import {
  getAccidentalLabel,
  getCircleKeyDisplay,
  getCircleKeyEntries,
  usesFlatCircleSpelling,
  type CircleKeyDisplay,
  type CircleKeyEntry,
} from './circleOfFifths';
import { getDiatonicRoot } from './diatonic';
import { ENHARMONIC_FLAT } from './notes';

export type ChordWheelRing = 'I' | 'vi' | 'ii' | 'dim';

export interface ChordWheelHighlight {
  wedgeIndex: number;
  ring: ChordWheelRing;
  numeral: string;
}

export interface ChordWheelWedge {
  index: number;
  entry: CircleKeyEntry;
  major: NoteName;
  relativeMinor: NoteName;
  iiRoot: NoteName;
  dimRoot: NoteName;
  display: CircleKeyDisplay;
  signatureLabel: string;
  color: string;
  labels: {
    I: string;
    vi: string;
    ii: string;
    dim: string;
  };
}

function formatWheelRoot(note: NoteName, entry: CircleKeyEntry): string {
  if (usesFlatCircleSpelling(entry)) {
    const flat = ENHARMONIC_FLAT[note];
    if (flat) {
      return flat.replace('b', '♭');
    }
  }
  return note.replace('#', '♯');
}

function buildWedgeLabels(
  entry: CircleKeyEntry,
  index: number,
  iiRoot: NoteName,
  dimRoot: NoteName,
): ChordWheelWedge['labels'] {
  const display = getCircleKeyDisplay(entry, index);
  const ii = `${formatWheelRoot(iiRoot, entry)}m`;
  const dim = `${formatWheelRoot(dimRoot, entry)}°`;

  return {
    I: display.major,
    vi: display.minor,
    ii,
    dim,
  };
}

export function getChordWheelWedges(): ChordWheelWedge[] {
  const entries = getCircleKeyEntries();
  return entries.map((entry, index) => {
    const iiRoot = getDiatonicRoot(entry.major, 'major', 2);
    const dimRoot = getDiatonicRoot(entry.major, 'major', 7);
    return {
      index,
      entry,
      major: entry.major,
      relativeMinor: entry.relativeMinor,
      iiRoot,
      dimRoot,
      display: getCircleKeyDisplay(entry, index),
      signatureLabel: getAccidentalLabel(entry),
      color: NOTE_COLORS[entry.major],
      labels: buildWedgeLabels(entry, index, iiRoot, dimRoot),
    };
  });
}

/** Diatonic chord positions for a major key at the given circle index. */
export function getDiatonicHighlights(selectedIndex: number): ChordWheelHighlight[] {
  const prev = (selectedIndex + 11) % 12;
  const next = (selectedIndex + 1) % 12;
  return [
    { wedgeIndex: selectedIndex, ring: 'I', numeral: 'I' },
    { wedgeIndex: selectedIndex, ring: 'ii', numeral: 'ii' },
    { wedgeIndex: selectedIndex, ring: 'vi', numeral: 'vi' },
    { wedgeIndex: selectedIndex, ring: 'dim', numeral: 'vii°' },
    { wedgeIndex: prev, ring: 'I', numeral: 'IV' },
    { wedgeIndex: next, ring: 'I', numeral: 'V' },
    { wedgeIndex: next, ring: 'vi', numeral: 'iii' },
  ];
}

export function isChordWheelHighlight(
  highlights: ChordWheelHighlight[],
  wedgeIndex: number,
  ring: ChordWheelRing,
): ChordWheelHighlight | undefined {
  return highlights.find(
    (highlight) => highlight.wedgeIndex === wedgeIndex && highlight.ring === ring,
  );
}

export function getSelectedWheelIndex(
  selectedRoot: NoteName,
  keyMode: KeyMode,
): number {
  const wedges = getChordWheelWedges();
  if (keyMode === 'major') {
    return wedges.findIndex((wedge) => wedge.major === selectedRoot);
  }
  return wedges.findIndex((wedge) => wedge.relativeMinor === selectedRoot);
}
