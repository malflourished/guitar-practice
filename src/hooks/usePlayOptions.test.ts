import { describe, expect, it } from 'vitest';
import { migrateBackingSetting, migrateOffChoices, migratePlaySettings } from './usePlayOptions';

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

describe('migrateOffChoices: the faders replace the Off choices', () => {
  it('a saved Guitar off becomes the Guitar fader at off, with the rhythm back at Half', () => {
    const storage = fakeStorage({ 'vibrato:play-guitar': '"off"' });
    migrateOffChoices(storage);
    expect(storage.data.get('vibrato:play-guitar-level')).toBe('"off"');
    expect(storage.data.get('vibrato:play-guitar')).toBe('"half"');
  });

  it('a saved Pad off becomes the Pad fader at off, and the old switch’s key goes', () => {
    const storage = fakeStorage({ 'vibrato:play-pad': 'false' });
    migrateOffChoices(storage);
    expect(storage.data.get('vibrato:play-pad-level')).toBe('"off"');
    expect(storage.data.has('vibrato:play-pad')).toBe(false);
  });

  it('a saved Pad on is the fader’s default: nothing is written, and the old key goes', () => {
    const storage = fakeStorage({ 'vibrato:play-pad': 'true' });
    migrateOffChoices(storage);
    expect([...storage.data.keys()]).toEqual([]);
  });

  it('guitar and pad both off: both faders off, the rhythm at Half', () => {
    const storage = fakeStorage({ 'vibrato:play-guitar': '"off"', 'vibrato:play-pad': 'false' });
    migrateOffChoices(storage);
    expect(Object.fromEntries(storage.data)).toEqual({
      'vibrato:play-guitar': '"half"',
      'vibrato:play-guitar-level': '"off"',
      'vibrato:play-pad-level': '"off"',
    });
  });

  it('leaves a rhythm that is already Whole, Half or Quarter alone', () => {
    for (const rhythm of ['"whole"', '"half"', '"quarter"']) {
      const storage = fakeStorage({ 'vibrato:play-guitar': rhythm });
      migrateOffChoices(storage);
      expect(Object.fromEntries(storage.data)).toEqual({ 'vibrato:play-guitar': rhythm });
    }
  });

  it('never overwrites a fader the player has already set, and can run twice', () => {
    const storage = fakeStorage({
      'vibrato:play-guitar': '"off"',
      'vibrato:play-guitar-level': '-3',
      'vibrato:play-pad': 'false',
      'vibrato:play-pad-level': '2',
    });
    migrateOffChoices(storage);
    expect(storage.data.get('vibrato:play-guitar-level')).toBe('-3');
    expect(storage.data.get('vibrato:play-pad-level')).toBe('2');
    const once = Object.fromEntries(storage.data);
    migrateOffChoices(storage);
    expect(Object.fromEntries(storage.data)).toEqual(once);
  });

  it('does nothing when nothing was saved', () => {
    const storage = fakeStorage({});
    migrateOffChoices(storage);
    expect(storage.data.size).toBe(0);
  });
});

describe('migratePlaySettings: both generations in order', () => {
  it('the first version’s saved pad ends as Guitar fader off and Pad at its default', () => {
    const storage = fakeStorage({ 'vibrato:play-backing': '"pad"' });
    migratePlaySettings(storage);
    expect(Object.fromEntries(storage.data)).toEqual({
      'vibrato:play-guitar': '"half"',
      'vibrato:play-guitar-level': '"off"',
    });
  });

  it('the first version’s saved strum ends with nothing saved: the defaults', () => {
    const storage = fakeStorage({ 'vibrato:play-backing': '"strum"' });
    migratePlaySettings(storage);
    expect(storage.data.size).toBe(0);
  });

  it('settings from before this change, with a quarter rhythm and the pad off, keep both', () => {
    const storage = fakeStorage({ 'vibrato:play-guitar': '"quarter"', 'vibrato:play-pad': 'false' });
    migratePlaySettings(storage);
    expect(Object.fromEntries(storage.data)).toEqual({
      'vibrato:play-guitar': '"quarter"',
      'vibrato:play-pad-level': '"off"',
    });
  });
});
