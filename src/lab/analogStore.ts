import { useSyncExternalStore } from 'react';
import { DEFAULT_TEXTURE, TEXTURE_STORAGE_KEY, parseTexture, type TextureState } from './analogLevels';

/** One shared, saved copy of the texture state, used by the layer, the theme dock and the lab panel. */
let current: TextureState | null = null;
const listeners = new Set<() => void>();

function read(): TextureState {
  if (current) return current;
  try {
    current = parseTexture(localStorage.getItem(TEXTURE_STORAGE_KEY));
  } catch {
    current = { ...DEFAULT_TEXTURE };
  }
  return current;
}

export function setTexture(update: (state: TextureState) => TextureState): void {
  current = update(read());
  try {
    localStorage.setItem(TEXTURE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage write failures
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useTexture(): TextureState {
  return useSyncExternalStore(subscribe, read);
}
