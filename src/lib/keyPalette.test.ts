import { describe, expect, it } from 'vitest';
import { ALL_NOTES, NOTE_COLORS } from './colors';
import { getKeyBackgroundStyle } from './keyPalette';

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
