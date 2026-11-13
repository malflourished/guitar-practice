import { useMemo } from 'react';
import {
  buildLadderProgressionChordViews,
  buildSavedProgressionChordViews,
  type NotationPreference,
  type ProgressionLadderDirection,
} from '../../lib/music';
import type { StudyMode } from '../../types/music';
import type { ProgressionsState } from './useProgressionsState';

interface ProgressionViewsInput {
  studyMode: StudyMode;
  notation: NotationPreference;
  progressions: ProgressionsState;
  /** The neck view's saved position per scope (each chord has its own). */
  positionByScope: Record<string, number>;
  /** Which playback is running (a ladder run swaps the shapes shown). */
  playingId: string | null;
}

/**
 * The chord shapes the Progressions panel and neck show: each chord's saved
 * position, or, while a ladder run plays, the shapes the ladder walks through.
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
    ladderAnchor,
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

  const ladderDirection: ProgressionLadderDirection | null =
    playingId === 'jam-ascending'
      ? 'ascending'
      : playingId === 'jam-descending'
        ? 'descending'
        : null;

  const ladderActive = ladderDirection !== null && ladderAnchor !== null;

  const displayProgressionChordViews = useMemo(() => {
    if (studyMode !== 'progressions') return [];
    if (ladderActive && ladderDirection && ladderAnchor !== null) {
      return buildLadderProgressionChordViews(
        resolvedProgressionSteps,
        ladderAnchor,
        ladderDirection,
        notation,
      );
    }
    return savedProgressionChordViews;
  }, [
    studyMode,
    ladderActive,
    ladderDirection,
    ladderAnchor,
    resolvedProgressionSteps,
    notation,
    savedProgressionChordViews,
  ]);

  const activeDisplayChord =
    displayProgressionChordViews[
      Math.min(progressionStepIndex, displayProgressionChordViews.length - 1)
    ];

  const ladderPositionRegion = useMemo(() => {
    if (!ladderActive || !activeDisplayChord) return undefined;
    return {
      number: activeDisplayChord.positionNumber,
      startFret: activeDisplayChord.startFret,
      endFret: activeDisplayChord.endFret,
      positions: activeDisplayChord.positions,
      mutedStrings: activeDisplayChord.mutedStrings,
    };
  }, [ladderActive, activeDisplayChord]);

  return {
    savedProgressionChordViews,
    displayProgressionChordViews,
    activeDisplayChord,
    ladderActive,
    ladderPositionRegion,
  };
}

export type ProgressionViews = ReturnType<typeof useProgressionViews>;
