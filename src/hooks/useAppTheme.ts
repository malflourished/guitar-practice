import { useMemo, type CSSProperties } from 'react';
import type { AmbientMotion } from '../components/AmbientBackground';
import { getBackgroundKeyForMode, getKeyBackgroundStyle } from '../lib/keyPalette';
import type { KeyMode, NoteName, StudyMode } from '../types/music';
import { useDebugSettings } from './useDebugSettings';
import { oneOf, usePersistentState } from './usePersistentState';
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
    'ambient-motion',
    'flow',
    oneOf(['flow', 'calm', 'still'] as const),
  );
  const debug = useDebugSettings();
  const { uiTheme, vibratoCanvas, selectUiTheme, selectCanvas } = useUiTheme();

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
    selectUiTheme,
    selectCanvas,
    ambientMotion,
    setAmbientMotion,
    debug,
    ambientStyle,
    rootContrastMode,
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
