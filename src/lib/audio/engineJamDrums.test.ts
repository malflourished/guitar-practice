import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The jam loop's drums: a fourth gain node, a kit that loads only when the
 * Drums fader is up, strokes placed on the grid plus their own small offset,
 * and the plain cymbal standing in whenever the kit is not playing.
 */
interface FakeNode {
  gain: { rampTo: ReturnType<typeof vi.fn> };
  target?: unknown;
}

const fake = vi.hoisted(() => ({
  buffers: [] as Array<{ loaded: boolean; options: { onload: () => void } }>,
  gains: [] as Array<{ value: unknown; node: unknown }>,
  repeat: null as null | ((time: number) => void),
  transport: { bpm: { value: 0 }, stop: vi.fn(), cancel: vi.fn(), start: vi.fn(), scheduleRepeat: vi.fn() },
  clicks: vi.fn(),
  cymbal: { play: vi.fn(), stop: vi.fn(), built: 0 },
  drums: { hit: vi.fn(), stop: vi.fn(), setKit: vi.fn(), setParams: vi.fn(), setTrim: vi.fn(), create: vi.fn(), fail: false },
}));

vi.mock('tone', () => {
  class Node {
    gain = { rampTo: vi.fn() }; frequency = { rampTo: vi.fn() }; wet = { rampTo: vi.fn() };
    target: unknown;
    connect(target?: unknown) { this.target = target; return this; }
    toDestination() { return this; } generate() { return Promise.resolve(); }
    triggerAttackRelease = fake.clicks; triggerRelease = vi.fn();
  }
  class Gain extends Node {
    constructor(value?: unknown) { super(); fake.gains.push({ value, node: this }); }
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
    Gain, Limiter: Node, Filter: Node, Reverb: Node, Synth: Node,
    ToneAudioBuffers: Buffers, ToneBufferSource: Node,
    getTransport: () => fake.transport,
    getDestination: () => new Node(),
    getDraw: () => ({ schedule: () => {}, cancel: () => {} }),
  };
});
vi.mock('./bassVoice', () => ({ BassVoice: class { play = vi.fn(); stop = vi.fn(); } }));
vi.mock('./padVoice', () => ({ PadVoice: class { play = vi.fn(); stop = vi.fn(); } }));
vi.mock('./cymbalVoice', () => ({
  CymbalVoice: class {
    constructor() { fake.cymbal.built++; }
    play = fake.cymbal.play; stop = fake.cymbal.stop;
  },
}));
vi.mock('./synth/bass/modelledBassVoice', () => ({
  ModelledBassVoice: { create: () => Promise.resolve({ play: vi.fn(), stop: vi.fn(), setParams: vi.fn(), setTrim: vi.fn() }) },
}));
vi.mock('./synth/drums/drumKitVoice', () => ({
  DrumKitVoice: {
    create: (destination: unknown, options: unknown) => {
      fake.drums.create(destination, options);
      if (fake.drums.fail) return Promise.reject(new Error('no worklet here'));
      const { hit, stop, setKit, setParams, setTrim } = fake.drums;
      return Promise.resolve({ hit, stop, setKit, setParams, setTrim });
    },
  },
}));

import type { GuitarAudioEngine } from './engine';
import type { JamEvent } from './jamSchedule';
import { jamGains } from './jamMix';
import { DEFAULT_DRUM_PARAMS } from './synth/drums/drumParams';
import type { DrumSettings } from './synth/drums/drumSettings';

type Inside = { jamDrums: FakeNode; output: FakeNode };
const inside = (engine: GuitarAudioEngine) => engine as unknown as Inside;

