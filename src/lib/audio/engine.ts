import * as Tone from 'tone';
import type { FretPosition } from '../../types/music';
import { positionToMidi } from './pitch';
import { DEFAULT_INSTRUMENT, GUITAR_INSTRUMENTS, INSTRUMENT_SAMPLES, chooseSample, type GuitarInstrumentName } from './instruments';
import { loopTempo, type PlaybackOptions, type PracticePattern } from './pattern';
import { PadVoice } from './padVoice';
import { BassVoice } from './bassVoice';
import { CymbalVoice } from './cymbalVoice';
import { BEATS_PER_BAR, type JamEvent } from './jamSchedule';
import type { JamGains } from './jamMix';
import { getBassSettings, subscribeBassSettings } from './synth/bass/bassSettings';
import type { ModelledBassVoice } from './synth/bass/modelledBassVoice';
import { sameDrumParams } from './synth/drums/drumParams';
import { getDrumSettings, subscribeDrumSettings } from './synth/drums/drumSettings';
import type { DrumKitVoice } from './synth/drums/drumKitVoice';
export { DEFAULT_INSTRUMENT, GUITAR_INSTRUMENTS, type GuitarInstrumentName };

/**
 * The guitar's share of the jam mix, under its own full level so that the bass
 * and pad fit beneath it without the limiter squashing all three (see the
 * measured levels in docs/specs/P2-jam-loop.md). This is the Guitar fader's
 * 0 dB: the fader scales it.
 */
const JAM_GUITAR_LEVEL = 0.6;
/** A fader move takes this long to land, so it never clicks and never waits for a bar line. */
const JAM_MIX_RAMP = 0.03;

/**
 * What the jam needs from its bass: play a MIDI note, and stop. The bass is
 * built in `createJamBass` and nowhere else, so a different voice can take over
 * by changing that one function.
 */
type JamBass = Pick<BassVoice, 'play' | 'stop'>;
function createJamBass(destination: Tone.InputNode): JamBass {
  return new BassVoice(destination);
}

/** One bar of the jam loop, ready to sound: its events, and the shape the guitar strums. */
export interface JamBar {
  events: JamEvent[];
  strum: FretPosition[];
}

export interface JamPlayOptions {
  bpm: number;
  /** Steps in the loop: one bar each. */
  steps: number;
  /** Asked at each bar line, so a change applies from the next bar. */
  getBar: (bar: number) => JamBar;
  /** Asked at the end of each pass; false stops after it. */
  loop: () => boolean;
  /** At the sound's time: `bar` is -1 during the count-in. */
  onBeat: (bar: number, beat: number) => void;
  onEnd?: () => void;
}

export interface EngineState {
  instrument: GuitarInstrumentName;
  loading: boolean;
  ready: boolean;
  volume: number;
  muted: boolean;
  room: number;
  error: string | null;
}

/** Bundled multisamples, per-string damping, and a single audio-clock transport. */
export class GuitarAudioEngine {
  private state: EngineState = { instrument: DEFAULT_INSTRUMENT, loading: false, ready: false, volume: 0.75, muted: false, room: 0.12, error: null };
  private listeners = new Set<(state: EngineState) => void>();
  private banks = new Map<GuitarInstrumentName, Tone.ToneAudioBuffers>();
  private loads = new Map<GuitarInstrumentName, Promise<void>>();
  private sources = new Set<Tone.ToneBufferSource>();
  private previews = new Set<Tone.ToneBufferSource>();
  private previewGeneration = 0;
  private strings = new Map<number, Tone.ToneBufferSource>();
  private output: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private filter: Tone.Filter | null = null;
  private limiter: Tone.Limiter | null = null;
  private click: Tone.Synth | null = null;
  // The jam's layers each sound through their own gain node, which the
  // faders move live. They feed the chain the single guitar does: the guitar's
  // into the tone filter, the pad's into the reverb, the bass's straight out.
  // The drums go straight out too: the kit brings a room of its own.
  private jamGuitar: Tone.Gain | null = null;
  private jamBass: Tone.Gain | null = null;
  private jamPad: Tone.Gain | null = null;
  private jamDrums: Tone.Gain | null = null;
  private jamGains: JamGains = { guitar: 1, bass: 1, pad: 1 };
  private pad: PadVoice | null = null;
  private bass: JamBass | null = null;
  private cymbal: CymbalVoice | null = null;
  private modelledBass: ModelledBassVoice | null = null;
  private modelledBassLoading: Promise<void> | null = null;
  private drums: DrumKitVoice | null = null;
  private drumsLoading: Promise<void> | null = null;
  private lastStrum: Tone.ToneBufferSource[] = [];
  private jamRunning = false;
  private graphReady: Promise<void> | null = null;
  private generation = 0;
  private take = 0;

