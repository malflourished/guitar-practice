import type { FretPosition, NeckViewMode } from '../../types/music';
import type { Position } from './positions';

/** Stable identity for a fretboard cell. */
export function cellKey(position: Pick<FretPosition, 'string' | 'fret'>): string {
  return `${position.string}:${position.fret}`;
}

export interface GhostLayer {
  positions: FretPosition[];
  /** `near` = adjacent to the active box; `far` = everything else (full view). */
  tier: 'near' | 'far';
}

export interface NeckViewLayers {
  /** Dimmed neighbor/remaining boxes, deduped against the active box. */
  ghosts: GhostLayer[];
  /** Cells the active box shares with an adjacent box — the transition rungs. */
  overlapKeys: Set<string>;
}

/**
 * Compute the onion-skin layers for a neck view.
 *
 * The active region renders normally (handled by the caller); this returns the
 * dimmed context boxes around it. Ghost cells already covered by the active box
 * (or a nearer ghost) are dropped so each fretboard cell renders exactly once.
 * Overlap keys mark active-box notes that also live in an adjacent box — the
 * shared rungs you pivot on when shifting position.
 */
export function buildNeckViewLayers(
  regions: Position[],
  activeIndex: number,
  mode: NeckViewMode,
): NeckViewLayers {
  const active = regions[activeIndex];
  if (!active || mode === 'single' || regions.length < 2) {
    return { ghosts: [], overlapKeys: new Set() };
  }

  const activeCells = new Set(active.positions.map(cellKey));

  const overlapKeys = new Set<string>();
  for (const neighborIndex of [activeIndex - 1, activeIndex + 1]) {
    const neighbor = regions[neighborIndex];
    if (!neighbor) continue;
    for (const position of neighbor.positions) {
      const key = cellKey(position);
      if (activeCells.has(key)) overlapKeys.add(key);
    }
  }

  const seen = new Set(activeCells);
  const ghosts: GhostLayer[] = [];

  const addGhost = (region: Position, tier: 'near' | 'far') => {
    const positions = region.positions.filter((position) => {
      const key = cellKey(position);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (positions.length > 0) ghosts.push({ positions, tier });
  };

  for (const neighborIndex of [activeIndex - 1, activeIndex + 1]) {
    const neighbor = regions[neighborIndex];
    if (neighbor) addGhost(neighbor, 'near');
  }

  if (mode === 'full') {
    for (let index = 0; index < regions.length; index++) {
      if (Math.abs(index - activeIndex) <= 1) continue;
      addGhost(regions[index], 'far');
    }
  }

  return { ghosts, overlapKeys };
}

export interface RegionBadge {
  /** Region index in the original `regions` array. */
  index: number;
  /** Fret at the visual center of the region, for badge placement. */
  centerFret: number;
  /** Short label: CAGED letter when known, else the position number. */
  label: string;
  isActive: boolean;
}

/**
 * One badge per region for connected/full views, so each box is identified on
 * the board itself ("G", "E", … or "1", "2", …). Skips regions outside the
 * view (non-adjacent boxes in connected mode).
 */
export function buildRegionBadges(
  regions: Position[],
  activeIndex: number,
  mode: NeckViewMode,
): RegionBadge[] {
  if (mode === 'single' || regions.length < 2) return [];

  const badges: RegionBadge[] = [];
  for (let index = 0; index < regions.length; index++) {
    if (mode === 'connected' && Math.abs(index - activeIndex) > 1) continue;
    const region = regions[index];
    badges.push({
      index,
      centerFret: (region.startFret + region.endFret) / 2,
      label: region.shapeLabel
        ? region.shapeLabel.replace(' shape', '')
        : String(region.number),
      isActive: index === activeIndex,
    });
  }
  return badges;
}
