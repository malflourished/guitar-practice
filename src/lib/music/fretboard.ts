import type { FretPosition, NoteName } from '../../types/music';
import { noteToSemitone, semitoneToNote } from './notes';
import { FRET_COUNT, OPEN_STRING_SEMITONES, STRING_COUNT } from './tuning';

export function getNoteAt(stringIndex: number, fret: number): NoteName {
  const openSemitone = OPEN_STRING_SEMITONES[stringIndex];
  return semitoneToNote(openSemitone + fret);
}

export function getPositionsForNotes(notes: Set<NoteName>): FretPosition[] {
  if (notes.size === 0) return [];

  const positions: FretPosition[] = [];

  // Fret 0 = open strings, included so open-position notes/chords appear.
  for (let string = 0; string < STRING_COUNT; string++) {
    for (let fret = 0; fret <= FRET_COUNT; fret++) {
      const note = getNoteAt(string, fret);
      if (notes.has(note)) {
        positions.push({ string, fret, note });
      }
    }
  }

  return positions;
}

export function getPositionsForIntervals(
  root: NoteName,
  intervals: number[],
): FretPosition[] {
  const rootSemitone = noteToSemitone(root);
  const targetSemitones = new Set(
    intervals.map((interval) => (rootSemitone + interval) % 12),
  );
  const targetNotes = new Set<NoteName>();

  for (const semitone of targetSemitones) {
    targetNotes.add(semitoneToNote(semitone));
  }

  return getPositionsForNotes(targetNotes);
}
