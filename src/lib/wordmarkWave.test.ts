import { describe, expect, it } from 'vitest';
import { WAVE, waveEnvelope, waveFrames, waveHeight, wavePath } from './wordmarkWave';

const points = (path: string) => path.split(/[ML]/).filter(Boolean).map((pair) => pair.split(' ').map(Number));

describe('the wordmark wave', () => {
  it('is held at both ends whatever the wave is doing', () => {
    expect(waveEnvelope(0)).toBe(0);
    expect(waveEnvelope(1)).toBeCloseTo(0, 10);
    for (let frame = 0; frame < 32; frame++) {
      const line = points(wavePath((Math.PI * 2 * frame) / 32));
      expect(line[0]).toEqual([WAVE.inset, WAVE.height / 2]);
      expect(line[line.length - 1]).toEqual([WAVE.width - WAVE.inset, WAVE.height / 2]);
    }
  });

  it('rests as a tilde: up on the left, down on the right', () => {
    expect(waveHeight(0.25, 0)).toBeGreaterThan(8);
    expect(waveHeight(0.75, 0)).toBeLessThan(-8);
    expect(waveHeight(0.5, 0)).toBeCloseTo(0, 10);
  });

  it('travels: a quarter of a trip later the middle has risen and the left hump has passed on', () => {
    expect(waveHeight(0.5, Math.PI / 2)).toBeCloseTo(WAVE.amplitude, 5);
    expect(waveHeight(0.25, Math.PI / 2)).toBeCloseTo(0, 5);
  });

  it('stays inside its box with room for the line itself', () => {
    for (const frame of waveFrames()) {
      for (const [x, y] of points(frame)) {
        expect(x).toBeGreaterThanOrEqual(WAVE.inset);
        expect(x).toBeLessThanOrEqual(WAVE.width - WAVE.inset);
        expect(Math.abs(y - WAVE.height / 2)).toBeLessThanOrEqual(WAVE.amplitude);
      }
    }
  });

  it('loops without a seam, and every frame can be morphed into the next', () => {
    const frames = waveFrames();
    expect(frames).toHaveLength(WAVE.frames + 1);
    expect(frames[frames.length - 1]).toBe(frames[0]);
    expect(new Set(frames.slice(0, -1)).size).toBe(WAVE.frames);
    for (const frame of frames) {
      expect(frame.match(/[ML]/g)).toHaveLength(WAVE.points + 1);
      expect(frame.startsWith('M')).toBe(true);
    }
  });
});
