import type { FretPosition, NoteName } from '../../types/music';
import type { NotationPreference } from './notes';
import {
  buildSpellingMap,
  getSpelledChordNotes,
  spelledRootFromNoteName,
} from './noteSpelling';
import { buildChordPositions, type Position } from './positions';
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

/** A chord's view, drawn from a shape that is already chosen. */
export function buildChordViewFromShape(
  step: ResolvedProgressionStep,
  shape: Position | undefined,
  notation: NotationPreference,
  /** The number to show when there is no shape: its index, from 0. */
  fallbackIndex = 0,
): ProgressionChordView {
  const spelledRoot = spelledRootFromNoteName(step.root, notation);
  const spelled = getSpelledChordNotes(spelledRoot, step.quality);
  return {
    step,
    positions: shape?.positions ?? [],
    mutedStrings: shape?.mutedStrings ?? [],
    startFret: shape?.startFret ?? 0,
    endFret: shape?.endFret ?? 4,
    positionNumber: shape?.number ?? fallbackIndex + 1,
    noteLabels: buildSpellingMap(spelled),
  };
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
  return buildChordViewFromShape(step, regions[regionIndex], notation, regionIndex);
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

export interface FretRange {
  startFret: number;
  endFret: number;
}

/**
 * The region of `regions` that best matches a fret range: most fret overlap
 * wins; when nothing overlaps, the region whose centre is nearest wins. Chords
 * have different numbers of shapes, so "the same position" has to mean "the
 * same place on the neck", not the same index.
 */
export function nearestRegionIndex(
  regions: FretRange[],
  target: FretRange,
): number {
  let best = 0;
  let bestOverlap = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const targetCentre = (target.startFret + target.endFret) / 2;
  regions.forEach((region, index) => {
    const overlap = Math.max(
      0,
      Math.min(region.endFret, target.endFret) -
        Math.max(region.startFret, target.startFret),
    );
    const distance = Math.abs(
      (region.startFret + region.endFret) / 2 - targetCentre,
    );
    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap && distance < bestDistance)
    ) {
      best = index;
      bestOverlap = overlap;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * For every step, the region index nearest to a fret range — how a whole
 * progression follows one position bar. A chord with no shape in that region
 * gets its nearest shape.
 */
export function followProgressionRegions(
  steps: ResolvedProgressionStep[],
  target: FretRange,
): number[] {
  return steps.map((step) =>
    nearestRegionIndex(buildChordPositions(step.root, step.quality), target),
  );
}
