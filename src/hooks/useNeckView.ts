import { useMemo } from 'react';
import type { NeckViewMode } from '../types/music';
import {
  buildNeckViewLayers,
  buildRegionBadges,
  type NeckViewLayers,
  type Position,
  type RegionBadge,
} from '../lib/music';
import { usePersistentState } from './usePersistentState';

const isIndexRecord = (value: unknown): value is Record<string, number> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface UseNeckView {
  /** Active position index for the current scope (the primary slider handle). */
  positionIndex: number;
  setPositionIndex: (index: number) => void;
  /** Secondary handle index; equals positionIndex when the span is collapsed. */
  spanEndIndex: number;
  setSpanEndIndex: (index: number) => void;
  /** Low/high bounds of the visible span (inclusive), already clamped. */
  rangeStart: number;
  rangeEnd: number;
  /** Apply a semantic preset (used by theory demos/practice links). */
  applySpanPreset: (preset: NeckViewMode) => void;
  activeRegion: Position | undefined;
  /** Raw saved-position map; progressions read per-step scopes from it. */
  positionByScope: Record<string, number>;
  /** Onion-skin layers across the visible span. */
  layers: NeckViewLayers;
  /** Per-box labels rendered on the board across the visible span. */
  badges: RegionBadge[];
}

/**
 * Neck view state: which position box is active per scope and how wide a
 * contiguous span of boxes is shown around it. The active position is one end
 * of the span; the second handle is the other end. When both handles sit on the
 * same box the span is collapsed to a single position. Both the active position
 * and the span end persist per scope across sessions.
 */
export function useNeckView(
  scope: string,
  regions: Position[],
  options: { neckViewEnabled: boolean },
): UseNeckView {
  const [positionByScope, setPositionByScope] = usePersistentState<
    Record<string, number>
  >('position-by-scope', {}, isIndexRecord);
  const [spanEndByScope, setSpanEndByScope] = usePersistentState<
    Record<string, number>
  >('span-end-by-scope', {}, isIndexRecord);

  const lastIndex = Math.max(0, regions.length - 1);
  const positionIndex = Math.min(positionByScope[scope] ?? 0, lastIndex);

  const rawSpanEnd = spanEndByScope[scope];
  const spanEndIndex = options.neckViewEnabled
    ? Math.min(rawSpanEnd ?? positionIndex, lastIndex)
    : positionIndex;

  const rangeStart = Math.min(positionIndex, spanEndIndex);
  const rangeEnd = Math.max(positionIndex, spanEndIndex);

  const setPositionIndex = (index: number) => {
    setPositionByScope((prev) => ({ ...prev, [scope]: index }));
    // Keep a collapsed span collapsed as the active handle moves; leave an open
    // span anchored so the range simply redefines around the new active box.
    setSpanEndByScope((prev) => {
      const current = prev[scope] ?? positionIndex;
      if (current === positionIndex) return { ...prev, [scope]: index };
      return prev;
    });
  };

  const setSpanEndIndex = (index: number) => {
    setSpanEndByScope((prev) => ({ ...prev, [scope]: index }));
  };

  const applySpanPreset = (preset: NeckViewMode) => {
    if (preset === 'single') {
      setSpanEndByScope((prev) => ({ ...prev, [scope]: positionIndex }));
      return;
    }
    if (preset === 'full') {
      // Anchor the active box at the start so the whole neck is one span.
      setPositionByScope((prev) => ({ ...prev, [scope]: 0 }));
      setSpanEndByScope((prev) => ({ ...prev, [scope]: lastIndex }));
      return;
    }
    // connected: active box plus its next neighbour.
    const neighbour = positionIndex < lastIndex ? positionIndex + 1 : positionIndex - 1;
    setSpanEndByScope((prev) => ({
      ...prev,
      [scope]: Math.max(0, neighbour),
    }));
  };

  const activeRegion = regions[positionIndex];

  const layers = useMemo(
    () => buildNeckViewLayers(regions, positionIndex, rangeStart, rangeEnd),
    [regions, positionIndex, rangeStart, rangeEnd],
  );

  const badges = useMemo(
    () => buildRegionBadges(regions, positionIndex, rangeStart, rangeEnd),
    [regions, positionIndex, rangeStart, rangeEnd],
  );

  return {
    positionIndex,
    setPositionIndex,
    spanEndIndex,
    setSpanEndIndex,
    rangeStart,
    rangeEnd,
    applySpanPreset,
    activeRegion,
    positionByScope,
    layers,
    badges,
  };
}
