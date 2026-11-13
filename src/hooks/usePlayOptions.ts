import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_PLAY_OPTIONS,
  type PlayOptions,
} from '../lib/audio/playOptions';
import type { JamFeel } from '../lib/audio/jamSchedule';
import {
  DEFAULT_JAM_MIX,
  clampFaderLevel,
  isFaderLevel,
  type FaderLevel,
  type JamLayer,
  type JamMix,
} from '../lib/audio/jamMix';
import { isBoolean, oneOf, usePersistentState } from './usePersistentState';

const FEELS = ['straight', 'swing'] as const;
const isFeelMap = (value: unknown): value is Record<string, JamFeel> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((feel) => (FEELS as readonly unknown[]).includes(feel));

type Storage3 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The first version saved one `backing` (strum or pad). A saved pad becomes
 * guitar off with the pad on; anything else takes the new defaults.
 */
export function migrateBackingSetting(storage: Storage3) {
  const key = 'vibrato:play-backing';
  const saved = storage.getItem(key);
  if (saved === null) return;
  if (saved === '"pad"' && storage.getItem('vibrato:play-guitar') === null) {
    storage.setItem('vibrato:play-guitar', '"off"');
    storage.setItem('vibrato:play-pad', 'true');
  }
  storage.removeItem(key);
}

/**
 * The mix faders replaced the menu's Off choices. A saved Guitar "off" becomes
 * the Guitar fader at off, with the rhythm back at Half; a saved Pad off becomes
 * the Pad fader at off, and Pad on is just the fader's default. The old pad
 * switch's key goes either way. A fader already set is never overwritten.
 */
export function migrateOffChoices(storage: Storage3) {
  if (storage.getItem('vibrato:play-guitar') === '"off"') {
    if (storage.getItem('vibrato:play-guitar-level') === null) {
      storage.setItem('vibrato:play-guitar-level', '"off"');
    }
    storage.setItem('vibrato:play-guitar', '"half"');
  }
  const pad = storage.getItem('vibrato:play-pad');
  if (pad !== null) {
    if (pad === 'false' && storage.getItem('vibrato:play-pad-level') === null) {
      storage.setItem('vibrato:play-pad-level', '"off"');
    }
    storage.removeItem('vibrato:play-pad');
  }
}

/** Every saved-option migration, oldest first. Safe to run again. */
export function migratePlaySettings(storage: Storage3) {
  migrateBackingSetting(storage);
  migrateOffChoices(storage);
}

/**
 * What the Play menu remembers, under `vibrato:play-*`, shared by every mode:
 * the options, and the jam's mix (the three faders, saved for the player
 * rather than for an entry). Feel is remembered per progression and starts at
 * that entry's own feel (`entryFeel`), so choosing Swing for one entry does
 * not swing the others.
 */
export function usePlayOptions(entry?: { id: string; feel: JamFeel }) {
  useState(() => {
    try {
      migratePlaySettings(localStorage);
    } catch {
      // storage is unavailable: the defaults stand
    }
  });
  const [direction, setDirection] = usePersistentState(
    'play-direction',
    DEFAULT_PLAY_OPTIONS.direction,
    oneOf(['up', 'down', 'updown'] as const),
  );
  const [articulation, setArticulation] = usePersistentState(
    'play-articulation',
    DEFAULT_PLAY_OPTIONS.articulation,
    oneOf(['strum', 'arpeggio'] as const),
  );
  const [loop, setLoop] = usePersistentState('play-loop', DEFAULT_PLAY_OPTIONS.loop, isBoolean);
  const [reach, setReach] = usePersistentState(
    'play-reach',
    DEFAULT_PLAY_OPTIONS.reach,
    oneOf(['position', 'neck'] as const),
  );
  const [ladder, setLadder] = usePersistentState(
    'play-ladder',
    DEFAULT_PLAY_OPTIONS.ladder,
    oneOf(['off', 'up', 'down'] as const),
  );
  const [guitar, setGuitar] = usePersistentState(
    'play-guitar',
    DEFAULT_PLAY_OPTIONS.guitar,
    oneOf(['whole', 'half', 'quarter'] as const),
  );
  const [click, setClick] = usePersistentState('play-click', DEFAULT_PLAY_OPTIONS.click, isBoolean);
  const [jamLoop, setJamLoop] = usePersistentState('play-jam-loop', DEFAULT_PLAY_OPTIONS.jamLoop, isBoolean);
  const [feelByEntry, setFeelByEntry] = usePersistentState<Record<string, JamFeel>>('play-feel', {}, isFeelMap);
  const [guitarLevel, setGuitarLevel] = usePersistentState<FaderLevel>('play-guitar-level', DEFAULT_JAM_MIX.guitar, isFaderLevel);
  const [bassLevel, setBassLevel] = usePersistentState<FaderLevel>('play-bass-level', DEFAULT_JAM_MIX.bass, isFaderLevel);
  const [padLevel, setPadLevel] = usePersistentState<FaderLevel>('play-pad-level', DEFAULT_JAM_MIX.pad, isFaderLevel);
  const entryId = entry?.id;
  const feel: JamFeel = (entryId !== undefined ? feelByEntry[entryId] : undefined) ?? entry?.feel ?? DEFAULT_PLAY_OPTIONS.feel;
  const options: PlayOptions = { direction, articulation, loop, reach, ladder, guitar, feel, click, jamLoop };
  const setOptions = useCallback(
    (patch: Partial<PlayOptions>) => {
      if (patch.direction !== undefined) setDirection(patch.direction);
      if (patch.articulation !== undefined) setArticulation(patch.articulation);
      if (patch.loop !== undefined) setLoop(patch.loop);
      if (patch.reach !== undefined) setReach(patch.reach);
      if (patch.ladder !== undefined) setLadder(patch.ladder);
      if (patch.guitar !== undefined) setGuitar(patch.guitar);
      if (patch.click !== undefined) setClick(patch.click);
      if (patch.jamLoop !== undefined) setJamLoop(patch.jamLoop);
      const nextFeel = patch.feel;
      if (nextFeel !== undefined && entryId !== undefined) {
        setFeelByEntry((previous) => ({ ...previous, [entryId]: nextFeel }));
      }
    },
    [setDirection, setArticulation, setLoop, setReach, setLadder, setGuitar, setClick, setJamLoop, setFeelByEntry, entryId],
  );
  // Saved levels are clamped onto the track (a hand-edited -40 is -24, not off).
  const mix = useMemo<JamMix>(
    () => ({
      guitar: clampFaderLevel(guitarLevel),
      bass: clampFaderLevel(bassLevel),
      pad: clampFaderLevel(padLevel),
    }),
    [guitarLevel, bassLevel, padLevel],
  );
  const setMixLevel = useCallback(
    (layer: JamLayer, level: FaderLevel) => {
      const next = clampFaderLevel(level);
      if (layer === 'guitar') setGuitarLevel(next);
      else if (layer === 'bass') setBassLevel(next);
      else setPadLevel(next);
    },
    [setGuitarLevel, setBassLevel, setPadLevel],
  );
  return { options, setOptions, mix, setMixLevel };
}
