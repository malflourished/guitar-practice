import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Which bass the jam loop plays: the synth bass by default, the modelled bass
 * when the sound lab's setting asks for it, and the synth bass again if the
 * modelled one cannot load.
 */
const fake = vi.hoisted(() => ({
  buffers: [] as Array<{ loaded: boolean; options: { onload: () => void } }>,
  repeat: null as null | ((time: number) => void),
  transport: { bpm: { value: 0 }, stop: vi.fn(), cancel: vi.fn(), start: vi.fn(), scheduleRepeat: vi.fn() },
  synth: { play: vi.fn(), stop: vi.fn(), made: 0 },
  modelled: { play: vi.fn(), stop: vi.fn(), setParams: vi.fn(), setTrim: vi.fn(), create: vi.fn(), fail: false },
}));

vi.mock('tone', () => {
  class Node {
    gain = { rampTo: vi.fn() }; frequency = { rampTo: vi.fn() }; wet = { rampTo: vi.fn() };
    connect() { return this; } toDestination() { return this; } generate() { return Promise.resolve(); }
    triggerAttackRelease = vi.fn(); triggerRelease = vi.fn();
  }
  class Buffers {
    loaded = false;
    options: { onload: () => void };
    constructor(options: Buffers['options']) { this.options = options; fake.buffers.push(this); }
    get(file: string) { return file; }
    dispose = vi.fn();
  }
  fake.transport.scheduleRepeat.mockImplementation((callback: (time: number) => void) => { fake.repeat = callback; });
  return {
    start: () => Promise.resolve(), now: () => 10,
    Gain: Node, Limiter: Node, Filter: Node, Reverb: Node, Synth: Node,
    ToneAudioBuffers: Buffers, ToneBufferSource: Node,
    getTransport: () => fake.transport,
    getDestination: () => new Node(),
    getDraw: () => ({ schedule: () => {}, cancel: () => {} }),
  };
});
vi.mock('./bassVoice', () => ({
  BassVoice: class {
    constructor() { fake.synth.made++; }
    play = fake.synth.play; stop = fake.synth.stop;
  },
}));
vi.mock('./synth/bass/modelledBassVoice', () => ({
  ModelledBassVoice: {
    create: (destination: unknown, options: unknown) => {
      fake.modelled.create(destination, options);
      if (fake.modelled.fail) return Promise.reject(new Error('no worklet here'));
      const { play, stop, setParams, setTrim } = fake.modelled;
      return Promise.resolve({ play, stop, setParams, setTrim });
    },
  },
}));

import type { GuitarAudioEngine } from './engine';
import type { JamEvent } from './jamSchedule';
import { DEFAULT_BASS_PARAMS } from './synth/bass/bassParams';
import type { BassSettings } from './synth/bass/bassSettings';

