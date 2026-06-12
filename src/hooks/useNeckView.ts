import { useMemo } from 'react';
import type { NeckViewMode } from '../types/music';
import {
  buildNeckViewLayers,
  buildRegionBadges,
  type NeckViewLayers,
  type Position,
  type RegionBadge,
} from '../lib/music';
import { oneOf, usePersistentState } from './usePersistentState';

const NECK_VIEW_MODES = ['single', 'connected', 'full'] as const;

export interface UseNeckView {
  viewMode: NeckViewMode;
  setViewMode: (mode: NeckViewMode) => void;
  /** Active position index for the current scope, clamped to region count. */
  positionIndex: number;
  setPositionIndex: (index: number) => void;
  activeRegion: Position | undefined;
  /** Raw saved-position map; progressions read per-step scopes from it. */
  positionByScope: Record<string, number>;
  /** Onion-skin layers around the active region for the current view mode. */
  layers: NeckViewLayers;
  /** Per-box labels rendered on the board in connected/full views. */
  badges: RegionBadge[];
}

/**
 * Neck view state: which position box is active per scope and how much of the
 * neck is shown around it. Owns the single-active-region assumption that used
 * to live inline in App.tsx, so multi-region rendering has one home. Both the
 * view mode and the per-scope positions persist across sessions.
 */
export function useNeckView(
  scope: string,
  regions: Position[],
  options: { neckViewEnabled: boolean },
): UseNeckView {
  const [viewMode, setViewMode] = usePersistentState<NeckViewMode>(
    'neck-view',
    'single',
    oneOf(NECK_VIEW_MODES),
  );
  const [positionByScope, setPositionByScope] = usePersistentState<
    Record<string, number>
  >('position-by-scope', {}, (value): value is Record<string, number> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  );

  const positionIndex = Math.min(
    positionByScope[scope] ?? 0,
    Math.max(0, regions.length - 1),
  );

  const setPositionIndex = (index: number) => {
    setPositionByScope((prev) => ({ ...prev, [scope]: index }));
  };

  const activeRegion = regions[positionIndex];

  const effectiveViewMode = options.neckViewEnabled ? viewMode : 'single';

  const layers = useMemo(
    () => buildNeckViewLayers(regions, positionIndex, effectiveViewMode),
    [regions, positionIndex, effectiveViewMode],
  );

  const badges = useMemo(
    () => buildRegionBadges(regions, positionIndex, effectiveViewMode),
    [regions, positionIndex, effectiveViewMode],
  );

  return {
    viewMode,
    setViewMode,
    positionIndex,
    setPositionIndex,
    activeRegion,
    positionByScope,
    layers,
    badges,
  };
}
