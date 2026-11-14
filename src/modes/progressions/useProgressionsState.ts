import { useMemo, useState } from 'react';
import {
  PROGRESSIONS,
  getProgressionById,
  resolveProgression,
  type ClimbChoice,
  type NotationPreference,
} from '../../lib/music';
import { oneOf, usePersistentState } from '../../hooks/usePersistentState';
import type { ChordQuality, NoteName, StudyMode } from '../../types/music';

interface ProgressionsInput {
  studyMode: StudyMode;
  rootNote: NoteName;
  notation: NotationPreference;
  chordQuality: ChordQuality;
}

export function useProgressionsState({
  studyMode,
  rootNote,
  notation,
  chordQuality,
}: ProgressionsInput) {
  const [progressionId, setProgressionId] = usePersistentState(
    'progression-id',
    PROGRESSIONS[0].id,
    oneOf(PROGRESSIONS.map((progression) => progression.id)),
  );
  const [progressionStepIndex, setProgressionStepIndex] = useState(0);
  // Move along the neck: what Play chose (null for In place), and the pass the
  // loop is on, which the jam sets at each beat so the neck and the panel show
  // that pass's region.
  const [climb, setClimb] = useState<ClimbChoice | null>(null);
  const [climbPass, setClimbPass] = useState(0);

  const activeProgression = useMemo(
    () => getProgressionById(progressionId) ?? PROGRESSIONS[0],
    [progressionId],
  );

  const resolvedProgressionSteps = useMemo(
    () => resolveProgression(rootNote, activeProgression, notation),
    [rootNote, activeProgression, notation],
  );

  const activeProgressionStep =
    resolvedProgressionSteps[
      Math.min(progressionStepIndex, resolvedProgressionSteps.length - 1)
    ];

  const activeChordRoot =
    studyMode === 'progressions'
      ? (activeProgressionStep?.root ?? rootNote)
      : rootNote;

  const activeChordQuality =
    studyMode === 'progressions'
      ? (activeProgressionStep?.quality ?? chordQuality)
      : chordQuality;

  const currentStepRole = useMemo(() => {
    if (studyMode !== 'progressions' || !activeProgressionStep) return undefined;
    return activeProgression.theory.functions?.find(
      (fn) => fn.numeral === activeProgressionStep.numeral,
    )?.role;
  }, [studyMode, activeProgression, activeProgressionStep]);

  const handleProgressionChange = (id: string) => {
    setProgressionId(id);
    setProgressionStepIndex(0);
  };

  return {
    progressionId,
    setProgressionId,
    progressionStepIndex,
    setProgressionStepIndex,
    climb,
    setClimb,
    climbPass,
    setClimbPass,
    activeProgression,
    resolvedProgressionSteps,
    activeProgressionStep,
    activeChordRoot,
    activeChordQuality,
    currentStepRole,
    handleProgressionChange,
  };
}

export type ProgressionsState = ReturnType<typeof useProgressionsState>;