  subscribe(listener: (state: EngineState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  getState() { return this.state; }
  /** Put saved settings back without loading any sound; it loads on the first play. */
  restore(saved: Partial<Pick<EngineState, 'instrument' | 'volume' | 'muted' | 'room'>>) {
    const { instrument, volume, muted, room } = saved;
    this.update({
      ...(instrument ? { instrument } : {}),
      ...(volume !== undefined ? { volume: Math.max(0, Math.min(1, volume)) } : {}),
      ...(muted !== undefined ? { muted } : {}),
      ...(room !== undefined ? { room: Math.max(0, Math.min(0.5, room)) } : {}),
    });
  }
  private update(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener(this.state));
  }
  private async setup() {
    await Tone.start();
    if (!this.graphReady) {
      this.limiter = new Tone.Limiter(-2).toDestination();
      this.output = new Tone.Gain(this.state.muted ? 0 : this.state.volume).connect(this.limiter);
      this.reverb = new Tone.Reverb({ decay: 0.8, preDelay: 0.012, wet: this.state.room }).connect(this.output);
      this.filter = new Tone.Filter(9500, 'lowpass').connect(this.reverb);
      this.jamGuitar = new Tone.Gain(JAM_GUITAR_LEVEL * this.jamGains.guitar).connect(this.filter);
      this.jamBass = new Tone.Gain(this.jamGains.bass).connect(this.output);
      this.jamPad = new Tone.Gain(this.jamGains.pad).connect(this.reverb);
      this.jamDrums = new Tone.Gain(this.jamGains.drums ?? 0).connect(this.output);
      this.click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.02 }, volume: -15 }).connect(this.output);
      this.graphReady = this.reverb.generate().then(() => undefined);
    }
    await this.graphReady;
  }
  async ensureLoaded(name = this.state.instrument): Promise<boolean> {
    try {
      await this.setup();
      if (!this.banks.get(name)?.loaded) {
        if (name === this.state.instrument) this.update({ loading: true, ready: false, error: null });
        let load = this.loads.get(name);
        if (!load) {
          load = new Promise<void>((resolve, reject) => {
            const deadline = window.setTimeout(() => reject(new Error('Sound loading timed out.')), 20000);
            const urls = Object.fromEntries(INSTRUMENT_SAMPLES[name].samples.map(s => [s.file, `${import.meta.env.BASE_URL}audio/${s.file}`]));
            const buffers = new Tone.ToneAudioBuffers({ urls,
              onload: () => { clearTimeout(deadline); resolve(); },
              onerror: (error) => { clearTimeout(deadline); reject(error); },
            });
            this.banks.set(name, buffers);
          }).catch(error => {
            this.banks.get(name)?.dispose(); this.banks.delete(name); this.loads.delete(name);
            throw error;
          });
          this.loads.set(name, load);
        }
        await load;
      }
      if (name !== this.state.instrument) return false;
      this.filter?.frequency.rampTo(INSTRUMENT_SAMPLES[name].cutoff, 0.1);
      this.update({ ready: true, loading: false, error: null });
      return true;
    } catch {
      if (name === this.state.instrument) this.update({ ready: false, loading: false, error: 'Couldn’t load this guitar. Try again to reload the bundled sound.' });
      return false;
    }
  }
  async setInstrument(name: GuitarInstrumentName) {
    this.stopAll();
    this.update({ instrument: name, ready: false, error: null });
    await this.ensureLoaded(name);
  }
  setVolume(volume: number) {
    this.update({ volume: Math.max(0, Math.min(1, volume)) });
    this.output?.gain.rampTo(this.state.muted ? 0 : this.state.volume, 0.025);
  }
  setMuted(muted: boolean) { this.update({ muted }); this.setVolume(this.state.volume); }
  setRoom(room: number) {
    this.update({ room: Math.max(0, Math.min(0.5, room)) });
    this.reverb?.wet.rampTo(this.state.room, 0.1);
  }

  /** `into` is where the note sounds: the tone filter, unless the jam's guitar gain takes it. */
  private note(midi: number, time: number, duration: number, velocity = 0.76, string?: number, level = 1, into?: Tone.InputNode) {
    const bank = this.banks.get(this.state.instrument);
    if (!bank?.loaded || !this.filter) return;
    const config = INSTRUMENT_SAMPLES[this.state.instrument];
    const sample = chooseSample(config.samples, midi, string, velocity, this.take++);
    if (string !== undefined) this.strings.get(string)?.stop(time);
    const source = new Tone.ToneBufferSource({ url: bank.get(sample.file),
      playbackRate: 2 ** ((midi - sample.midi) / 12), fadeIn: 0.002,
      fadeOut: config.release, curve: 'exponential',
      onended: () => {
        this.sources.delete(source);
        this.previews.delete(source);
        if (string !== undefined && this.strings.get(string) === source) this.strings.delete(string);
        // Tone disposes one-shot sources after their ended callback.
      },
    }).connect(into ?? this.filter);
    this.sources.add(source);
    if (string !== undefined) this.strings.set(string, source);
    // Small, deterministic attack variation; beat timing and pitch stay exact.
    source.start(time, 0, Math.max(0.06, duration), velocity * config.gain * level * (0.95 + (this.take % 3) * 0.025));
    return source;
  }
  private chord(positions: FretPosition[], time: number, duration: number, up = false) {
    const ordered = [...positions].sort((a, b) => up ? a.string - b.string : b.string - a.string);
    ordered.forEach((p, index) => this.note(positionToMidi(p), time + index * (up ? 0.014 : 0.021), duration,
      up ? 0.54 + (index % 3) * 0.02 : index === 0 ? 0.84 : 0.64 + (index % 3) * 0.035, p.string));
  }
  async playNote(midi: number, options: { duration?: number; velocity?: number; string?: number } = {}) {
    const generation = this.generation;
    if (await this.ensureLoaded() && generation === this.generation) {
      this.note(midi, Tone.now(), options.duration ?? 1.3, (options.velocity ?? 96) / 127, options.string);
    }
  }
  async playChord(positions: FretPosition[]) {
    this.stopAll();
    const generation = this.generation;
    if (await this.ensureLoaded() && generation === this.generation) this.chord(positions, Tone.now(), 2.4);
  }
  async hearInterval(rootMidi: number, semitones: number) {
    const preview = ++this.previewGeneration;
    this.previews.forEach(source => source.stop(Tone.now()));
    this.previews.clear();
    const generation = this.generation;
    if (await this.ensureLoaded() && generation === this.generation && preview === this.previewGeneration) {
      const time = Tone.now();
      const root = this.note(rootMidi, time, 0.55);
      const interval = this.note(rootMidi + semitones, time + 0.7, 0.8);
      if (root) this.previews.add(root);
      if (interval) this.previews.add(interval);
    }
  }
  async playPattern(pattern: PracticePattern, options: PlaybackOptions): Promise<boolean> {
    this.stopAll();
    const generation = this.generation;
    if (!(await this.ensureLoaded()) || generation !== this.generation || pattern.beats <= 0) return false;
    const transport = Tone.getTransport();
    const countIn = options.countIn ?? 0;
    let ticks = 0;
    let previousCycle = -1;
    transport.bpm.value = options.bpm;
    const draw = (time: number, callback: () => void) => Tone.getDraw().schedule(() => {
      if (generation === this.generation) callback();
    }, time);
    transport.scheduleRepeat(time => {
      if (generation !== this.generation) return;
      const totalBeat = ticks++ / 2;
      if (totalBeat < countIn) {
        if (Number.isInteger(totalBeat)) {
          this.click?.triggerAttackRelease(totalBeat === 0 ? 1400 : 1000, 0.03, time, 0.8);
          draw(time, () => options.onBeat?.(totalBeat, true, 0, options.bpm));
        }
        return;
      }
      const playedBeat = totalBeat - countIn;
      const cycle = Math.floor(playedBeat / pattern.beats);
      if (cycle > 0 && !options.loop) {
        transport.stop(time);
        draw(time, () => options.onEnd?.());
        return;
      }
      const beat = playedBeat % pattern.beats;
      const bpm = loopTempo(options.bpm, cycle, !!options.ramp);
      if (cycle !== previousCycle) { transport.bpm.value = bpm; previousCycle = cycle; }
      if (Number.isInteger(totalBeat)) {
        if (options.metronome) this.click?.triggerAttackRelease(playedBeat % 4 === 0 ? 1400 : 1000, 0.025, time, playedBeat % 4 === 0 ? 0.7 : 0.45);
        draw(time, () => options.onBeat?.(playedBeat, false, cycle, bpm));
      }
      pattern.events.filter(event => event.beat === beat).forEach(event => {
        if (event.positions.length > 1) this.chord(event.positions, time, event.duration * 60 / bpm, cycle % 2 === 1);
        else if (event.positions[0]) {
          const p = event.positions[0];
          this.note(positionToMidi(p), time, event.duration * 60 / bpm, playedBeat % 4 === 0 ? 0.83 : 0.7, p.string);
        }
        draw(time, () => options.onEvent?.(event));
      });
    }, '8n', 0);
    transport.start('+0.06', 0);
    return true;
  }
  /**
   * One strum of a jam bar: `velocity` is 1 for the accent, lower for the rest.
   * It damps the strum before it within about 60 ms, so repeated strums do not
   * smear into an echo.
   */
  private jamStrum(positions: FretPosition[], time: number, duration: number, up: boolean, velocity: number) {
    for (const source of this.lastStrum) {
      if (!this.sources.has(source)) continue; // already ended and disposed
      source.fadeOut = 0.06;
      source.stop(time);
      for (const [string, held] of this.strings) if (held === source) this.strings.delete(string);
    }
    const ordered = [...positions].sort((a, b) => up ? a.string - b.string : b.string - a.string);
    const spread = up ? 0.012 : 0.018;
    this.lastStrum = [];
    ordered.forEach((p, index) => {
      // the jam's guitar gain carries JAM_GUITAR_LEVEL and the Guitar fader
      const source = this.note(positionToMidi(p), time + index * spread, duration,
        velocity * (0.86 + (index % 3) * 0.05), p.string, 1, this.jamGuitar ?? undefined);
      if (source) this.lastStrum.push(source);
    });
  }
  /**
   * Set the jam's layer gains (see `jamMix.ts`: 1 is the default level, 0 is
   * off; the drums are off when left out). They land over about 30 ms, with no
   * restart and no wait for a bar line, and are remembered if the sound has
   * not started yet. A layer at 0 schedules nothing from the next beat on.
   */
  setJamMix(gains: JamGains) {
    this.jamGains = { ...gains };
    this.jamGuitar?.gain.rampTo(JAM_GUITAR_LEVEL * gains.guitar, JAM_MIX_RAMP);
    this.jamBass?.gain.rampTo(gains.bass, JAM_MIX_RAMP);
    this.jamPad?.gain.rampTo(gains.pad, JAM_MIX_RAMP);
    this.jamDrums?.gain.rampTo(gains.drums ?? 0, JAM_MIX_RAMP);
    // Turned up while the loop plays: fetch the kit now, so it joins within a bar.
    if (this.jamRunning && this.drumsUp()) void this.loadDrums();
  }
  /** Change the tempo of a running jam: the Transport keeps its place, so nothing skips. */
  setJamTempo(bpm: number) {
    if (this.jamRunning) Tone.getTransport().bpm.value = bpm;
  }
  /**
   * The jam loop: a count-in bar, then the bars of `getBar` round and round.
   * The Transport ticks once a beat; each downbeat asks for the next bar, so a
   * new backing, feel or click lands on a bar line. The screen follows through
   * `Tone.Draw` at each beat's audio time.
   */
  async playJam(options: JamPlayOptions): Promise<boolean> {
    this.stopAll();
    const generation = this.generation;
    if (!(await this.ensureLoaded()) || generation !== this.generation || options.steps <= 0) return false;
    const transport = Tone.getTransport();
    transport.bpm.value = options.bpm;
    this.jamRunning = true;
    if (getBassSettings().jamBass === 'modelled') void this.loadModelledBass(); // ready by the end of the count-in
    if (this.drumsUp()) void this.loadDrums(); // likewise
    let count = 0;
    let bar: JamBar | null = null;
    const draw = (time: number, callback: () => void) => Tone.getDraw().schedule(() => {
      if (generation === this.generation) callback();
    }, time);
    transport.scheduleRepeat(time => {
      if (generation !== this.generation) return;
      const n = count++;
      const beat = n % BEATS_PER_BAR;
      const barNumber = Math.floor(n / BEATS_PER_BAR) - 1; // -1 is the count-in
      const beatSeconds = 60 / transport.bpm.value;
      if (barNumber < 0) {
        this.click?.triggerAttackRelease(beat === 0 ? 1400 : 1000, 0.03, time, 0.8);
        draw(time, () => options.onBeat(-1, beat));
        return;
      }
      if (beat === 0) {
        if (barNumber > 0 && barNumber % options.steps === 0 && !options.loop()) {
          transport.stop(time);
          this.jamRunning = false;
          draw(time, () => options.onEnd?.());
          return;
        }
        bar = options.getBar(barNumber);
      }
      draw(time, () => options.onBeat(barNumber, beat));
      bar?.events.filter(event => Math.floor(event.beat) === beat).forEach(event => {
        const at = time + (event.beat - beat) * beatSeconds;
        // A layer whose fader is off schedules nothing: no events, not just silence.
        if (event.kind === 'bass') {
          if (this.jamGains.bass <= 0) return;
          this.jamBassVoice().play(event.midi, at, event.duration * beatSeconds, event.velocity);
        } else if (event.kind === 'strum') {
          if (this.jamGains.guitar > 0) this.jamStrum(bar!.strum, at, event.duration * beatSeconds, event.up, event.velocity);
        } else if (event.kind === 'pad') {
          if (this.jamGains.pad <= 0) return;
          this.pad ??= new PadVoice(this.jamPad ?? this.reverb ?? Tone.getDestination());
          this.pad.play(event.midis, at, event.duration * beatSeconds);
        } else if (event.kind === 'cymbal') {
          // While the kit plays, its own crash marks the top of the form.
          if (this.drumsUp() && this.drums) return;
          // the top of the form: no fader of its own, and Click has no say
          this.cymbal ??= new CymbalVoice(this.output ?? Tone.getDestination());
          this.cymbal.play(at);
        } else if (event.kind === 'drum') {
          if (!this.drumsUp()) return;
          // A stroke's time is its place on the grid plus its own small offset: nothing accumulates.
          if (this.drums) this.drums.hit(event.piece, at + event.offsetMs / 1000, event.velocity, (event.beats ?? 0) * beatSeconds);
          else void this.loadDrums();
        } else this.click?.triggerAttackRelease(event.accent ? 1400 : 1000, 0.025, at, event.accent ? 0.7 : 0.45);
      });
    }, '4n', 0);
    transport.start('+0.06', 0);
    return true;
  }
  /**
   * The jam's bass voice: the modelled bass when the sound lab's setting asks
   * for it and it has loaded, else the synth bass. Both play into the Bass
   * fader's gain node.
   */
  private jamBassVoice(): Pick<JamBass, 'play'> {
    if (getBassSettings().jamBass === 'modelled') {
      if (this.modelledBass) return this.modelledBass;
      void this.loadModelledBass();
    }
    this.bass ??= createJamBass(this.jamBass ?? this.output ?? Tone.getDestination());
    return this.bass;
  }
  /**
   * Load the modelled bass (its code and its audio worklet) the first time it
   * is wanted. If that fails, the jam stays on the synth bass. Once loaded, it
   * follows the lab's controls, and a switch of bass silences the one left behind.
   */
  private loadModelledBass(): Promise<void> {
    this.modelledBassLoading ??= import('./synth/bass/modelledBassVoice')
      .then(async ({ ModelledBassVoice }) => {
        let settings = getBassSettings();
        const voice = await ModelledBassVoice.create(this.jamBass ?? this.output ?? Tone.getDestination(), settings);
        this.modelledBass = voice;
        subscribeBassSettings(() => {
          const next = getBassSettings();
          if (next.params !== settings.params) voice.setParams(next.params);
          if (next.trimDb !== settings.trimDb) voice.setTrim(next.trimDb);
          if (next.jamBass !== settings.jamBass) (next.jamBass === 'modelled' ? this.bass : voice)?.stop();
          settings = next;
        });
      })
      .catch((error: unknown) => {
        console.warn('The modelled bass could not load, so the jam loop is using the synth bass.', error);
      });
    return this.modelledBassLoading;
  }
  /** The Drums fader is above off. */
  private drumsUp(): boolean {
    return (this.jamGains.drums ?? 0) > 0;
  }
  /**
   * Load the drum kit (its code and its audio worklet) the first time the
   * Drums fader is up while the jam plays. It plays into the fader's gain
   * node. If it cannot load, the jam goes on without drums, and the plain
   * cymbal keeps marking the top of the form. Once loaded, it follows the
   * sound lab: the choice of kit, its controls and its level trim.
   */
  private loadDrums(): Promise<void> {
    this.drumsLoading ??= import('./synth/drums/drumKitVoice')
      .then(async ({ DrumKitVoice }) => {
        let settings = getDrumSettings();
        const voice = await DrumKitVoice.create(this.jamDrums ?? this.output ?? Tone.getDestination(), {
          kit: settings.kit,
          params: settings.params[settings.kit],
          trimDb: settings.trimDb[settings.kit],
        });
        this.drums = voice;
        subscribeDrumSettings(() => {
          const next = getDrumSettings();
          const kit = next.kit;
          if (kit !== settings.kit) voice.setKit(kit, next.params[kit]);
          else if (!sameDrumParams(next.params[kit], settings.params[kit])) voice.setParams(next.params[kit]);
          if (kit !== settings.kit || next.trimDb[kit] !== settings.trimDb[kit]) voice.setTrim(next.trimDb[kit]);
          settings = next;
        });
      })
      .catch((error: unknown) => {
        console.warn('The drum kit could not load, so the jam loop is playing without drums.', error);
      });
    return this.drumsLoading;
  }
  stopAll() {
    this.generation++;
    this.jamRunning = false;
    this.pad?.stop();
    this.bass?.stop();
    this.cymbal?.stop();
    this.modelledBass?.stop();
    this.drums?.stop();
    this.lastStrum = [];
    this.previewGeneration++;
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getDraw().cancel();
    this.sources.forEach(source => source.stop(Tone.now()));
    this.previews.clear();
    this.strings.clear();
    this.click?.triggerRelease();
  }
}
