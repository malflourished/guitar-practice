import { useCallback, useEffect, useState } from 'react';
import type { UiTheme, VibratoCanvas } from '../types/ui';

const THEME_STORAGE_KEY = 'guitar-practice-ui-theme';
const CANVAS_STORAGE_KEY = 'guitar-practice-vibrato-canvas';

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

export function useUiTheme() {
  const [uiTheme, setUiTheme] = useState<UiTheme>(loadUiTheme);
  const [vibratoCanvas, setVibratoCanvas] =
    useState<VibratoCanvas>(loadVibratoCanvas);

  const selectUiTheme = useCallback(
    (theme: UiTheme) => {
      if (theme === 'scholar') {
        setUiTheme('scholar');
        return;
      }

      if (uiTheme === 'vibrato') {
        setVibratoCanvas((canvas) => (canvas === 'dark' ? 'light' : 'dark'));
        return;
      }

      setUiTheme('vibrato');
    },
    [uiTheme],
  );

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, uiTheme);
      localStorage.setItem(CANVAS_STORAGE_KEY, vibratoCanvas);
    } catch {
      // ignore storage write failures
    }
  }, [uiTheme, vibratoCanvas]);

  return { uiTheme, vibratoCanvas, selectUiTheme };
}
