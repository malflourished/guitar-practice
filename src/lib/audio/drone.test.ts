import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('tone', () => ({ start: () => Promise.resolve(), now: () => 0, Gain: class {} }));
vi.mock('./padVoice', () => ({ PadVoice: class {} }));

import { RootDrone, droneMidis } from './drone';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function fakeAudio() {
  const voices: Array<{ play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }> = [];
  const levels: number[] = [];
  let release: () => void = () => {};
  const started = new Promise<void>((resolve) => { release = resolve; });
  return {
    voices,
    levels,
    release,
    audio: {
      start: () => started,
      now: () => 100,
      build: (level: number) => {
        levels.push(level);
        return {
          setLevel: (next: number) => { levels.push(next); },
          voice: () => {
            const voice = { play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
            voices.push(voice);
            return voice;
          },
          dispose: vi.fn(),
        };
      },
    },
  };
}

describe('the drone', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('holds the root alone, in two octaves, from the low E up', () => {
    expect(droneMidis('E')).toEqual([40, 52]);
    expect(droneMidis('A')).toEqual([45, 57]);
    expect(droneMidis('C')).toEqual([48, 60]);
    expect(droneMidis('D#')).toEqual([51, 63]);
    for (const note of NOTES) {
      const [low, high] = droneMidis(note);
      expect(low % 12).toBe(NOTES.indexOf(note));
      expect(low).toBeGreaterThanOrEqual(40);
      expect(low).toBeLessThan(52);
      expect(high - low).toBe(12);
    }
  });

  it('plays the pad voice on the root, for as long as it is on', async () => {
    const { audio, voices, release } = fakeAudio();
    const drone = new RootDrone(audio);
    drone.setLevel(0.5);
    const starting = drone.start('A');
    release();
    await starting;
    expect(voices).toHaveLength(1);
    const [midis, time, duration] = voices[0].play.mock.calls[0];
    expect(midis).toEqual([45, 57]);
    expect(time).toBeGreaterThan(100);
    expect(duration).toBeGreaterThan(60 * 60);
    expect(drone.sounding).toBe('A');
    drone.stop();
    expect(voices[0].stop).toHaveBeenCalledTimes(1);
    expect(drone.sounding).toBeNull();
    vi.runAllTimers();
    expect(voices[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('a new key hands over: the old voice stops, a fresh one takes the new root', async () => {
    const { audio, voices, release } = fakeAudio();
    release();
    const drone = new RootDrone(audio);
    await drone.start('A');
    await drone.start('D');
    expect(voices).toHaveLength(2);
    expect(voices[0].stop).toHaveBeenCalledTimes(1);
    expect(voices[1].play.mock.calls[0][0]).toEqual([50, 62]);
    expect(voices[1].stop).not.toHaveBeenCalled();
  });

  it('stopped before the audio has started, it never sounds', async () => {
    const { audio, voices, release } = fakeAudio();
    const drone = new RootDrone(audio);
    const starting = drone.start('A');
    drone.stop();
    release();
    await starting;
    expect(voices).toHaveLength(0);
  });

  it('follows the volume, and mute is level 0', async () => {
    const { audio, levels, release } = fakeAudio();
    release();
    const drone = new RootDrone(audio);
    drone.setLevel(1);
    await drone.start('A');
    expect(levels[0]).toBeCloseTo(0.7);
    drone.setLevel(0);
    expect(levels.at(-1)).toBe(0);
    drone.setLevel(0.5);
    expect(levels.at(-1)).toBeCloseTo(0.35);
  });
});
