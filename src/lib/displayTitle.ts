import type { NoteName, StudyMode } from '../types/music';
import { ALL_NOTES } from './colors';
import {
  formatNoteDisplay,
  formatSpelled,
  ordinalPosition,
  spelledRootFromNoteName,
  type NotationPreference,
  type Position,
} from './music';

export function getRootNote(activeNotes: Set<NoteName>): NoteName {
  const selected = ALL_NOTES.filter((note) => activeNotes.has(note));
  return selected[0] ?? 'C';
}

export function getFretboardTitle(
  activeNotes: Set<NoteName>,
  studyMode: StudyMode,
  qualityLabel: string,
  notation: NotationPreference,
  positionRegion?: Position,
): string {
  if (studyMode !== 'notes') {
    const root = formatSpelled(
      spelledRootFromNoteName(getRootNote(activeNotes), notation),
    );
    const modeLabel =
      studyMode === 'chords'
        ? 'Chord'
        : studyMode === 'scales'
          ? 'Scale'
          : 'Arpeggio';
    const positionSuffix =
      (studyMode === 'chords' ||
        studyMode === 'scales' ||
        studyMode === 'arpeggios') &&
      positionRegion
        ? ` — ${ordinalPosition(positionRegion.number)} Position`
        : '';
    return `${root} ${qualityLabel} ${modeLabel}${positionSuffix} on the Guitar Fretboard`;
  }

  const labels = ALL_NOTES.filter((note) => activeNotes.has(note)).map((note) =>
    formatNoteDisplay(note, notation),
  );

  if (labels.length === 0) return 'Select notes to display';
  if (labels.length === 1) {
    return `Every ${labels[0]} on the Guitar Fretboard`;
  }
  if (labels.length === 12) {
    return 'Every Note on the Guitar Fretboard';
  }
  return `${labels.join(', ')} on the Guitar Fretboard`;
}
