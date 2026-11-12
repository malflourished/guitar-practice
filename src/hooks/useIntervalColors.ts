import { usePersistentState } from './usePersistentState';

/** Remembered under `vibrato:interval-colors`. Package K puts the switch in Settings. */
export const INTERVAL_COLORS_KEY = 'interval-colors';

/** Interval colours are off: intervals read by shape and label, in the theme's ink. */
export const DEFAULT_INTERVAL_COLORS = false;

export function isIntervalColorsValue(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function useIntervalColors() {
  return usePersistentState<boolean>(
    INTERVAL_COLORS_KEY,
    DEFAULT_INTERVAL_COLORS,
    isIntervalColorsValue,
  );
}
