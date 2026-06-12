import type { FretPosition, NoteName } from '../../types/music';
import type { Position } from '../music';
import {
  orderScalePositions,
  type ScaleDirection,
  type ScaleOrdering,
} from './pitch';

export interface TraversalRun {
  /** Every note of the run, position by position across the neck. */
  positions: FretPosition[];
  /** Region index (into the original `regions` array) for each note. */
  regionForNote: number[];
}

/**
 * Build a full-neck traversal: each position box played as a root-anchored run,
 * one after another, climbing (or descending) the neck. `regionForNote` lets
 * the UI advance the displayed box in lockstep with playback — the core
 * "link the boxes together" practice loop.
 */
export function buildTraversalRun(
  regions: Position[],
  root: NoteName,
  direction: ScaleDirection,
  ordering: ScaleOrdering,
  anchorPc?: number,
): TraversalRun {
  const orderedRegions =
    direction === 'ascending' ? regions : [...regions].reverse();

  const positions: FretPosition[] = [];
  const regionForNote: number[] = [];

  for (const region of orderedRegions) {
    const run = orderScalePositions(region.positions, root, direction, {
      ordering,
      anchorPc,
    });
    const regionIndex = regions.indexOf(region);
    for (const note of run) {
      positions.push(note);
      regionForNote.push(regionIndex);
    }
  }

  return { positions, regionForNote };
}
