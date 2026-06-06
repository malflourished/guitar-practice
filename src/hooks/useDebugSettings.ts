import { useCallback, useMemo, useState } from 'react';

const STORAGE_WHITE_BG = 'vibrato:debug-white-background';
const STORAGE_WHITE_TEXT = 'vibrato:debug-white-text';

export interface DebugSettings {
  enabled: boolean;
  showColorEditor: boolean;
  whiteBackground: boolean;
  whiteText: boolean;
  setWhiteBackground: (value: boolean) => void;
  setWhiteText: (value: boolean) => void;
}

function readDebugParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('debug');
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // ignore storage read failures
  }
  return fallback;
}

function saveBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage write failures
  }
}

export function useDebugSettings(): DebugSettings {
  const debugParam = readDebugParam();
  const enabled = debugParam !== null;
  const showColorEditor = debugParam === 'colors';

  const [whiteBackground, setWhiteBackgroundState] = useState(() =>
    loadBool(STORAGE_WHITE_BG, false),
  );
  const [whiteText, setWhiteTextState] = useState(() =>
    loadBool(STORAGE_WHITE_TEXT, true),
  );

  const setWhiteBackground = useCallback((value: boolean) => {
    setWhiteBackgroundState(value);
    saveBool(STORAGE_WHITE_BG, value);
  }, []);

  const setWhiteText = useCallback((value: boolean) => {
    setWhiteTextState(value);
    saveBool(STORAGE_WHITE_TEXT, value);
  }, []);

  return useMemo(
    () => ({
      enabled,
      showColorEditor,
      whiteBackground,
      whiteText,
      setWhiteBackground,
      setWhiteText,
    }),
    [
      enabled,
      showColorEditor,
      whiteBackground,
      whiteText,
      setWhiteBackground,
      setWhiteText,
    ],
  );
}
