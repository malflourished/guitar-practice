import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HUMANIZE } from '../../drumGrooves';
import { DEFAULT_DRUM_PARAMS } from './drumParams';
import { DEFAULT_DRUM_SETTINGS, DRUM_SETTINGS_KEY, parseDrumSettings } from './drumSettings';

describe('saved drum settings', () => {
  it('nothing saved is the defaults: the acoustic kit, every kit’s own controls, no trim', () => {
    expect(parseDrumSettings(null)).toEqual(DEFAULT_DRUM_SETTINGS);
    expect(DEFAULT_DRUM_SETTINGS.kit).toBe('acoustic');
    expect(DEFAULT_DRUM_SETTINGS.params).toEqual(DEFAULT_DRUM_PARAMS);
    expect(DEFAULT_DRUM_SETTINGS.trimDb).toEqual({ acoustic: 0, machine: 0, brushes: 0 });
    expect(DEFAULT_DRUM_SETTINGS.humanize).toBe(DEFAULT_HUMANIZE);
  });

  it('anything that is not settings is the defaults', () => {
    for (const raw of ['', 'not json', '42', '"machine"', '[]', 'null']) expect(parseDrumSettings(raw)).toEqual(DEFAULT_DRUM_SETTINGS);
  });

  it('keeps what is good and repairs the rest, kit by kit', () => {
    const parsed = parseDrumSettings(
      JSON.stringify({
        kit: 'brushes',
        params: { machine: { kickHz: 44, snareHz: 9999, hatTone: 'bright' }, cowbell: { kickHz: 1 } },
        trimDb: { acoustic: -3, machine: 400, brushes: 'loud' },
        humanize: 7,
      }),
    );
    expect(parsed.kit).toBe('brushes');
    expect(parsed.params.machine).toEqual({ ...DEFAULT_DRUM_PARAMS.machine, kickHz: 44, snareHz: 280 });
    expect(parsed.params.acoustic).toEqual(DEFAULT_DRUM_PARAMS.acoustic);
    expect(parsed.trimDb).toEqual({ acoustic: -3, machine: 24, brushes: 0 });
    expect(parsed.humanize).toBe(1);
    expect(parseDrumSettings(JSON.stringify({ kit: 'cowbell' })).kit).toBe('acoustic');
  });
});

describe('the settings store', () => {
  const saved = new Map<string, string>();
  beforeEach(() => {
    saved.clear();
    vi.resetModules();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads what was saved, saves each change, and tells its listeners', async () => {
    saved.set(DRUM_SETTINGS_KEY, JSON.stringify({ kit: 'machine' }));
    const store = await import('./drumSettings');
    expect(store.getDrumSettings().kit).toBe('machine');
    const heard = vi.fn();
    const stop = store.subscribeDrumSettings(heard);
    store.setDrumSettings((settings) => ({ ...settings, kit: 'brushes', humanize: 0.2 }));
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.getDrumSettings().kit).toBe('brushes');
    expect(JSON.parse(saved.get(DRUM_SETTINGS_KEY)!)).toMatchObject({ kit: 'brushes', humanize: 0.2 });
    stop();
    store.setDrumSettings((settings) => ({ ...settings, kit: 'acoustic' }));
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('a kit whose controls did not change keeps the same object, so listeners can tell which kit moved', async () => {
    const store = await import('./drumSettings');
    const before = store.getDrumSettings();
    store.setDrumSettings((settings) => ({ ...settings, params: { ...settings.params, machine: { ...settings.params.machine, kickHz: 44 } } }));
    const after = store.getDrumSettings();
    expect(after.params.machine).not.toBe(before.params.machine);
    expect(after.params.machine.kickHz).toBe(44);
    expect(after.params.acoustic).toBe(before.params.acoustic);
    expect(after.params.brushes).toBe(before.params.brushes);
  });

  it('a change is repaired before it is kept', async () => {
    const store = await import('./drumSettings');
    store.setDrumSettings((settings) => ({ ...settings, humanize: -4, trimDb: { ...settings.trimDb, acoustic: 99 } }));
    expect(store.getDrumSettings().humanize).toBe(0);
    expect(store.getDrumSettings().trimDb.acoustic).toBe(24);
  });

  it('works without storage: the defaults, kept until the page closes', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('no storage'); },
      setItem: () => { throw new Error('no storage'); },
    });
    const store = await import('./drumSettings');
    expect(store.getDrumSettings()).toEqual(DEFAULT_DRUM_SETTINGS);
    store.setDrumSettings((settings) => ({ ...settings, kit: 'machine' }));
    expect(store.getDrumSettings().kit).toBe('machine');
  });
});
