import { describe, expect, it } from 'vitest';
import { readSoundSettings, writeSoundSettings } from './soundSettings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('sound settings persistence', () => {
  it('returns nothing when nothing was saved', () => {
    expect(readSoundSettings(memoryStorage())).toEqual({});
  });

  it('remembers guitar, volume, mute and room', () => {
    const storage = memoryStorage();
    writeSoundSettings(storage, {
      instrument: 'electric_guitar_clean',
      volume: 0.4,
      muted: true,
      room: 0.3,
    });
    expect(storage.data.get('vibrato:sound-volume')).toBe('0.4');
    expect(readSoundSettings(storage)).toEqual({
      instrument: 'electric_guitar_clean',
      volume: 0.4,
      muted: true,
      room: 0.3,
    });
  });

  it('drops values that are out of range or from a guitar that is gone', () => {
    const storage = memoryStorage({
      'vibrato:sound-instrument': '"banjo"',
      'vibrato:sound-volume': '3',
      'vibrato:sound-muted': '"yes"',
      'vibrato:sound-room': '0.9',
    });
    expect(readSoundSettings(storage)).toEqual({});
  });

  it('does not throw when storage refuses a write', () => {
    expect(() =>
      writeSoundSettings(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('full');
          },
        },
        { instrument: 'acoustic_guitar_steel', volume: 1, muted: false, room: 0 },
      ),
    ).not.toThrow();
  });
});