/** A fresh engine and a fresh settings store for each test, so no listener outlives its test. */
async function setup(change: (settings: DrumSettings) => DrumSettings = (settings) => settings) {
  vi.resetModules();
  const { setDrumSettings } = await import('./synth/drums/drumSettings');
  const { GuitarAudioEngine: Engine } = await import('./engine');
  setDrumSettings(change);
  return { engine: new Engine(), setDrumSettings };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
/** A bar with one of each thing the drums touch: a snare a little behind beat 2, a swept brush, and the plain cymbal. */
const bar: JamEvent[] = [
  { kind: 'cymbal', beat: 0 },
  { kind: 'drum', beat: 0, piece: 'kick', velocity: 0.95, offsetMs: 0 },
  { kind: 'drum', beat: 1, piece: 'snare', velocity: 0.9, offsetMs: 4 },
  { kind: 'drum', beat: 1 + 2 / 3, piece: 'hatClosed', velocity: 0.4, offsetMs: -2 },
  { kind: 'drum', beat: 2, piece: 'brushSweep', velocity: 0.5, offsetMs: 0, beats: 1 },
];

/** Start a jam at 120 BPM (half a second a beat) and play the count-in. */
async function startJam(engine: GuitarAudioEngine) {
  const started = engine.playJam({ bpm: 120, steps: 4, getBar: () => ({ events: bar, strum: [] }), loop: () => true, onBeat: () => {} });
  await settle();
  fake.buffers[fake.buffers.length - 1].loaded = true;
  fake.buffers[fake.buffers.length - 1].options.onload();
  expect(await started).toBe(true);
  await settle(); // time for the kit to load, as the count-in gives it
  fake.transport.bpm.value = 120;
  for (let beat = 0; beat < 4; beat++) fake.repeat!(100 + beat * 0.5);
}
/** Play the four beats of the next bar, the first at `time`. */
const playBar = (time: number) => { for (let beat = 0; beat < 4; beat++) fake.repeat!(time + beat * 0.5); };

const up = jamGains({ guitar: 0, bass: 0, pad: 0, drums: 0 });
const off = jamGains({ guitar: 0, bass: 0, pad: 0, drums: 'off' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout });
  fake.buffers.length = 0; fake.gains.length = 0; fake.repeat = null; fake.cymbal.built = 0; fake.drums.fail = false;
  vi.clearAllMocks();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the Drums fader', () => {
  it('has its own gain node, straight into the output, and starts at off', async () => {
    const { engine } = await setup();
    await startJam(engine);
    const { jamDrums, output } = inside(engine);
    expect(jamDrums.target).toBe(output);
    expect(fake.gains.find((gain) => gain.node === jamDrums)?.value).toBe(0);
  });

  it('a mix that does not mention the drums has none: the three-layer calls mean what they always meant', async () => {
    const { engine } = await setup();
    engine.setJamMix({ guitar: 1, bass: 1, pad: 1 });
    await startJam(engine);
    playBar(102);
    expect(fake.drums.create).not.toHaveBeenCalled();
    expect(fake.drums.hit).not.toHaveBeenCalled();
    expect(fake.cymbal.play).toHaveBeenCalledTimes(1);
  });

  it('moves live, ramped over 30 ms like the others, and is remembered if set before the sound starts', async () => {
    const { engine } = await setup();
    engine.setJamMix(jamGains({ guitar: 0, bass: 0, pad: 0, drums: -6 }));
    await startJam(engine);
    const { jamDrums } = inside(engine);
    expect(fake.gains.find((gain) => gain.node === jamDrums)?.value).toBeCloseTo(0.501, 3);
    fake.transport.stop.mockClear(); // Play itself stops whatever was playing before
    engine.setJamMix(jamGains({ guitar: 0, bass: 0, pad: 0, drums: 3 }));
    expect(jamDrums.gain.rampTo).toHaveBeenLastCalledWith(expect.closeTo(1.4125, 3), 0.03);
    // no restart: the loop carries on
    expect(fake.transport.stop).not.toHaveBeenCalled();
    expect(fake.transport.start).toHaveBeenCalledTimes(1);
  });
});

describe('with the Drums fader at off', () => {
  it('no stroke is scheduled, the kit is never even loaded, and the plain cymbal marks the top of the form', async () => {
    const { engine } = await setup();
    engine.setJamMix(off);
    await startJam(engine);
    playBar(102);
    expect(fake.drums.create).not.toHaveBeenCalled();
    expect(fake.drums.hit).not.toHaveBeenCalled();
    expect(fake.cymbal.play).toHaveBeenCalledWith(102);
  });
});

