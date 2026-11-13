import { useEffect, useState } from 'react';
import type { SideState } from '../components/frameContext';
import { isBoolean, usePersistentState } from './usePersistentState';
import { useMediaQuery } from './useMediaQuery';

/** Below this the side panel becomes a drawer over the neck. */
const SIDE_DRAWER_QUERY = '(max-width: 1099px), (max-height: 679px)';

/** Where Settings opens to: the top, or one of its sections. */
export type SettingsSectionId = 'sound' | 'tempo' | 'display';

/**
 * The frame's own state: focus mode, the side panel and Settings. The panel is
 * docked beside the neck on roomy windows (open or closed, as the player left
 * it) and a drawer over the neck on small ones. Settings takes the panel's
 * place while it is open, even where the panel was closed, and closing it puts
 * the panel back as it was. Esc closes Settings first, then focus mode and the
 * drawer.
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
  const [settings, setSettings] = useState<{
    open: boolean;
    section: SettingsSectionId | null;
  }>({ open: false, section: null });
  const settingsOpen = settings.open;

  useEffect(() => {
    if (!focusMode && !drawerOpen && !settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (settingsOpen) {
        setSettings({ open: false, section: null });
        return;
      }
      setFocusMode(false);
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, drawerOpen, settingsOpen]);

  const sideState: SideState = settingsOpen
    ? isDrawer
      ? 'drawer'
      : 'docked'
    : !hasSide || focusMode
      ? 'closed'
      : isDrawer
        ? drawerOpen
          ? 'drawer'
          : 'closed'
        : sidePanelOpen
          ? 'docked'
          : 'closed';
  // The Panel button is lit for the mode's panel, not for Settings.
  const sideShown = sideState !== 'closed' && !settingsOpen;
  const closeSettings = () => setSettings({ open: false, section: null });
  const openSettings = (section: SettingsSectionId | null = null) => {
    setFocusMode(false);
    setSettings({ open: true, section });
  };
  const toggleSettings = () => {
    if (settingsOpen) closeSettings();
    else openSettings();
  };
  const toggleSide = () => {
    if (settingsOpen) {
      // Back to the panel, shown even if it was closed before.
      closeSettings();
      if (isDrawer) setDrawerOpen(true);
      else setSidePanelOpen(true);
      return;
    }
    if (isDrawer) setDrawerOpen((prev) => !prev);
    else setSidePanelOpen((prev) => !prev);
  };

  return {
    focusMode,
    setFocusMode,
    sideState,
    sideShown,
    toggleSide,
    closeDrawer: () => {
      setDrawerOpen(false);
      closeSettings();
    },
    settingsOpen,
    settingsSection: settings.section,
    openSettings,
    closeSettings,
    toggleSettings,
  };
}

export type FrameState = ReturnType<typeof useFrameState>;
