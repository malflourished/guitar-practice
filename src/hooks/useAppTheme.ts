import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AmbientMotion } from '../lib/ambientMotion';
import { getBackgroundKeyForMode, getKeyBackgroundStyle } from '../lib/keyPalette';
import type { KeyMode, NoteName, StudyMode } from '../types/music';
import { useDebugSettings } from './useDebugSettings';
import { useUiTheme } from './useUiTheme';

/** How long the Notes background rests on each selected note's colour. */
const NOTES_COLOUR_MS = 5000;

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
  // The lava always flows: the owner dropped the choice of motion on 2026-11-21.
  const ambientMotion: AmbientMotion = 'flow';
  const debug = useDebugSettings();
  const {
    uiTheme,
    vibratoCanvas,
    vibratoPanels,
    panelFill,
    selectUiTheme,
    selectPanels,
    selectPanelFill,
  } = useUiTheme();

  // The ambient background tracks only the top-level key (center + mode), so
  // stepping through chords, positions, or progression steps never recolors it.
  // Notes with several notes selected has no one key: the background moves
  // from one note's colour to the next. Not for a player who asked for less motion.
  const [turn, setTurn] = useState(0);
  const cycling = studyMode === 'notes' && activeNotes.size > 1;
  useEffect(() => {
    if (!cycling || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setTurn((n) => n + 1), NOTES_COLOUR_MS);
    return () => window.clearInterval(timer);
  }, [cycling]);
  const backgroundKey = useMemo(
    () => getBackgroundKeyForMode(studyMode, activeNotes, keyCenter, turn),
    [studyMode, activeNotes, keyCenter, turn],
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
    panelFill,
    selectUiTheme,
    selectPanels,
    selectPanelFill,
    ambientMotion,
    debug,
    ambientStyle,
    rootContrastMode,
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
