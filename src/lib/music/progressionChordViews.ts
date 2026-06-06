import type { FretPosition, NoteName } from '../../types/music';
import type { NotationPreference } from './notes';
import {
  buildSpellingMap,
  getSpelledChordNotes,
  spelledRootFromNoteName,
} from './noteSpelling';
import { buildChordPositions } from './positions';
import {
  getProgressionStepPositionScope,
  type ResolvedProgressionStep,
} from './progressions';

export interface ProgressionChordView {
  step: ResolvedProgressionStep;
  positions: FretPosition[];
  mutedStrings: number[];
  startFret: number;
  endFret: number;
  positionNumber: number;
  noteLabels: Map<NoteName, string>;
}

export function buildProgressionChordView(
  step: ResolvedProgressionStep,
  positionIndex: number,
  notation: NotationPreference,
): ProgressionChordView {
  const regions = buildChordPositions(step.root, step.quality);
  const regionIndex = Math.min(
    positionIndex,
    Math.max(0, regions.length - 1),
  );
  const region = regions[regionIndex];
  const spelledRoot = spelledRootFromNoteName(step.root, notation);
  const spelled = getSpelledChordNotes(spelledRoot, step.quality);
  return {
    step,
    positions: region?.positions ?? [],
    mutedStrings: region?.mutedStrings ?? [],
    startFret: region?.startFret ?? 0,
    endFret: region?.endFret ?? 4,
    positionNumber: region?.number ?? regionIndex + 1,
    noteLabels: buildSpellingMap(spelled),
  };
}

export function buildSavedProgressionChordViews(
  steps: ResolvedProgressionStep[],
  progressionId: string,
  positionByScope: Record<string, number>,
  notation: NotationPreference,
): ProgressionChordView[] {
  return steps.map((step, stepIndex) => {
    const scope = getProgressionStepPositionScope(
      progressionId,
      stepIndex,
      step.quality,
    );
    const regionIndex = positionByScope[scope] ?? 0;
    return buildProgressionChordView(step, regionIndex, notation);
  });
}
