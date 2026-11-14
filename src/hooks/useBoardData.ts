import { useMemo } from 'react';
import { getFretboardTitle } from '../lib/displayTitle';
import {
  buildSpellingMap,
  getPositionsForNotes,
  getSpelledChordNotes,
  getSpelledScaleNotes,
  spelledRootFromNoteName,
} from '../lib/music';
import type { StudyMode } from '../types/music';
import type { ChordsState } from '../modes/chords/useChordsState';
import type { ProgressionViews } from '../modes/progressions/useProgressionViews';
import type { ProgressionsState } from '../modes/progressions/useProgressionsState';
import type { ScalesState } from '../modes/scales/useScalesState';
import type { TheoryState } from '../modes/theory/useTheoryState';
import type { KeyState } from './useKeyState';
import type { NeckPosition } from './useNeckPosition';

interface BoardDataInput {
  studyMode: StudyMode;
  keyState: KeyState;
  chords: ChordsState;
  scales: ScalesState;
  progressions: ProgressionsState;
  theory: TheoryState;
  neck: NeckPosition;
  progressionViews: ProgressionViews;
}

/** What the fretboard draws: the dots, muted strings, note names and the title. */
export function useBoardData({
  studyMode,
  keyState,
  chords,
  scales,
  progressions,
  theory,
  neck,
  progressionViews,
}: BoardDataInput) {
  const { activeNotes, rootNote, notation } = keyState;
  const { chordQuality } = chords;
  const { scaleQuality, impliedChordQuality } = scales;
  const {
    progressionId,
    progressionStepIndex,
    activeProgressionStep,
    activeChordRoot,
    activeChordQuality,
  } = progressions;
  const { theoryShowFretboard, theoryScaleQuality, activeTheoryTopic } = theory;
  const { qualityLabel, activePositionRegion } = neck;
  const { climbActive, activeDisplayChord, climbRegion } =
    progressionViews;

  const highlightRoot =
    studyMode === 'progressions' ? activeChordRoot : rootNote;

  const highlightChordQuality =
    studyMode === 'progressions'
      ? activeChordQuality
      : studyMode === 'scales'
        ? impliedChordQuality
        : chordQuality;

  const supportsChordTones =
    studyMode === 'chords' ||
    studyMode === 'scales' ||
    studyMode === 'progressions';

  const positions = useMemo(() => {
    if (studyMode === 'notes') {
      return getPositionsForNotes(activeNotes);
    }
    if (studyMode === 'theory' && !theoryShowFretboard) {
      return [];
    }
    if (studyMode === 'progressions' && climbActive && activeDisplayChord) {
      return activeDisplayChord.positions;
    }
    return activePositionRegion ? activePositionRegion.positions : [];
  }, [
    activeNotes,
    studyMode,
    theoryShowFretboard,
    climbActive,
    activeDisplayChord,
    activePositionRegion,
  ]);

  const mutedStrings = useMemo(() => {
    if (studyMode === 'progressions' && climbActive && activeDisplayChord) {
      return activeDisplayChord.mutedStrings;
    }
    return activePositionRegion?.mutedStrings ?? [];
  }, [studyMode, climbActive, activeDisplayChord, activePositionRegion]);

  const spellingMap = useMemo(() => {
    if (studyMode === 'notes' || (studyMode === 'theory' && !theoryShowFretboard)) {
      return null;
    }
    if (studyMode === 'progressions' && climbActive && activeDisplayChord) {
      return activeDisplayChord.noteLabels;
    }
    const spellingRoot =
      studyMode === 'progressions' ? activeChordRoot : rootNote;
    const spelledRoot = spelledRootFromNoteName(spellingRoot, notation);
    const spelled =
      studyMode === 'scales' || studyMode === 'theory'
        ? getSpelledScaleNotes(
            spelledRoot,
            studyMode === 'theory' ? theoryScaleQuality : scaleQuality,
          )
        : getSpelledChordNotes(
            spelledRoot,
            studyMode === 'progressions'
              ? activeChordQuality
              : chordQuality,
          );
    return buildSpellingMap(spelled);
  }, [
    studyMode,
    rootNote,
    activeChordRoot,
    scaleQuality,
    theoryScaleQuality,
    theoryShowFretboard,
    chordQuality,
    activeChordQuality,
    notation,
    climbActive,
    activeDisplayChord,
  ]);

  const title = useMemo(
    () => {
      if (studyMode === 'theory' && !theoryShowFretboard) {
        return activeTheoryTopic.title;
      }
      if (studyMode === 'theory' && theoryShowFretboard) {
        return getFretboardTitle(
          activeNotes,
          'scales',
          qualityLabel,
          notation,
          activePositionRegion,
          undefined,
          spellingMap,
        );
      }
      return getFretboardTitle(
        activeNotes,
        studyMode,
        qualityLabel,
        notation,
        climbActive ? climbRegion : activePositionRegion,
        studyMode === 'progressions' && activeProgressionStep
          ? {
              progressionId,
              stepIndex: progressionStepIndex,
              chordName: activeProgressionStep.chordName,
              numeral: activeProgressionStep.numeral,
            }
          : undefined,
        spellingMap,
      );
    },
    [
      spellingMap,
      activeNotes,
      studyMode,
      qualityLabel,
      notation,
      climbActive,
      climbRegion,
      activePositionRegion,
      progressionId,
      progressionStepIndex,
      activeProgressionStep,
      theoryShowFretboard,
      activeTheoryTopic,
    ],
  );

  return {
    highlightRoot,
    highlightChordQuality,
    supportsChordTones,
    positions,
    mutedStrings,
    spellingMap,
    title,
  };
}

export type BoardData = ReturnType<typeof useBoardData>;
