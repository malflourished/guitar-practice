import type {
  NoteName,
  ProgressionDef,
  StudyMode,
  TheoryContent,
} from '../types/music';
import { ALL_NOTES } from './colors';
import {
  formatNoteDisplay,
  formatProgressionChords,
  formatSpelled,
  getProgressionById,
  ordinalPosition,
  resolveProgression,
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
  progressionOptions?: {
    progressionId: string;
    stepIndex: number;
    chordName: string;
    numeral: string;
  },
): string {
  if (studyMode === 'progressions' && progressionOptions) {
    const progression = getProgressionById(progressionOptions.progressionId);
    const positionSuffix = positionRegion
      ? ` — ${ordinalPosition(positionRegion.number)} Position`
      : '';
    const stepLabel = `${progressionOptions.chordName} (${progressionOptions.numeral})`;
    const progressionLabel = progression?.label ?? 'Progression';
    const stepNumber = progressionOptions.stepIndex + 1;
    const stepTotal = progression?.steps.length ?? 1;
    return `${stepLabel} — ${stepNumber} of ${stepTotal} in ${progressionLabel}${positionSuffix}`;
  }

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

export function getFretboardSubtitle(
  studyMode: StudyMode,
  theory?: TheoryContent | null,
  progression?: ProgressionDef | null,
  keyRoot?: NoteName,
  notation?: NotationPreference,
): string {
  if (studyMode === 'progressions' && theory) {
    return theory.summary;
  }
  if (
    studyMode === 'progressions' &&
    progression &&
    keyRoot &&
    notation
  ) {
    const resolved = resolveProgression(keyRoot, progression, notation);
    return formatProgressionChords(resolved);
  }
  return 'Standard tuning • Frets 0–24';
}
