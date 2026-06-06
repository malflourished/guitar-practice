import type { NotationPreference } from './notes';
import type { ResolvedProgressionStep } from './progressions';
import { buildChordPositions } from './positions';
import {
  buildProgressionChordView,
  type ProgressionChordView,
} from './progressionChordViews';

export type ProgressionLadderDirection = 'ascending' | 'descending';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Shrink anchor so ladder indices stay monotonic across uneven region counts. */
export function capEffectiveAnchor(
  regionCounts: number[],
  requestedAnchor: number,
  direction: ProgressionLadderDirection,
): number {
  const stepCount = regionCounts.length;
  if (stepCount === 0) return Math.max(0, requestedAnchor);

  let spreadCap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < stepCount; i++) {
    const maxIndex = Math.max(0, regionCounts[i] - 1);
    const offset = direction === 'ascending' ? i : stepCount - 1 - i;
    spreadCap = Math.min(spreadCap, maxIndex - offset);
  }

  const capped = Math.min(requestedAnchor, spreadCap);
  return Math.max(0, capped);
}

export function getLadderPositionIndex(
  stepIndex: number,
  stepCount: number,
  effectiveAnchor: number,
  direction: ProgressionLadderDirection,
  regionCount: number,
): number {
  const maxIndex = Math.max(0, regionCount - 1);
  const offset =
    direction === 'ascending' ? stepIndex : stepCount - 1 - stepIndex;
  return clamp(effectiveAnchor + offset, 0, maxIndex);
}

export function buildLadderProgressionChordViews(
  steps: ResolvedProgressionStep[],
  requestedAnchor: number,
  direction: ProgressionLadderDirection,
  notation: NotationPreference,
): ProgressionChordView[] {
  const regionCounts = steps.map(
    (step) => buildChordPositions(step.root, step.quality).length,
  );
  const effectiveAnchor = capEffectiveAnchor(
    regionCounts,
    requestedAnchor,
    direction,
  );
  const stepCount = steps.length;

  return steps.map((step, stepIndex) => {
    const positionIndex = getLadderPositionIndex(
      stepIndex,
      stepCount,
      effectiveAnchor,
      direction,
      regionCounts[stepIndex],
    );
    return buildProgressionChordView(step, positionIndex, notation);
  });
}
