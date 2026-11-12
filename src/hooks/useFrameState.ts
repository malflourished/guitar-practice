import { useEffect, useState } from 'react';
import type { SideState } from '../components/frameContext';
import { isBoolean, usePersistentState } from './usePersistentState';
import { useMediaQuery } from './useMediaQuery';

/** Below this the side panel becomes a drawer over the neck. */
const SIDE_DRAWER_QUERY = '(max-width: 1099px), (max-height: 679px)';

/**
 * The frame's own state: focus mode and the side panel. The panel is docked
 * beside the neck on roomy windows (open or closed, as the player left it) and
 * a drawer over the neck on small ones. Esc leaves focus mode and the drawer.
 */
export function useFrameState(hasSide: boolean) {
  const [focusMode, setFocusMode] = useState(false);
  const isDrawer = useMediaQuery(SIDE_DRAWER_QUERY);
  const [sidePanelOpen, setSidePanelOpen] = usePersistentState(
    'side-panel-open',
    true,
    isBoolean,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!focusMode && !drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFocusMode(false);
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, drawerOpen]);

  const sideState: SideState =
    !hasSide || focusMode
      ? 'closed'
      : isDrawer
        ? drawerOpen
          ? 'drawer'
          : 'closed'
        : sidePanelOpen
          ? 'docked'
          : 'closed';
  const sideShown = sideState !== 'closed';
  const toggleSide = () => {
    if (isDrawer) setDrawerOpen((prev) => !prev);
    else setSidePanelOpen((prev) => !prev);
  };

  return {
    focusMode,
    setFocusMode,
    sideState,
    sideShown,
    toggleSide,
    closeDrawer: () => setDrawerOpen(false),
  };
}

export type FrameState = ReturnType<typeof useFrameState>;
