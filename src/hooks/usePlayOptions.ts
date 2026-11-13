import { useCallback } from 'react';
import {
  DEFAULT_PLAY_OPTIONS,
  type PlayOptions,
} from '../lib/audio/playOptions';
import type { JamFeel } from '../lib/audio/jamSchedule';
import { isBoolean, oneOf, usePersistentState } from './usePersistentState';

const FEELS = ['straight', 'swing'] as const;
const isFeelMap = (value: unknown): value is Record<string, JamFeel> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((feel) => (FEELS as readonly unknown[]).includes(feel));

/**
 * What the Play menu remembers, under `vibrato:play-*`, shared by every mode.
 * Feel is remembered per progression and starts at that entry's own feel
 * (`entryFeel`), so choosing Swing for one entry does not swing the others.
 */
export function usePlayOptions(entry?: { id: string; feel: JamFeel }) {
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
  const [backing, setBacking] = usePersistentState(
    'play-backing',
    DEFAULT_PLAY_OPTIONS.backing,
    oneOf(['strum', 'pad'] as const),
  );
  const [click, setClick] = usePersistentState('play-click', DEFAULT_PLAY_OPTIONS.click, isBoolean);
  const [jamLoop, setJamLoop] = usePersistentState('play-jam-loop', DEFAULT_PLAY_OPTIONS.jamLoop, isBoolean);
  const [feelByEntry, setFeelByEntry] = usePersistentState<Record<string, JamFeel>>('play-feel', {}, isFeelMap);
  const entryId = entry?.id;
  const feel: JamFeel = (entryId !== undefined ? feelByEntry[entryId] : undefined) ?? entry?.feel ?? DEFAULT_PLAY_OPTIONS.feel;
  const options: PlayOptions = { direction, articulation, loop, reach, ladder, backing, feel, click, jamLoop };
  const setOptions = useCallback(
    (patch: Partial<PlayOptions>) => {
      if (patch.direction !== undefined) setDirection(patch.direction);
      if (patch.articulation !== undefined) setArticulation(patch.articulation);
      if (patch.loop !== undefined) setLoop(patch.loop);
      if (patch.reach !== undefined) setReach(patch.reach);
      if (patch.ladder !== undefined) setLadder(patch.ladder);
      if (patch.backing !== undefined) setBacking(patch.backing);
      if (patch.click !== undefined) setClick(patch.click);
      if (patch.jamLoop !== undefined) setJamLoop(patch.jamLoop);
      const nextFeel = patch.feel;
      if (nextFeel !== undefined && entryId !== undefined) {
        setFeelByEntry((previous) => ({ ...previous, [entryId]: nextFeel }));
      }
    },
    [setDirection, setArticulation, setLoop, setReach, setLadder, setBacking, setClick, setJamLoop, setFeelByEntry, entryId],
  );
  return { options, setOptions };
}
