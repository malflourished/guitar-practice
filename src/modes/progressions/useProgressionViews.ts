import { useCallback, useMemo } from 'react';
import {
  buildClimbChordViews,
  buildClimbPlan,
  buildSavedProgressionChordViews,
  climbShapesAt,
  describeClimb,
  reachWindow,
  type FretWindow,
  type NotationPreference,
} from '../../lib/music';
import type { FretPosition, StudyMode } from '../../types/music';
import type { ProgressionsState } from './useProgressionsState';

interface ProgressionViewsInput {
  studyMode: StudyMode;
  notation: NotationPreference;
  progressions: ProgressionsState;
  /** The neck view's saved position per scope (each chord has its own). */
  positionByScope: Record<string, number>;
  /** Which playback is running (a climb swaps the shapes shown). */
  playingId: string | null;
}

/**
 * The chord shapes the Progressions panel and neck show: each chord's saved
 * position, or, while a climb plays ("Move along the neck"), the shapes of the
 * region the loop is in. The climb plan is built once, here, so the screen and
 * the guitar's strum (`positionsForPass`) read the same shapes.
 */
export function useProgressionViews({
  studyMode,
  notation,
  progressions,
  positionByScope,
  playingId,
}: ProgressionViewsInput) {
  const {
    progressionId,
    progressionStepIndex,
    resolvedProgressionSteps,
    climb,
    climbPass,
  } = progressions;

  const savedProgressionChordViews = useMemo(() => {
    if (studyMode !== 'progressions') return [];
    return buildSavedProgressionChordViews(
      resolvedProgressionSteps,
      progressionId,
      positionByScope,
      notation,
    );
  }, [
    studyMode,
    resolvedProgressionSteps,
    notation,
    progressionId,
    positionByScope,
  ]);

  const climbPlan = useMemo(
    () =>
      studyMode === 'progressions' && climb
        ? buildClimbPlan(resolvedProgressionSteps, climb)
        : null,
    [studyMode, climb, resolvedProgressionSteps],
  );

  // A climb plays under the id 'jam-up' or 'jam-down'; In place is plain 'jam'.
  const climbActive = climbPlan !== null && (playingId?.startsWith('jam-') ?? false);

  const displayProgressionChordViews = useMemo(() => {
    if (studyMode !== 'progressions') return [];
    if (climbActive && climbPlan) {
      return buildClimbChordViews(climbPlan, climbPass, notation);
    }
    return savedProgressionChordViews;
  }, [
    studyMode,
    climbActive,
    climbPlan,
    climbPass,
    notation,
    savedProgressionChordViews,
  ]);

  const activeDisplayChord =
    displayProgressionChordViews[
      Math.min(progressionStepIndex, displayProgressionChordViews.length - 1)
    ];

  const climbRegion = useMemo(() => {
    if (!climbActive || !activeDisplayChord) return undefined;
    return {
      number: activeDisplayChord.positionNumber,
      startFret: activeDisplayChord.startFret,
      endFret: activeDisplayChord.endFret,
      positions: activeDisplayChord.positions,
      mutedStrings: activeDisplayChord.mutedStrings,
    };
  }, [climbActive, activeDisplayChord]);

  /** Where the climb is and what happens next, for the deck's label. */
  const climbNow = useMemo(
    () => (climbActive && climbPlan ? describeClimb(climbPlan, climbPass) : null),
    [climbActive, climbPlan, climbPass],
  );

  /**
   * The shapes the guitar strums in a pass, one per step. The jam asks by pass
   * number, which it works out from the bar itself, because it schedules a bar
   * about 100 ms before the screen (and so `climbPass`) catches up.
   */
  const positionsForPass = useCallback(
    (pass: number): FretPosition[][] =>
      climbPlan
        ? climbShapesAt(climbPlan, pass).map((shape) => shape.positions)
        : savedProgressionChordViews.map((chord) => chord.positions),
    [climbPlan, savedProgressionChordViews],
  );

  /**
   * Where the hand is for each step of a pass: the frets of the shape the chord
   * is shown in and one more each side (null for a chord with no shape). The
   * targets for the next chord are looked for there. Asked by pass, like the
   * strum, because the change into bar 1 belongs to the next pass.
   */
  const windowsForPass = useCallback(
    (pass: number): (FretWindow | null)[] => {
      const shapes = climbPlan ? climbShapesAt(climbPlan, pass) : savedProgressionChordViews;
      return shapes.map((shape) =>
        shape && shape.positions.length > 0 ? reachWindow(shape.startFret, shape.endFret) : null,
      );
    },
    [climbPlan, savedProgressionChordViews],
  );

  return {
    savedProgressionChordViews,
    displayProgressionChordViews,
    activeDisplayChord,
    climbActive,
    climbRegion,
    climbNow,
    positionsForPass,
    windowsForPass,
  };
}

export type ProgressionViews = ReturnType<typeof useProgressionViews>;