describe('with the Drums fader up', () => {
  it('the kit loads at Play, into the fader’s gain node, set up from the saved kit, controls and trim', async () => {
    const params = { ...DEFAULT_DRUM_PARAMS, machine: { ...DEFAULT_DRUM_PARAMS.machine, kickHz: 44 } };
    const { engine } = await setup((settings) => ({ ...settings, kit: 'machine', params, trimDb: { ...settings.trimDb, machine: -1.5 } }));
    engine.setJamMix(up);
    await startJam(engine);
    expect(fake.drums.create).toHaveBeenCalledTimes(1);
    expect(fake.drums.create).toHaveBeenCalledWith(inside(engine).jamDrums, { kit: 'machine', params: params.machine, trimDb: -1.5 });
  });

  it('each stroke plays at its place on the grid plus its own offset, at the tempo’s beat length', async () => {
    const { engine } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    playBar(102);
    expect(fake.drums.hit).toHaveBeenCalledTimes(4);
    expect(fake.drums.hit).toHaveBeenNthCalledWith(1, 'kick', 102, 0.95, 0);
    // beat 2 is half a second on, and this stroke sits 4 ms behind it
    expect(fake.drums.hit).toHaveBeenNthCalledWith(2, 'snare', expect.closeTo(102.504, 6), 0.9, 0);
    // the swung "and" of beat 2: two thirds of a beat after it, 2 ms early
    expect(fake.drums.hit).toHaveBeenNthCalledWith(3, 'hatClosed', expect.closeTo(102.5 + (2 / 3) * 0.5 - 0.002, 6), 0.4, 0);
    // a sweep's length is in beats: one beat is half a second here
    expect(fake.drums.hit).toHaveBeenNthCalledWith(4, 'brushSweep', 103, 0.5, 0.5);
  });

  it('offsets never add up: bar after bar, the same stroke is the same distance from its beat', async () => {
    const { engine } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    for (let index = 0; index < 50; index++) playBar(102 + index * 2);
    const snares = fake.drums.hit.mock.calls.filter((call) => call[0] === 'snare');
    expect(snares).toHaveLength(50);
    snares.forEach((call, index) => expect(call[1]).toBeCloseTo(102 + index * 2 + 0.5 + 0.004, 6));
  });

  it('the kit’s own crash marks the top: the plain cymbal is left out, and is not even built', async () => {
    const { engine } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    playBar(102);
    expect(fake.cymbal.play).not.toHaveBeenCalled();
    expect(fake.cymbal.built).toBe(0);
  });

  it('turned up while the loop plays, the kit loads then and joins on the next strokes', async () => {
    const { engine } = await setup();
    engine.setJamMix(off);
    await startJam(engine);
    playBar(102);
    expect(fake.drums.hit).not.toHaveBeenCalled();
    engine.setJamMix(up);
    await settle();
    expect(fake.drums.create).toHaveBeenCalledTimes(1);
    playBar(104);
    expect(fake.drums.hit).toHaveBeenCalledTimes(4);
    // and turned off again: silence from the next beat, and the plain cymbal is back
    engine.setJamMix(off);
    playBar(106);
    expect(fake.drums.hit).toHaveBeenCalledTimes(4);
    expect(fake.cymbal.play).toHaveBeenLastCalledWith(106);
  });

  it('a mix change does not load the kit while nothing is playing', async () => {
    const { engine } = await setup();
    engine.setJamMix(up);
    await settle();
    expect(fake.drums.create).not.toHaveBeenCalled();
  });

  it('if the kit cannot load, the jam goes on without drums and keeps the plain cymbal', async () => {
    fake.drums.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    playBar(102);
    playBar(104);
    expect(fake.drums.hit).not.toHaveBeenCalled();
    expect(fake.cymbal.play).toHaveBeenCalledTimes(2);
    expect(fake.drums.create).toHaveBeenCalledTimes(1); // it does not keep trying
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('Stop silences the kit', async () => {
    const { engine } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    playBar(102);
    engine.stopAll();
    expect(fake.drums.stop).toHaveBeenCalled();
  });
});

describe('following the sound lab while the loop plays', () => {
  it('a change of kit reaches the voice with that kit’s controls and trim', async () => {
    const { engine, setDrumSettings } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    setDrumSettings((settings) => ({ ...settings, kit: 'machine', trimDb: { ...settings.trimDb, machine: -2 } }));
    expect(fake.drums.setKit).toHaveBeenCalledWith('machine', DEFAULT_DRUM_PARAMS.machine);
    expect(fake.drums.setTrim).toHaveBeenLastCalledWith(-2);
  });

  it('a dial reaches the voice; another kit’s dial does not', async () => {
    const { engine, setDrumSettings } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    setDrumSettings((settings) => ({ ...settings, params: { ...settings.params, acoustic: { ...settings.params.acoustic, snareHz: 210 } } }));
    expect(fake.drums.setParams).toHaveBeenCalledTimes(1);
    expect(fake.drums.setParams).toHaveBeenLastCalledWith(expect.objectContaining({ snareHz: 210 }));
    setDrumSettings((settings) => ({ ...settings, params: { ...settings.params, machine: { ...settings.params.machine, snareHz: 150 } } }));
    expect(fake.drums.setParams).toHaveBeenCalledTimes(1);
    expect(fake.drums.setKit).not.toHaveBeenCalled();
  });

  it('a new trim reaches the voice', async () => {
    const { engine, setDrumSettings } = await setup();
    engine.setJamMix(up);
    await startJam(engine);
    setDrumSettings((settings) => ({ ...settings, trimDb: { ...settings.trimDb, acoustic: 1.5 } }));
    expect(fake.drums.setTrim).toHaveBeenLastCalledWith(1.5);
  });
});
