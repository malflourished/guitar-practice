import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mock = ReturnType<typeof vi.fn>;
interface FakeNode {
  gain: { rampTo: Mock };
  target?: unknown;
}

const fake = vi.hoisted(() => ({
  buffers: [] as Array<{ loaded: boolean; options: { onload: () => void; onerror: (error: Error) => void } }>,
  sources: [] as Array<{ target: unknown; start: ReturnType<typeof vi.fn> }>,
  gains: [] as Array<{ value: unknown; node: unknown }>,
  repeat: null as null | ((time: number) => void),
  transport: { bpm: { value: 0 }, stop: vi.fn(), cancel: vi.fn(), start: vi.fn(), scheduleRepeat: vi.fn() },
  clicks: vi.fn(),
  bass: { built: [] as Array<{ destination: unknown }>, play: vi.fn(), stop: vi.fn() },
  pad: { built: [] as Array<{ destination: unknown }>, play: vi.fn(), stop: vi.fn() },
  cymbal: { built: [] as Array<{ destination: unknown }>, play: vi.fn(), stop: vi.fn() },
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
    options: { onload: () => void; onerror: (error: Error) => void };
    constructor(options: Buffers['options']) { this.options = options; fake.buffers.push(this); }
    get(file: string) { return file; }
    dispose = vi.fn();
  }
  class Source extends Node {
    options: unknown;
    constructor(options: unknown) { super(); this.options = options; fake.sources.push(this as unknown as (typeof fake.sources)[number]); }
    start = vi.fn(); stop = vi.fn(); dispose = vi.fn();
  }
  fake.transport.scheduleRepeat.mockImplementation((callback: (time: number) => void) => { fake.repeat = callback; });
  return {
    start: () => Promise.resolve(), now: () => 10,
    Gain, Limiter: Node, Filter: Node, Reverb: Node, Synth: Node,
    ToneAudioBuffers: Buffers, ToneBufferSource: Source,
    getTransport: () => fake.transport,
    getDestination: () => ({ destination: true }),
    getDraw: () => ({ schedule: () => undefined, cancel: () => undefined }),
  };
});

vi.mock('./bassVoice', () => ({
  BassVoice: class {
    constructor(destination: unknown) { fake.bass.built.push({ destination }); }
    play = fake.bass.play; stop = fake.bass.stop;
  },
}));
vi.mock('./padVoice', () => ({
  PadVoice: class {
    constructor(destination: unknown) { fake.pad.built.push({ destination }); }
    play = fake.pad.play; stop = fake.pad.stop;
  },
}));
vi.mock('./cymbalVoice', () => ({
  CymbalVoice: class {
    constructor(destination: unknown) { fake.cymbal.built.push({ destination }); }
    play = fake.cymbal.play; stop = fake.cymbal.stop;
  },
}));

import { GuitarAudioEngine, JAM_HEADROOM, JAM_HEADROOM_DB, type JamBar, type JamPlayOptions } from './engine';
import type { JamEvent } from './jamSchedule';
import { faderGain, jamGains } from './jamMix';

type Inside = { jamGuitar: FakeNode; jamBass: FakeNode; jamPad: FakeNode; output: FakeNode; reverb: FakeNode; filter: FakeNode };
const inside = (engine: GuitarAudioEngine) => engine as unknown as Inside;

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const load = async () => {
  await settle();
  fake.buffers[0].loaded = true;
  fake.buffers[0].options.onload();
  await settle();
};

const strum = [{ string: 5, fret: 3, note: 'G' }, { string: 4, fret: 2, note: 'B' }, { string: 3, fret: 0, note: 'D' }] as JamBar['strum'];
/** One of every kind of event, on beat 0, as the top of the form would have. */
const everything: JamEvent[] = [
  { kind: 'bass', beat: 0, midi: 36, duration: 2, velocity: 0.9 },
  { kind: 'strum', beat: 0, up: false, velocity: 1, duration: 2 },
  { kind: 'pad', beat: 0, midis: [55, 59, 62], duration: 4 },
  { kind: 'cymbal', beat: 0 },
  { kind: 'click', beat: 0, accent: true },
];
const options = (events: JamEvent[]): JamPlayOptions => ({
  bpm: 120,
  steps: 4,
  getBar: () => ({ events, strum }),
  loop: () => true,
  onBeat: () => undefined,
});

