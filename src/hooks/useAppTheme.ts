import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AmbientMotion } from '../lib/ambientMotion';
import {
  getBackgroundKeyForMode,
  getHomeBackgroundKey,
  getKeyBackgroundStyle,
} from '../lib/keyPalette';
import type { KeyMode, NoteName, StudyMode } from '../types/music';
import { useDebugSettings } from './useDebugSettings';
import { useUiTheme } from './useUiTheme';

/** How long the Notes background rests on each selected note's colour. */
const NOTES_COLOUR_MS = 5000;
/** How long the Home background rests on each key's colour: all twelve in about 70 seconds. */
const HOME_COLOUR_MS = 6000;

interface AppThemeInput {
  /** Home is showing: its background belongs to no key and goes through all twelve. */
  home: boolean;
  studyMode: StudyMode;
  activeNotes: Set<NoteName>;
  keyCenter: NoteName;
  effectiveKeyMode: KeyMode;
  noteColors: Record<NoteName, string>;
}

/** Theme, canvas, ambient background and debug switches for the page root. */
export function useAppTheme({
  home,
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
  // from one note's colour to the next. Home belongs to no key either: it goes
  // through all twelve, whatever key the modes are in (owner, 2026-11-23).
  // Neither moves for a player who asked for less motion.
  const [turn, setTurn] = useState(0);
  // Each visit to Home starts from the app's key, so arriving never jumps.
  const [wasHome, setWasHome] = useState(home);
  if (home !== wasHome) {
    setWasHome(home);
    setTurn(0);
  }
  const stepMs = home
    ? HOME_COLOUR_MS
    : studyMode === 'notes' && activeNotes.size > 1
      ? NOTES_COLOUR_MS
      : null;
  useEffect(() => {
    if (stepMs === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const timer = window.setInterval(() => setTurn((n) => n + 1), stepMs);
    return () => window.clearInterval(timer);
  }, [stepMs]);
  const backgroundKey = useMemo(
    () =>
      home
        ? getHomeBackgroundKey(keyCenter, turn)
        : getBackgroundKeyForMode(studyMode, activeNotes, keyCenter, turn),
    [home, studyMode, activeNotes, keyCenter, turn],
  );

  // Home's colours are each note's own, the same in a major and a minor key.
  const minor = !home && effectiveKeyMode === 'minor';
  const ambientStyle = useMemo(
    () =>
      getKeyBackgroundStyle(backgroundKey, minor ? 'minor' : 'major', noteColors) as CSSProperties,
    [backgroundKey, minor, noteColors],
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
