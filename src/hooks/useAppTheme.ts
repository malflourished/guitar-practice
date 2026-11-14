import { useMemo, type CSSProperties } from 'react';
import { AMBIENT_MOTION_KEY, isAmbientMotion, type AmbientMotion } from '../lib/ambientMotion';
import { getBackgroundKeyForMode, getKeyBackgroundStyle } from '../lib/keyPalette';
import type { KeyMode, NoteName, StudyMode } from '../types/music';
import { useDebugSettings } from './useDebugSettings';
import { usePersistentState } from './usePersistentState';
import { useUiTheme } from './useUiTheme';

interface AppThemeInput {
  studyMode: StudyMode;
  activeNotes: Set<NoteName>;
  keyCenter: NoteName;
  effectiveKeyMode: KeyMode;
  noteColors: Record<NoteName, string>;
}

/** Theme, canvas, ambient background and debug switches for the page root. */
export function useAppTheme({
  studyMode,
  activeNotes,
  keyCenter,
  effectiveKeyMode,
  noteColors,
}: AppThemeInput) {
  const [ambientMotion, setAmbientMotion] = usePersistentState<AmbientMotion>(
    AMBIENT_MOTION_KEY,
    'flow',
    isAmbientMotion,
  );
  const debug = useDebugSettings();
  const { uiTheme, vibratoCanvas, vibratoPanels, selectUiTheme, selectCanvas, selectPanels } =
    useUiTheme();

  // The ambient background tracks only the top-level key (center + mode), so
  // stepping through chords, positions, or progression steps never recolors it.
  const backgroundKey = useMemo(
    () => getBackgroundKeyForMode(studyMode, activeNotes, keyCenter),
    [studyMode, activeNotes, keyCenter],
  );

  const ambientStyle = useMemo(
    () =>
      getKeyBackgroundStyle(
        backgroundKey,
        effectiveKeyMode === 'minor' ? 'minor' : 'major',
        noteColors,
      ) as CSSProperties,
    [backgroundKey, effectiveKeyMode, noteColors],
  );

  const rootContrastMode =
    uiTheme === 'scholar' || (uiTheme === 'vibrato' && vibratoCanvas === 'light')
      ? 'light'
      : 'dark';

  return {
    uiTheme,
    vibratoCanvas,
    vibratoPanels,
    selectUiTheme,
    selectCanvas,
    selectPanels,
    ambientMotion,
    setAmbientMotion,
    debug,
    ambientStyle,
    rootContrastMode,
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
