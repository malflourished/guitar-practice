import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXTURE, PRESETS, TEXTURE_STORAGE_KEY, effectiveLevels, levelsForTheme, parseTexture } from './analogLevels';

describe('levelsForTheme', () => {
  it('uses Subtle on Vibrato and Print on Scholar', () => {
    expect(levelsForTheme('vibrato')).toEqual(PRESETS.subtle);
    expect(levelsForTheme('scholar')).toEqual(PRESETS.print);
  });
  it('returns a copy', () => {
    levelsForTheme('vibrato').grain = 99;
    expect(PRESETS.subtle.grain).toBe(26);
  });
});

describe('parseTexture', () => {
  it('is on and follows the theme with nothing stored', () => {
    expect(parseTexture(null)).toEqual(DEFAULT_TEXTURE);
  });
  it('ignores broken or foreign JSON', () => {
    expect(parseTexture('{nope')).toEqual(DEFAULT_TEXTURE);
    expect(parseTexture('7')).toEqual(DEFAULT_TEXTURE);
  });
  it('reads the on/off setting', () => {
    expect(parseTexture('{"on":false}').on).toBe(false);
    expect(parseTexture('{"on":"no"}').on).toBe(true);
  });
  it('keeps a valid override and drops an invalid one', () => {
    const good = JSON.stringify({ on: true, preset: 'film', override: PRESETS.film });
    expect(parseTexture(good)).toEqual({ on: true, preset: 'film', override: PRESETS.film });
    const bad = JSON.stringify({ override: { ...PRESETS.film, grain: 400 } });
    expect(parseTexture(bad).override).toBeNull();
  });
  it('does not use the prototype key', () => {
    expect(TEXTURE_STORAGE_KEY).not.toBe('vibrato:analog-lab');
  });
});

describe('effectiveLevels', () => {
  it('prefers the override', () => {
    const state = { on: true, preset: 'tube', override: PRESETS.tube };
    expect(effectiveLevels(state, 'scholar')).toEqual(PRESETS.tube);
    expect(effectiveLevels(DEFAULT_TEXTURE, 'scholar')).toEqual(PRESETS.print);
  });
});
