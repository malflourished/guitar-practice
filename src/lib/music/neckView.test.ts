import { describe, expect, it } from 'vitest';
import { buildScalePositions } from './positions';
import { buildNeckViewLayers, buildRegionBadges, cellKey } from './neckView';

describe('buildNeckViewLayers', () => {
  const regions = buildScalePositions('A', 'minorPentatonic');

  it('single view has no ghosts and no overlaps', () => {
    const layers = buildNeckViewLayers(regions, 0, 'single');
    expect(layers.ghosts).toHaveLength(0);
    expect(layers.overlapKeys.size).toBe(0);
  });

  it('connected view ghosts only the adjacent boxes', () => {
    const layers = buildNeckViewLayers(regions, 2, 'connected');
    expect(layers.ghosts).toHaveLength(2);
    expect(layers.ghosts.every((ghost) => ghost.tier === 'near')).toBe(true);
  });

  it('connected view at the first box has a single neighbor', () => {
    const layers = buildNeckViewLayers(regions, 0, 'connected');
    expect(layers.ghosts).toHaveLength(1);
  });

  it('full view covers every region', () => {
    const layers = buildNeckViewLayers(regions, 0, 'full');
    const tiers = layers.ghosts.map((ghost) => ghost.tier);
    expect(tiers.filter((tier) => tier === 'near')).toHaveLength(1);
    expect(tiers.filter((tier) => tier === 'far')).toHaveLength(3);
  });

  it('ghost cells never duplicate active cells or each other', () => {
    const layers = buildNeckViewLayers(regions, 2, 'full');
    const activeCells = new Set(regions[2].positions.map(cellKey));
    const seen = new Set<string>();
    for (const ghost of layers.ghosts) {
      for (const position of ghost.positions) {
        const key = cellKey(position);
        expect(activeCells.has(key)).toBe(false);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('overlap keys are exactly the shared rungs with adjacent boxes', () => {
    const layers = buildNeckViewLayers(regions, 1, 'connected');
    const activeCells = new Set(regions[1].positions.map(cellKey));
    const neighborCells = new Set([
      ...regions[0].positions.map(cellKey),
      ...regions[2].positions.map(cellKey),
    ]);
    for (const key of layers.overlapKeys) {
      expect(activeCells.has(key)).toBe(true);
      expect(neighborCells.has(key)).toBe(true);
    }
    // Pentatonic boxes tile the neck sharing low-E rungs, so overlap is never empty.
    expect(layers.overlapKeys.size).toBeGreaterThan(0);
  });
});

describe('buildRegionBadges', () => {
  const regions = buildScalePositions('A', 'minorPentatonic');

  it('returns nothing in single view', () => {
    expect(buildRegionBadges(regions, 0, 'single')).toHaveLength(0);
  });

  it('full view labels every box with its CAGED letter', () => {
    const badges = buildRegionBadges(regions, 0, 'full');
    expect(badges).toHaveLength(5);
    // A minor pentatonic ascending boxes: open box first (A shape), root box third? —
    // assert via shapeLabel consistency instead of hardcoding order.
    for (const badge of badges) {
      const region = regions[badge.index];
      expect(badge.label).toBe(
        region.shapeLabel ? region.shapeLabel.replace(' shape', '') : String(region.number),
      );
    }
    expect(badges.filter((badge) => badge.isActive)).toHaveLength(1);
  });

  it('connected view only badges the active box and neighbors', () => {
    const badges = buildRegionBadges(regions, 2, 'connected');
    expect(badges.map((badge) => badge.index)).toEqual([1, 2, 3]);
  });

  it('3NPS positions fall back to numeric labels', () => {
    const threeNps = buildScalePositions('C', 'major', '3nps');
    const badges = buildRegionBadges(threeNps, 0, 'full');
    expect(badges.map((badge) => badge.label)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
  });
});

describe('CAGED shape labels', () => {
  it('A minor pentatonic root box is the E shape', () => {
    const boxes = buildScalePositions('A', 'minorPentatonic');
    const rootBox = boxes.find((box) => box.startFret === 5);
    expect(rootBox?.shapeLabel).toBe('E shape');
  });

  it('C major box across frets 5–8 is the G shape', () => {
    const boxes = buildScalePositions('C', 'major', 'caged');
    const box = boxes.find((b) => b.startFret === 5);
    expect(box?.shapeLabel).toBe('G shape');
  });

  it('C major open box is the C shape', () => {
    const boxes = buildScalePositions('C', 'major', 'caged');
    expect(boxes[0].shapeLabel).toBe('C shape');
  });

  it('3NPS positions carry no shape label', () => {
    const positions = buildScalePositions('C', 'major', '3nps');
    for (const position of positions) {
      expect(position.shapeLabel).toBeUndefined();
    }
  });
});
