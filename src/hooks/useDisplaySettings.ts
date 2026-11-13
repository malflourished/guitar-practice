import { useEffect, useState } from 'react';
import { NOTE_COLORS } from '../lib/colors';
import type { HarmonyLayer, NoteName } from '../types/music';
import {
  DEFAULT_LABEL_MODE,
  isLabelMode,
  labelFlags,
  readLabelMode,
  type LabelMode,
} from './displayLabels';
import { useIntervalColors } from './useIntervalColors';
import { isBoolean, oneOf, usePersistentState } from './usePersistentState';

const COLOR_STORAGE_KEY = 'guitar-fretboard-note-colors';

function loadNoteColors(): Record<NoteName, string> {
  try {
    const raw = localStorage.getItem(COLOR_STORAGE_KEY);
    if (raw) {
      return { ...NOTE_COLORS, ...(JSON.parse(raw) as Record<NoteName, string>) };
    }
  } catch {
    // ignore malformed storage
  }
  return { ...NOTE_COLORS };
}

/**
 * What the dots on the neck show and how: the Labels choice, solid dots and
 * interval colours (all three live in Settings), plus the chord-tone and
 * arpeggio views that stay in the decks. `showFingers` and `showNoteLabels`
 * are derived from the Labels choice for the components that still take them.
 */
export function useDisplaySettings() {
  // Read once: the old switches only decide it when nothing is saved yet.
  const [startingMode] = useState(() => {
    try {
      return readLabelMode(localStorage);
    } catch {
      return DEFAULT_LABEL_MODE;
    }
  });
  const [labelMode, setLabelMode] = usePersistentState<LabelMode>(
    'label-mode',
    startingMode,
    isLabelMode,
  );
  const { showFingers, showNoteLabels, showIntervals } = labelFlags(labelMode);
  const [intervalColors, setIntervalColors] = useIntervalColors();
  const [fullDotOpacity, setFullDotOpacity] = usePersistentState(
    'full-dot-opacity',
    false,
    isBoolean,
  );
  const [showChordTones, setShowChordTones] = usePersistentState(
    'show-chord-tones',
    false,
    isBoolean,
  );
  const [harmonyLayer, setHarmonyLayer] = usePersistentState<HarmonyLayer>(
    'harmony-layer',
    'scale',
    oneOf(['scale', 'arpeggio'] as const),
  );
  const [noteColors, setNoteColors] = useState<Record<NoteName, string>>(
    loadNoteColors,
  );

  useEffect(() => {
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(noteColors));
    } catch {
      // ignore storage write failures
    }
  }, [noteColors]);

  return {
    labelMode,
    setLabelMode,
    showFingers,
    showNoteLabels,
    showIntervals,
    intervalColors,
    setIntervalColors,
    fullDotOpacity,
    setFullDotOpacity,
    showChordTones,
    setShowChordTones,
    harmonyLayer,
    setHarmonyLayer,
    noteColors,
    setNoteColors,
  };
}

export type DisplaySettings = ReturnType<typeof useDisplaySettings>;