/** A fresh engine and a fresh settings store for each test, so no listener outlives its test. */
async function setup(change: (settings: BassSettings) => BassSettings = (settings) => settings) {
  vi.resetModules();
  const { setBassSettings } = await import('./synth/bass/bassSettings');
  const { GuitarAudioEngine: Engine } = await import('./engine');
  setBassSettings(change);
  return { engine: new Engine(), setBassSettings };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const bassNote: JamEvent = { kind: 'bass', beat: 0, midi: 33, duration: 2, velocity: 0.9 };

/** Start a jam at 120 BPM whose every bar is one bass note on beat 1, and play the count-in. */
async function startJam(engine: GuitarAudioEngine) {
  const started = engine.playJam({ bpm: 120, steps: 4, getBar: () => ({ events: [bassNote], strum: [] }), loop: () => true, onBeat: () => {} });
  await settle();
  fake.buffers[fake.buffers.length - 1].loaded = true;
  fake.buffers[fake.buffers.length - 1].options.onload();
  expect(await started).toBe(true);
  await settle(); // time for the modelled bass to load, as the count-in gives it
  fake.transport.bpm.value = 120;
  for (let beat = 0; beat < 4; beat++) fake.repeat!(100 + beat * 0.5);
}
/** Play the downbeat of the next bar at `time`. */
const downbeat = (time: number) => {
  fake.repeat!(time);
  for (let beat = 1; beat < 4; beat++) fake.repeat!(time + beat * 0.5);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout });
  fake.buffers.length = 0; fake.repeat = null; fake.synth.made = 0; fake.modelled.fail = false;
  vi.clearAllMocks();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the jam loop\'s bass voice', () => {
  it('is the modelled bass by default, the owner\'s choice', async () => {
    const { engine } = await setup();
    await startJam(engine);
    downbeat(102);
    expect(fake.modelled.play).toHaveBeenCalled();
    expect(fake.synth.play).not.toHaveBeenCalled();
  });

  it('is the synth bass when the lab\'s setting says so, and then never loads the modelled bass', async () => {
    const { engine } = await setup((settings) => ({ ...settings, jamBass: 'synth' }));
    await startJam(engine);
    downbeat(102);
    expect(fake.synth.play).toHaveBeenCalledWith(33, 102, 1, 0.9); // two beats at 120 BPM is one second
    expect(fake.modelled.create).not.toHaveBeenCalled();
    expect(fake.modelled.play).not.toHaveBeenCalled();
  });

  it('is the modelled bass when chosen, set up from the saved controls and trim', async () => {
    const params = { ...DEFAULT_BASS_PARAMS, toneHz: 900 };
    const { engine } = await setup(() => ({ jamBass: 'modelled', params, trimDb: 1.5 }));
    await startJam(engine);
    downbeat(102);
    expect(fake.modelled.create).toHaveBeenCalledTimes(1);
    expect(fake.modelled.create.mock.calls[0][1]).toMatchObject({ params, trimDb: 1.5 });
    expect(fake.modelled.play).toHaveBeenCalledWith(33, 102, 1, 0.9);
    expect(fake.synth.play).not.toHaveBeenCalled();
  });

  it('stays on the synth bass when the modelled bass cannot load', async () => {
    fake.modelled.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = await setup((settings) => ({ ...settings, jamBass: 'modelled' }));
    await startJam(engine);
    downbeat(102);
    downbeat(104);
    expect(fake.synth.play).toHaveBeenCalledTimes(2);
    expect(fake.modelled.play).not.toHaveBeenCalled();
    expect(fake.modelled.create).toHaveBeenCalledTimes(1); // it does not try again on every note
    expect(warn).toHaveBeenCalledTimes(1); // and it says so once, for whoever is looking at the console
    warn.mockRestore();
  });

  it('follows the lab while the loop plays: a flip silences the bass left behind, and the dials reach the model', async () => {
    const { engine, setBassSettings } = await setup((settings) => ({ ...settings, jamBass: 'modelled' }));
    await startJam(engine);
    downbeat(102);
    expect(fake.modelled.play).toHaveBeenCalledTimes(1);

    const params = { ...DEFAULT_BASS_PARAMS, drive: 0.6 };
    setBassSettings((settings) => ({ ...settings, params, trimDb: -2 }));
    expect(fake.modelled.setParams).toHaveBeenCalledWith(params);
    expect(fake.modelled.setTrim).toHaveBeenCalledWith(-2);
    expect(fake.modelled.stop).not.toHaveBeenCalled();

    setBassSettings((settings) => ({ ...settings, jamBass: 'synth' }));
    expect(fake.modelled.stop).toHaveBeenCalledTimes(1);
    downbeat(104);
    expect(fake.synth.play).toHaveBeenCalledWith(33, 104, 1, 0.9);
    expect(fake.modelled.play).toHaveBeenCalledTimes(1);

    setBassSettings((settings) => ({ ...settings, jamBass: 'modelled' }));
    expect(fake.synth.stop).toHaveBeenCalledTimes(1);
    downbeat(106);
    expect(fake.modelled.play).toHaveBeenCalledTimes(2);
  });

  it('loads the modelled bass when it is chosen in the middle of a loop', async () => {
    const { engine, setBassSettings } = await setup((settings) => ({ ...settings, jamBass: 'synth' }));
    await startJam(engine);
    downbeat(102);
    setBassSettings((settings) => ({ ...settings, jamBass: 'modelled' }));
    downbeat(104); // not loaded yet: the synth bass carries this bar
    expect(fake.synth.play).toHaveBeenCalledTimes(2);
    await settle();
    downbeat(106);
    expect(fake.modelled.play).toHaveBeenCalledWith(33, 106, 1, 0.9);
    expect(fake.synth.play).toHaveBeenCalledTimes(2);
  });

  it('stops both basses on stop', async () => {
    const { engine, setBassSettings } = await setup((settings) => ({ ...settings, jamBass: 'modelled' }));
    await startJam(engine);
    downbeat(102);
    setBassSettings((settings) => ({ ...settings, jamBass: 'synth' }));
    downbeat(104);
    fake.synth.stop.mockClear(); fake.modelled.stop.mockClear();
    engine.stopAll();
    expect(fake.synth.stop).toHaveBeenCalledTimes(1);
    expect(fake.modelled.stop).toHaveBeenCalledTimes(1);
  });
});
