import { describe, expect, it } from 'vitest';
import {
  capEffectiveAnchor,
  getLadderPositionIndex,
} from './progressionLadder';

describe('capEffectiveAnchor', () => {
  it('passes through a valid ascending anchor unchanged', () => {
    expect(capEffectiveAnchor([5, 4, 5], 0, 'ascending')).toBe(0);
  });

  it('caps ascending anchor when the top step would clamp downward', () => {
    // max indices [4, 3, 2] → spread cap min(4, 2, 0) = 0; anchor 2 → 0
    expect(capEffectiveAnchor([5, 4, 3], 2, 'ascending')).toBe(0);
    const indices = [5, 4, 3].map((count, i) =>
      getLadderPositionIndex(i, 3, 0, 'ascending', count),
    );
    expect(indices).toEqual([0, 1, 2]);
  });

  it('caps ascending anchor to keep indices monotonic with plateau', () => {
    const counts = [5, 4, 4];
    const effective = capEffectiveAnchor(counts, 2, 'ascending');
    expect(effective).toBe(1);
    const indices = counts.map((count, i) =>
      getLadderPositionIndex(i, 3, effective, 'ascending', count),
    );
    expect(indices[0]).toBeLessThanOrEqual(indices[1]);
    expect(indices[1]).toBeLessThanOrEqual(indices[2]);
    expect(indices).toEqual([1, 2, 3]);
  });

  it('keeps descending indices monotonic when anchor fits', () => {
    const counts = [5, 4, 3];
    const effective = capEffectiveAnchor(counts, 0, 'descending');
    expect(effective).toBe(0);
    const indices = counts.map((count, i) =>
      getLadderPositionIndex(i, 3, effective, 'descending', count),
    );
    expect(indices).toEqual([2, 1, 0]);
  });

  it('caps descending anchor when spread exceeds a short chord', () => {
    const counts = [5, 4, 3];
    const effective = capEffectiveAnchor(counts, 5, 'descending');
    expect(effective).toBe(2);
    const indices = counts.map((count, i) =>
      getLadderPositionIndex(i, 3, effective, 'descending', count),
    );
    expect(indices[0]).toBeGreaterThanOrEqual(indices[1]);
    expect(indices[1]).toBeGreaterThanOrEqual(indices[2]);
  });

  it('collapses to anchor for a single-step progression', () => {
    expect(capEffectiveAnchor([4], 3, 'ascending')).toBe(3);
    expect(
      getLadderPositionIndex(0, 1, 3, 'ascending', 4),
    ).toBe(3);
    expect(
      getLadderPositionIndex(0, 1, 3, 'descending', 4),
    ).toBe(3);
  });
});

describe('getLadderPositionIndex', () => {
  it('ascends by step offset from effective anchor', () => {
    expect(getLadderPositionIndex(0, 3, 1, 'ascending', 5)).toBe(1);
    expect(getLadderPositionIndex(1, 3, 1, 'ascending', 4)).toBe(2);
    expect(getLadderPositionIndex(2, 3, 1, 'ascending', 5)).toBe(3);
  });

  it('descends by reversed offset from effective anchor', () => {
    expect(getLadderPositionIndex(0, 3, 0, 'descending', 5)).toBe(2);
    expect(getLadderPositionIndex(1, 3, 0, 'descending', 4)).toBe(1);
    expect(getLadderPositionIndex(2, 3, 0, 'descending', 5)).toBe(0);
  });

  it('defensively clamps to region bounds', () => {
    expect(getLadderPositionIndex(2, 3, 5, 'ascending', 3)).toBe(2);
  });
});
