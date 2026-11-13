import { useCallback } from 'react';
import {
  DEFAULT_PLAY_OPTIONS,
  type PlayOptions,
} from '../lib/audio/playOptions';
import { isBoolean, oneOf, usePersistentState } from './usePersistentState';

/** What the Play menu remembers, under `vibrato:play-*`, shared by every mode. */
export function usePlayOptions() {
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
  const options: PlayOptions = { direction, articulation, loop, reach, ladder };
  const setOptions = useCallback(
    (patch: Partial<PlayOptions>) => {
      if (patch.direction !== undefined) setDirection(patch.direction);
      if (patch.articulation !== undefined) setArticulation(patch.articulation);
      if (patch.loop !== undefined) setLoop(patch.loop);
      if (patch.reach !== undefined) setReach(patch.reach);
      if (patch.ladder !== undefined) setLadder(patch.ladder);
    },
    [setDirection, setArticulation, setLoop, setReach, setLadder],
  );
  return { options, setOptions };
}