/** Start the jam, get past the count-in, and sound one bar's first beat. */
async function soundOneBar(engine: GuitarAudioEngine, events: JamEvent[] = everything) {
  const started = engine.playJam(options(events));
  await load();
  expect(await started).toBe(true);
  for (let beat = 0; beat < 4; beat++) fake.repeat!(100 + beat * 0.5); // the count-in
  fake.repeat!(102);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout });
  fake.buffers.length = 0; fake.sources.length = 0; fake.gains.length = 0; fake.repeat = null;
  for (const voice of [fake.bass, fake.pad, fake.cymbal]) voice.built.length = 0;
  vi.clearAllMocks();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('the jam mix: three gain nodes feeding the existing chain', () => {
  it('the guitar, bass and pad each get a gain node into the chain: filter, output and reverb', async () => {
    const engine = new GuitarAudioEngine();
    const ready = engine.ensureLoaded();
    await load(); await ready;
    const { jamGuitar, jamBass, jamPad, filter, output, reverb } = inside(engine);
    expect(jamGuitar.target).toBe(filter);
    expect(jamBass.target).toBe(output);
    expect(jamPad.target).toBe(reverb);
  });

  it('the jam has 3 dB of headroom: every layer’s node carries it on top of its fader', () => {
    expect(JAM_HEADROOM_DB).toBe(-3);
    expect(JAM_HEADROOM).toBeCloseTo(0.708, 3);
  });

  it('at the default mix the guitar node carries the 0.6 the jam strums had, and the others 1, each under the jam’s headroom', async () => {
    const engine = new GuitarAudioEngine();
    const ready = engine.ensureLoaded();
    await load(); await ready;
    const { jamGuitar, jamBass, jamPad } = inside(engine);
    const valueOf = (node: unknown) => fake.gains.find((g) => g.node === node)?.value;
    expect(valueOf(jamGuitar)).toBeCloseTo(0.6 * JAM_HEADROOM);
    expect(valueOf(jamBass)).toBe(JAM_HEADROOM);
    expect(valueOf(jamPad)).toBe(JAM_HEADROOM);
  });

  it('a mix set before the sound starts is remembered, and the nodes are built with it', async () => {
    const engine = new GuitarAudioEngine();
    engine.setJamMix(jamGains({ guitar: -6, bass: 'off', pad: 3 }));
    const ready = engine.ensureLoaded();
    await load(); await ready;
    const { jamGuitar, jamBass, jamPad } = inside(engine);
    const valueOf = (node: unknown) => fake.gains.find((g) => g.node === node)?.value as number;
    expect(valueOf(jamGuitar)).toBeCloseTo(0.6 * faderGain(-6) * JAM_HEADROOM);
    expect(valueOf(jamBass)).toBe(0);
    expect(valueOf(jamPad)).toBeCloseTo(faderGain(3) * JAM_HEADROOM);
  });

  it('a fader move ramps each node over 30 ms, so it lands at once with no restart', async () => {
    const engine = new GuitarAudioEngine();
    const ready = engine.ensureLoaded();
    await load(); await ready;
    const { jamGuitar, jamBass, jamPad } = inside(engine);
    engine.setJamMix({ guitar: 0.5, bass: 2, pad: 0 });
    expect(jamGuitar.gain.rampTo).toHaveBeenCalledWith(expect.closeTo(0.6 * 0.5 * JAM_HEADROOM, 10), 0.03);
    expect(jamBass.gain.rampTo).toHaveBeenCalledWith(expect.closeTo(2 * JAM_HEADROOM, 10), 0.03);
    expect(jamPad.gain.rampTo).toHaveBeenCalledWith(0, 0.03);
    expect(fake.transport.stop).not.toHaveBeenCalled();
    expect(fake.transport.start).not.toHaveBeenCalled();
  });

  it('the jam guitar sounds into its own node; a plain note still goes to the tone filter', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine, [{ kind: 'strum', beat: 0, up: false, velocity: 1, duration: 2 }]);
    const { jamGuitar, filter } = inside(engine);
    expect(fake.sources).toHaveLength(strum.length);
    for (const source of fake.sources) expect(source.target).toBe(jamGuitar);
    fake.sources.length = 0;
    await engine.playNote(60);
    expect(fake.sources[0].target).toBe(filter);
  });

  it('the bass and the pad are built into their own nodes', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine);
    const { jamBass, jamPad } = inside(engine);
    expect(fake.bass.built).toEqual([{ destination: jamBass }]);
    expect(fake.pad.built).toEqual([{ destination: jamPad }]);
  });
});

