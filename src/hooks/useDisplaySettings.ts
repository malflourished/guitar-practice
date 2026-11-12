import { useEffect, useState } from 'react';
import { NOTE_COLORS } from '../lib/colors';
import type { HarmonyLayer, NoteName } from '../types/music';
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

/** What the dots on the neck show (fingers, names, chord tones) and their colors. */
export function useDisplaySettings() {
  const [showFingers, setShowFingers] = usePersistentState(
    'show-fingers',
    false,
    isBoolean,
  );
  const [showNoteLabels, setShowNoteLabels] = usePersistentState(
    'show-note-labels',
    true,
    isBoolean,
  );
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
    showFingers,
    setShowFingers,
    showNoteLabels,
    setShowNoteLabels,
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
