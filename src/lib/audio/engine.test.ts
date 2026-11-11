import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  buffers: [] as Array<{ loaded: boolean; options: { onload: () => void; onerror: (error: Error) => void }; dispose: () => void }>,
  sources: [] as Array<{ options: { onended: () => void; playbackRate: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
  draws: [] as Array<{ callback: () => void; time: number }>,
  repeat: null as null | ((time: number) => void),
  transport: { bpm: { value: 0 }, stop: vi.fn(), cancel: vi.fn(), start: vi.fn(), scheduleRepeat: vi.fn() },
  clicks: vi.fn(),
}));

vi.mock('tone', () => {
  class Node {
    gain = { rampTo: vi.fn() }; frequency = { rampTo: vi.fn() }; wet = { rampTo: vi.fn() };
    connect() { return this; } toDestination() { return this; } generate() { return Promise.resolve(); }
    triggerAttackRelease = fake.clicks; triggerRelease = vi.fn();
  }
  class Buffers {
    loaded = false;
    options: { onload: () => void; onerror: (error: Error) => void };
    constructor(options: Buffers['options']) { this.options = options; fake.buffers.push(this); }
    get(file: string) { return file; }
    dispose = vi.fn();
  }
  class Source extends Node {
    options: { onended: () => void; playbackRate: number };
    constructor(options: Source['options']) { super(); this.options = options; fake.sources.push(this); }
    start = vi.fn(); stop = vi.fn(); dispose = vi.fn();
  }
  fake.transport.scheduleRepeat.mockImplementation((callback: (time: number) => void) => { fake.repeat = callback; });
  return {
    start: () => Promise.resolve(), now: () => 10,
    Gain: Node, Limiter: Node, Filter: Node, Reverb: Node, Synth: Node,
    ToneAudioBuffers: Buffers, ToneBufferSource: Source,
    getTransport: () => fake.transport,
    getDraw: () => ({ schedule: (callback: () => void, time: number) => fake.draws.push({ callback, time }), cancel: () => { fake.draws.length = 0; } }),
  };
});

import { GuitarAudioEngine } from './engine';
import { sequencePattern } from './pattern';

const pattern = sequencePattern([{ string: 0, fret: 0, note: 'E' }]);
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const load = async (index = 0) => {
  await settle();
  fake.buffers[index].loaded = true;
  fake.buffers[index].options.onload();
  await settle();
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout });
  fake.buffers.length = 0; fake.sources.length = 0; fake.draws.length = 0; fake.repeat = null;
  vi.clearAllMocks();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('audio readiness and cancellation', () => {
  it('waits for samples, shares one load, and discards playback cancelled while loading', async () => {
    const engine = new GuitarAudioEngine();
    const first = engine.playPattern(pattern, { bpm: 72 });
    const shared = engine.ensureLoaded();
    await settle();
    expect(fake.buffers).toHaveLength(1);
    expect(fake.transport.start).not.toHaveBeenCalled();
    engine.stopAll();
    await load();
    expect(await first).toBe(false);
    expect(await shared).toBe(true);
    expect(fake.transport.start).not.toHaveBeenCalled();
    expect(fake.sources).toHaveLength(0);
  });
  it('surfaces a failed bank and allows an actual retry', async () => {
    const engine = new GuitarAudioEngine();
    const failed = engine.ensureLoaded();
    await settle();
    fake.buffers[0].options.onerror(new Error('Cannot decode'));
    expect(await failed).toBe(false);
    expect(engine.getState()).toMatchObject({ ready: false, loading: false });
    expect(engine.getState().error).toBeTruthy();
    const retry = engine.ensureLoaded();
    await load(1);
    expect(await retry).toBe(true);
    expect(engine.getState().error).toBeNull();
  });
  it('does not damp an already ended string source', async () => {
    const engine = new GuitarAudioEngine();
    const first = engine.playNote(64, { string: 0 });
    await load(); await first;
    fake.sources[0].options.onended();
    await engine.playNote(65, { string: 0 });
    expect(fake.sources[0].stop).not.toHaveBeenCalled();
    await engine.playNote(67, { string: 0 });
    expect(fake.sources[1].stop).toHaveBeenCalledWith(10);
  });
  it('replaces interval replays without stopping the practice transport', async () => {
    const engine = new GuitarAudioEngine();
    const first = engine.hearInterval(57, 7);
    await load(); await first;
    expect(fake.sources).toHaveLength(2);
    fake.transport.stop.mockClear();
    await engine.hearInterval(57, 3);
    expect(fake.sources[0].stop).toHaveBeenCalledWith(10);
    expect(fake.sources[1].stop).toHaveBeenCalledWith(10);
    expect(fake.sources).toHaveLength(4);
    expect(fake.transport.stop).not.toHaveBeenCalled();
  });
});

describe('one audio clock for notes and cues', () => {
  it('counts four beats, schedules at audio time, and defers visual cues to the draw clock', async () => {
    const engine = new GuitarAudioEngine();
    const onEvent = vi.fn();
    const onEnd = vi.fn();
    const started = engine.playPattern(pattern, { bpm: 60, countIn: 4, onEvent, onEnd });
    await load();
    expect(await started).toBe(true);
    for (let tick = 0; tick < 8; tick++) fake.repeat!(100 + tick * 0.5);
    expect(fake.clicks).toHaveBeenCalledTimes(4);
    expect(fake.sources).toHaveLength(0);
    fake.repeat!(104);
    expect(fake.sources[0].start).toHaveBeenCalledWith(104, 0, 0.9, expect.any(Number));
    expect(onEvent).not.toHaveBeenCalled();
    fake.draws.filter(draw => draw.time === 104).forEach(draw => draw.callback());
    expect(onEvent).toHaveBeenCalledOnce();
    fake.repeat!(104.5); fake.repeat!(105);
    expect(fake.transport.stop).toHaveBeenCalledWith(105);
    expect(onEnd).not.toHaveBeenCalled();
    fake.draws.filter(draw => draw.time === 105).forEach(draw => draw.callback());
    expect(onEnd).toHaveBeenCalledOnce();
  });
  it('keeps looping and blocks stale visual callbacks after stop', async () => {
    const engine = new GuitarAudioEngine();
    const onEvent = vi.fn();
    const started = engine.playPattern(pattern, { bpm: 72, loop: true, onEvent });
    await load(); await started;
    for (let tick = 0; tick < 8; tick++) fake.repeat!(20 + tick * 0.5);
    expect(fake.sources).toHaveLength(4);
    const pending = [...fake.draws];
    engine.stopAll();
    pending.forEach(draw => draw.callback());
    expect(onEvent).not.toHaveBeenCalled();
    fake.sources.forEach(source => expect(source.stop).toHaveBeenCalled());
  });
});
