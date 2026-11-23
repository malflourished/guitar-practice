import { describe, expect, it } from 'vitest';
import { ALL_NOTES, NOTE_COLORS } from './colors';
import { blendHue, getBackgroundKeyForMode, getHomeBackgroundKey, getKeyBackgroundStyle } from './keyPalette';

describe('key colors', () => {
  it('gives every key its own dominant color and valid chromatic highlights', () => {
    const palettes = ALL_NOTES.map(root => getKeyBackgroundStyle(root, 'minor', NOTE_COLORS));
    expect(new Set(palettes.map(p => p['--blob-1'])).size).toBe(12);
    for (const palette of palettes) {
      for (const key of ['--blob-1', '--blob-2', '--blob-3'] as const) expect(palette[key]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette['--blob-1']).not.toBe(palette['--blob-3']);
    }
  });
});

describe('the Notes background', () => {
  it('takes the selected notes in turn, and round again', () => {
    const notes = new Set(['A', 'D', 'F'] as const);
    expect([0, 1, 2, 3].map(turn => getBackgroundKeyForMode('notes', notes, 'C', turn))).toEqual(['D', 'F', 'A', 'D']);
    expect(getBackgroundKeyForMode('notes', new Set(), 'C', 2)).toBeNull();
    // Every other mode has one key, whatever the turn.
    expect(getBackgroundKeyForMode('chords', notes, 'C', 2)).toBe('C');
  });
});

describe('the Home background', () => {
  it('starts on the app\'s key and goes through all twelve, whatever that key is', () => {
    for (const start of ALL_NOTES) {
      const lap = Array.from({ length: 12 }, (_, turn) => getHomeBackgroundKey(start, turn));
      expect(lap[0]).toBe(start);
      expect(new Set(lap).size).toBe(12);
      expect(getHomeBackgroundKey(start, 12)).toBe(start);
    }
    expect([0, 1, 2].map(turn => getHomeBackgroundKey('A#', turn))).toEqual(['A#', 'B', 'C']);
  });
});

describe('moving from one colour to another', () => {
  const saturation = ([r, g, b]: number[]) => {
    const max = Math.max(r, g, b);
    return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  };
  const rgb = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
  it('stays as strong as the two colours all the way, for every pair of notes', () => {
    const colours = ALL_NOTES.map(note => rgb(getKeyBackgroundStyle(note, 'minor', NOTE_COLORS)['--blob-1']));
    for (const from of colours) for (const to of colours) {
      const weakest = Math.min(saturation(from), saturation(to));
      for (const amount of [0.25, 0.5, 0.75]) expect(saturation(blendHue(from, to, amount))).toBeGreaterThan(weakest - 0.05);
    }
  });
  it('goes the short way round the wheel: green to red by yellow, not by brown', () => {
    const [r, g, b] = blendHue([0, 0.8, 0], [0.8, 0, 0], 0.5);
    expect(r).toBeCloseTo(0.8, 1);
    expect(g).toBeCloseTo(0.8, 1);
    expect(b).toBeCloseTo(0, 1);
  });
  it('starts and ends on the colours given, and lets a grey take the other colour’s hue', () => {
    expect(blendHue([0.2, 0.4, 0.6], [0.9, 0.1, 0.1], 1)).toEqual([0.9, 0.1, 0.1]);
    blendHue([0.2, 0.4, 0.6], [0.9, 0.1, 0.1], 0).forEach((channel, i) => expect(channel).toBeCloseTo([0.2, 0.4, 0.6][i], 5));
    const [r, g, b] = blendHue([0.5, 0.5, 0.5], [0.9, 0.1, 0.1], 0.5);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeCloseTo(b, 5);
  });
});
