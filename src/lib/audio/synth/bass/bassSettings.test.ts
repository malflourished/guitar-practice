import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASS_PARAMS } from './bassParams';
import { BASS_SETTINGS_KEY, DEFAULT_BASS_SETTINGS, parseBassSettings } from './bassSettings';

describe('bass settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('starts on the synth bass: the modelled bass is opt-in', () => {
    expect(DEFAULT_BASS_SETTINGS.jamBass).toBe('synth');
    expect(parseBassSettings(null)).toEqual(DEFAULT_BASS_SETTINGS);
    expect(parseBassSettings('not json')).toEqual(DEFAULT_BASS_SETTINGS);
    expect(parseBassSettings('[1, 2]').jamBass).toBe('synth');
    expect(parseBassSettings(JSON.stringify({ jamBass: 'something else' })).jamBass).toBe('synth');
  });

  it('keeps a saved choice and puts bad values right', () => {
    const saved = parseBassSettings(JSON.stringify({ jamBass: 'modelled', trimDb: 99, params: { toneHz: 900, drive: 7, pluckCm: 'x' } }));
    expect(saved.jamBass).toBe('modelled');
    expect(saved.trimDb).toBe(24);
    expect(saved.params).toEqual({ ...DEFAULT_BASS_PARAMS, toneHz: 900, drive: 1 });
    expect(parseBassSettings(JSON.stringify({ trimDb: 'loud' })).trimDb).toBe(0);
  });

  it('saves changes, tells listeners, and reads them back on the next load', async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    });
    const first = await import('./bassSettings');
    const heard = vi.fn();
    const unsubscribe = first.subscribeBassSettings(heard);
    first.setBassSettings((settings) => ({ ...settings, jamBass: 'modelled', trimDb: 1.5 }));
    expect(heard).toHaveBeenCalledTimes(1);
    expect(first.getBassSettings().jamBass).toBe('modelled');
    expect(JSON.parse(stored.get(BASS_SETTINGS_KEY)!)).toMatchObject({ jamBass: 'modelled', trimDb: 1.5 });
    unsubscribe();
    first.setBassSettings((settings) => ({ ...settings, trimDb: 2 }));
    expect(heard).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const second = await import('./bassSettings');
    expect(second.getBassSettings()).toMatchObject({ jamBass: 'modelled', trimDb: 2 });
  });

  it('works without storage', async () => {
    vi.stubGlobal('localStorage', undefined);
    const settings = await import('./bassSettings');
    expect(settings.getBassSettings()).toEqual(DEFAULT_BASS_SETTINGS);
    settings.setBassSettings((current) => ({ ...current, jamBass: 'modelled' }));
    expect(settings.getBassSettings().jamBass).toBe('modelled');
  });
});
