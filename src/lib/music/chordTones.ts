import type { ChordQuality, NoteName } from '../../types/music';
import { getChordIntervals } from './chords';
import { noteToSemitone } from './notes';

export type ChordToneShape =
  | 'circle'
  | 'square'
  | 'triangle-up'
  | 'triangle-down'
  | 'diamond'
  | 'ring';

export interface ChordToneInfo {
  interval: number;
  label: string;
  shape: ChordToneShape;
  isRoot: boolean;
}

const INTERVAL_LABEL: Record<number, string> = {
  0: 'R',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♯5',
  9: '6',
  10: '♭7',
  11: '7',
  14: '9',
  17: '11',
  21: '13',
};

function shapeForInterval(interval: number): ChordToneShape {
  if (interval === 0) return 'circle';
  if (interval >= 14) return 'ring';

  const pc = interval % 12;
  if (pc === 2 || pc === 3 || pc === 4 || pc === 5) {
    return interval === 3 || pc === 3 ? 'triangle-down' : 'triangle-up';
  }
  if (pc === 6 || pc === 7 || pc === 8) return 'square';
  if (pc === 9 || pc === 10 || pc === 11) return 'diamond';
  return 'circle';
}

/**
 * Match a note to the highest chord-tone interval at its pitch class.
 * Compound extensions (9/11/13) win over their octave equivalents.
 */
export function getChordToneForNote(
  root: NoteName,
  note: NoteName,
  quality: ChordQuality,
): ChordToneInfo | null {
  const rootPc = noteToSemitone(root);
  const notePc = noteToSemitone(note);
  const diff = (notePc - rootPc + 12) % 12;

  let matchedInterval: number | null = null;
  for (const interval of getChordIntervals(quality)) {
    if (interval % 12 !== diff) continue;
    if (matchedInterval === null || interval > matchedInterval) {
      matchedInterval = interval;
    }
  }

  if (matchedInterval === null) return null;

  return {
    interval: matchedInterval,
    label: INTERVAL_LABEL[matchedInterval] ?? String(matchedInterval),
    shape: shapeForInterval(matchedInterval),
    isRoot: matchedInterval === 0,
  };
}
