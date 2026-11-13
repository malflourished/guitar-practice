import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'vibrato:';

/** Read one saved value, falling back to the default when it is missing, malformed or rejected. */
export function readPersistent<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
  storage: Pick<Storage, 'getItem'> = localStorage,
): T {
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as unknown;
      if (!validate || validate(parsed)) return parsed as T;
    }
  } catch {
    // ignore malformed storage
  }
  return defaultValue;
}

/**
 * `useState` mirrored into localStorage so the app resumes where you left off.
 * Pass `validate` to reject stale/invalid stored values (e.g. a study mode that
 * no longer exists) and fall back to the default.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = STORAGE_PREFIX + key;

  const [value, setValue] = useState<T>(() => readPersistent(key, defaultValue, validate));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore storage write failures
    }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Validator for string-union states persisted with usePersistentState. */
export function oneOf<T extends string>(
  values: readonly T[],
): (value: unknown) => value is T {
  return (value): value is T =>
    typeof value === 'string' && (values as readonly string[]).includes(value);
}

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