describe('a layer with its fader at off schedules nothing', () => {
  it('with every fader up, one bar sounds the bass, the guitar, the pad and the click', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine);
    expect(fake.bass.play).toHaveBeenCalledTimes(1);
    expect(fake.sources).toHaveLength(strum.length);
    expect(fake.pad.play).toHaveBeenCalledTimes(1);
    expect(fake.clicks).toHaveBeenCalledTimes(5); // four count-in clicks and the bar's
  });

  it('Guitar off: no strums at all, and the rest still sound', async () => {
    const engine = new GuitarAudioEngine();
    engine.setJamMix({ guitar: 0, bass: 1, pad: 1 });
    await soundOneBar(engine);
    expect(fake.sources).toHaveLength(0);
    expect(fake.bass.play).toHaveBeenCalledTimes(1);
    expect(fake.pad.play).toHaveBeenCalledTimes(1);
  });

  it('Bass off: no bass notes, and no bass voice is even built', async () => {
    const engine = new GuitarAudioEngine();
    engine.setJamMix({ guitar: 1, bass: 0, pad: 1 });
    await soundOneBar(engine);
    expect(fake.bass.play).not.toHaveBeenCalled();
    expect(fake.bass.built).toHaveLength(0);
    expect(fake.sources).toHaveLength(strum.length);
    expect(fake.pad.play).toHaveBeenCalledTimes(1);
  });

  it('Pad off: no pad chord', async () => {
    const engine = new GuitarAudioEngine();
    engine.setJamMix({ guitar: 1, bass: 1, pad: 0 });
    await soundOneBar(engine);
    expect(fake.pad.play).not.toHaveBeenCalled();
    expect(fake.bass.play).toHaveBeenCalledTimes(1);
    expect(fake.sources).toHaveLength(strum.length);
  });

  it('a fader turned off while the loop plays takes effect from the next beat, and back on again', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine); // bar 1, beat 1, at time 102
    expect(fake.bass.play).toHaveBeenCalledTimes(1);
    // the rest of the bar, then the next bar's first beat (a beat is half a second here)
    const toNextBar = (from: number) => { for (let beat = 1; beat <= 4; beat++) fake.repeat!(from + beat * 0.5); };
    engine.setJamMix({ guitar: 1, bass: 0, pad: 1 });
    toNextBar(102);
    expect(fake.bass.play).toHaveBeenCalledTimes(1);
    engine.setJamMix({ guitar: 1, bass: 1, pad: 1 });
    toNextBar(104);
    expect(fake.bass.play).toHaveBeenCalledTimes(2);
  });

  it('every layer off still keeps time: the count-in click and the bar’s click sound', async () => {
    const engine = new GuitarAudioEngine();
    engine.setJamMix({ guitar: 0, bass: 0, pad: 0 });
    await soundOneBar(engine);
    expect(fake.clicks).toHaveBeenCalledTimes(5);
  });
});

describe('the cymbal at the top of the form', () => {
  it('plays when the bar asks for it, at that beat’s time, and into the output, under the jam’s headroom', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine, [{ kind: 'cymbal', beat: 0 }]);
    expect(fake.cymbal.play).toHaveBeenCalledTimes(1);
    // it has no gain node of its own, so the headroom is a softer stroke
    expect(fake.cymbal.play).toHaveBeenCalledWith(102, JAM_HEADROOM);
    expect(fake.cymbal.built).toEqual([{ destination: inside(engine).output }]);
  });

  it('has no fader of its own: it plays with every fader off, and the click off', async () => {
    const engine = new GuitarAudioEngine();
    engine.setJamMix({ guitar: 0, bass: 0, pad: 0 });
    await soundOneBar(engine, [{ kind: 'cymbal', beat: 0 }]);
    expect(fake.cymbal.play).toHaveBeenCalledTimes(1);
    expect(fake.clicks).toHaveBeenCalledTimes(4); // only the count-in clicked
  });

  it('is not built until a bar asks for one', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine, [{ kind: 'bass', beat: 0, midi: 36, duration: 2, velocity: 0.9 }]);
    expect(fake.cymbal.built).toHaveLength(0);
  });
});

describe('stopping the jam', () => {
  it('silences the bass, the pad and the cymbal at once', async () => {
    const engine = new GuitarAudioEngine();
    await soundOneBar(engine);
    engine.stopAll();
    expect(fake.bass.stop).toHaveBeenCalled();
    expect(fake.pad.stop).toHaveBeenCalled();
    expect(fake.cymbal.stop).toHaveBeenCalled();
  });
});
