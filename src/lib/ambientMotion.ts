import { oneOf, readPersistent } from '../hooks/usePersistentState';

/**
 * How fast the lava moves. Flow is the slowest; Rise and Boil are quicker.
 * (Calm and Still were removed: the lamp always moves unless the system asks
 * for reduced motion.)
 */
export type AmbientMotion = 'flow' | 'rise' | 'boil';

export const AMBIENT_MOTIONS: readonly AmbientMotion[] = ['flow', 'rise', 'boil'];

export const AMBIENT_MOTION_LABELS: Record<AmbientMotion, string> = {
  flow: 'Flow',
  rise: 'Rise',
  boil: 'Boil',
};

/** Multiplier on the field's clock. Only the time scale changes, never the GPU work. */
export const AMBIENT_SPEED: Record<AmbientMotion, number> = {
  flow: 1,
  rise: 1.6,
  boil: 2.5,
};

export const AMBIENT_MOTION_KEY = 'ambient-motion';

export const isAmbientMotion = oneOf(AMBIENT_MOTIONS);

/** The saved choice; the retired `calm` and `still` (and anything else unknown) become `flow`. */
export function readAmbientMotion(storage?: Pick<Storage, 'getItem'>): AmbientMotion {
  return readPersistent<AmbientMotion>(AMBIENT_MOTION_KEY, 'flow', isAmbientMotion, storage);
}
