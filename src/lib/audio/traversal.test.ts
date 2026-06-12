import { describe, expect, it } from 'vitest';
import { buildScalePositions } from '../music';
import { positionToMidi } from './pitch';
import { buildTraversalRun } from './traversal';

describe('buildTraversalRun', () => {
  const regions = buildScalePositions('A', 'minorPentatonic');

  it('visits every region in order, ascending', () => {
    const run = buildTraversalRun(regions, 'A', 'ascending', 'pitch');
    const visited = [...new Set(run.regionForNote)];
    expect(visited).toEqual([0, 1, 2, 3, 4]);
    expect(run.positions).toHaveLength(run.regionForNote.length);
  });

  it('visits regions in reverse, descending', () => {
    const run = buildTraversalRun(regions, 'A', 'descending', 'pitch');
    const visited = [...new Set(run.regionForNote)];
    expect(visited).toEqual([4, 3, 2, 1, 0]);
  });

  it('each ascending segment climbs in pitch', () => {
    const run = buildTraversalRun(regions, 'A', 'ascending', 'pitch');
    for (let i = 1; i < run.positions.length; i++) {
      if (run.regionForNote[i] !== run.regionForNote[i - 1]) continue;
      expect(positionToMidi(run.positions[i])).toBeGreaterThan(
        positionToMidi(run.positions[i - 1]),
      );
    }
  });

  it('segments start lower than the previous segment peak overall', () => {
    // Region boundaries step the run back down to the next box's root — the
    // overall trend across segment starts must still climb the neck.
    const run = buildTraversalRun(regions, 'A', 'ascending', 'pitch');
    const starts: number[] = [];
    for (let i = 0; i < run.positions.length; i++) {
      if (i === 0 || run.regionForNote[i] !== run.regionForNote[i - 1]) {
        starts.push(positionToMidi(run.positions[i]));
      }
    }
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
    }
  });
});
