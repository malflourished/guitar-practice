import { describe, expect, it } from 'vitest';
import {
  followProgressionRegions,
  nearestRegionIndex,
} from './progressionChordViews';
import { buildChordPositions } from './positions';
import { resolveProgression, PROGRESSIONS } from './progressions';

describe('nearestRegionIndex', () => {
  const regions = [
    { startFret: 0, endFret: 3 },
    { startFret: 3, endFret: 6 },
    { startFret: 7, endFret: 10 },
    { startFret: 12, endFret: 15 },
  ];

  it('prefers the region that overlaps the target most', () => {
    expect(nearestRegionIndex(regions, { startFret: 6, endFret: 10 })).toBe(2);
  });

  it('falls back to the nearest centre when nothing overlaps', () => {
    expect(nearestRegionIndex(regions, { startFret: 20, endFret: 22 })).toBe(3);
    expect(nearestRegionIndex(regions, { startFret: 10.5, endFret: 11 })).toBe(2);
  });
});

describe('followProgressionRegions', () => {
  it('moves every chord to a shape near the chosen frets', () => {
    const steps = resolveProgression('C', PROGRESSIONS[0], 'sharps');
    const target = { startFret: 7, endFret: 10 };
    const indices = followProgressionRegions(steps, target);
    expect(indices).toHaveLength(steps.length);
    indices.forEach((regionIndex, i) => {
      const regions = buildChordPositions(steps[i].root, steps[i].quality);
      const chosen = regions[regionIndex];
      // Chord shapes are ~3 frets wide, so the nearest one sits close by.
      const centre = (chosen.startFret + chosen.endFret) / 2;
      expect(Math.abs(centre - 8.5)).toBeLessThanOrEqual(4);
    });
  });
});
