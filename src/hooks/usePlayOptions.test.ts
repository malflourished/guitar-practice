import { describe, expect, it } from 'vitest';
import { migrateBackingSetting } from './usePlayOptions';

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('migrateBackingSetting', () => {
  it('a saved pad becomes guitar off with the pad on, and the old key goes', () => {
    const storage = fakeStorage({ 'vibrato:play-backing': '"pad"' });
    migrateBackingSetting(storage);
    expect(storage.data.get('vibrato:play-guitar')).toBe('"off"');
    expect(storage.data.get('vibrato:play-pad')).toBe('true');
    expect(storage.data.has('vibrato:play-backing')).toBe(false);
  });

  it('a saved strum takes the defaults: nothing new is written', () => {
    const storage = fakeStorage({ 'vibrato:play-backing': '"strum"' });
    migrateBackingSetting(storage);
    expect([...storage.data.keys()]).toEqual([]);
  });

  it('does nothing without a saved backing, and never overwrites a newer choice', () => {
    const none = fakeStorage({});
    migrateBackingSetting(none);
    expect(none.data.size).toBe(0);
    const newer = fakeStorage({ 'vibrato:play-backing': '"pad"', 'vibrato:play-guitar': '"whole"' });
    migrateBackingSetting(newer);
    expect(newer.data.get('vibrato:play-guitar')).toBe('"whole"');
  });
});
