import { useCallback, useEffect, useState } from 'react';
import type { UiTheme, VibratoCanvas, VibratoPanels } from '../types/ui';

const THEME_STORAGE_KEY = 'guitar-practice-ui-theme';
// Saved only when the user picks one, so a later change of default still
// reaches everyone who never chose. (An earlier key saved the default on every
// launch; it is ignored.)
const PANELS_STORAGE_KEY = 'guitar-practice-vibrato-panels-choice';
const PANEL_FILL_STORAGE_KEY = 'guitar-practice-vibrato-panel-fill';

function loadUiTheme(): UiTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'vibrato' || stored === 'scholar') return stored;
  } catch {
    // ignore storage read failures
  }
  return 'vibrato';
}

/**
 * Vibrato's canvas is always dark: the owner dropped the choice on 2026-11-21
 * (Scholar is the light look). A saved 'light' is ignored. The light-canvas
 * styles are still in the stylesheets, unused.
 */
const VIBRATO_CANVAS: VibratoCanvas = 'dark';

function loadVibratoPanels(): VibratoPanels {
  try {
    // 'on' and 'lines' were choices until 2026-11-14; both read as Outline now.
    if (localStorage.getItem(PANELS_STORAGE_KEY) === 'off') return 'off';
  } catch {
    // ignore storage read failures
  }
  return 'outline';
}

/** How strongly the panels are filled, 0 (the lava shows through) to 1. */
function loadPanelFill(): number {
  try {
    const stored = Number(localStorage.getItem(PANEL_FILL_STORAGE_KEY) ?? NaN);
    if (Number.isFinite(stored)) return Math.min(1, Math.max(0, stored));
    // Whoever chose the old Panels: On keeps the panels they chose.
    if (localStorage.getItem(PANELS_STORAGE_KEY) === 'on') return 1;
  } catch {
    // ignore storage read failures
  }
  return 0;
}

export function useUiTheme() {
  const [uiTheme, setUiTheme] = useState<UiTheme>(loadUiTheme);
  const vibratoCanvas = VIBRATO_CANVAS;
  const [vibratoPanels, setVibratoPanels] =
    useState<VibratoPanels>(loadVibratoPanels);
  const [panelFill, setPanelFill] = useState<number>(loadPanelFill);

  const selectUiTheme = useCallback((theme: UiTheme) => setUiTheme(theme), []);
  const selectPanels = useCallback((panels: VibratoPanels) => {
    setVibratoPanels(panels);
    try {
      localStorage.setItem(PANELS_STORAGE_KEY, panels);
    } catch {
      // ignore storage write failures
    }
  }, []);
  const selectPanelFill = useCallback((fill: number) => {
    setPanelFill(fill);
    try {
      localStorage.setItem(PANEL_FILL_STORAGE_KEY, String(fill));
    } catch {
      // ignore storage write failures
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, uiTheme);
    } catch {
      // ignore storage write failures
    }
  }, [uiTheme]);

  return {
    uiTheme,
    vibratoCanvas,
    vibratoPanels,
    panelFill,
    selectUiTheme,
    selectPanels,
    selectPanelFill,
  };
}
