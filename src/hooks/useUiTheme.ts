import { useCallback, useEffect, useState } from 'react';
import type { UiTheme, VibratoCanvas, VibratoPanels } from '../types/ui';

const THEME_STORAGE_KEY = 'guitar-practice-ui-theme';
const CANVAS_STORAGE_KEY = 'guitar-practice-vibrato-canvas';
// Saved only when the user picks one, so a later change of default still
// reaches everyone who never chose. (An earlier key saved the default on every
// launch; it is ignored.)
const PANELS_STORAGE_KEY = 'guitar-practice-vibrato-panels-choice';

function loadUiTheme(): UiTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'vibrato' || stored === 'scholar') return stored;
  } catch {
    // ignore storage read failures
  }
  return 'vibrato';
}

function loadVibratoCanvas(): VibratoCanvas {
  try {
    const stored = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage read failures
  }
  return 'dark';
}

function loadVibratoPanels(): VibratoPanels {
  try {
    const stored = localStorage.getItem(PANELS_STORAGE_KEY);
    if (stored === 'on' || stored === 'outline' || stored === 'lines' || stored === 'off') {
      return stored;
    }
  } catch {
    // ignore storage read failures
  }
  return 'outline';
}

export function useUiTheme() {
  const [uiTheme, setUiTheme] = useState<UiTheme>(loadUiTheme);
  const [vibratoCanvas, setVibratoCanvas] =
    useState<VibratoCanvas>(loadVibratoCanvas);
  const [vibratoPanels, setVibratoPanels] =
    useState<VibratoPanels>(loadVibratoPanels);

  // The canvas has its own control in the theme menu; picking Vibrato again
  // no longer flips it (that was a hidden gesture).
  const selectUiTheme = useCallback((theme: UiTheme) => setUiTheme(theme), []);
  const selectCanvas = useCallback(
    (canvas: VibratoCanvas) => setVibratoCanvas(canvas),
    [],
  );
  const selectPanels = useCallback((panels: VibratoPanels) => {
    setVibratoPanels(panels);
    try {
      localStorage.setItem(PANELS_STORAGE_KEY, panels);
    } catch {
      // ignore storage write failures
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, uiTheme);
      localStorage.setItem(CANVAS_STORAGE_KEY, vibratoCanvas);
    } catch {
      // ignore storage write failures
    }
  }, [uiTheme, vibratoCanvas]);

  return {
    uiTheme,
    vibratoCanvas,
    vibratoPanels,
    selectUiTheme,
    selectCanvas,
    selectPanels,
  };
}
