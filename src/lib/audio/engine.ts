import * as Tone from 'tone';
import type { FretPosition } from '../../types/music';
import { positionToMidi } from './pitch';
import { DEFAULT_INSTRUMENT, GUITAR_INSTRUMENTS, INSTRUMENT_SAMPLES, chooseSample, type GuitarInstrumentName } from './instruments';
import { loopTempo, type PlaybackOptions, type PracticePattern } from './pattern';
export { DEFAULT_INSTRUMENT, GUITAR_INSTRUMENTS, type GuitarInstrumentName };

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
  private graphReady: Promise<void> | null = null;
  private generation = 0;
  private take = 0;

  subscribe(listener: (state: EngineState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  getState() { return this.state; }
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

  private note(midi: number, time: number, duration: number, velocity = 0.76, string?: number) {
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
    }).connect(this.filter);
    this.sources.add(source);
    if (string !== undefined) this.strings.set(string, source);
    // Small, deterministic attack variation; beat timing and pitch stay exact.
    source.start(time, 0, Math.max(0.06, duration), velocity * config.gain * (0.95 + (this.take % 3) * 0.025));
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
  stopAll() {
    this.generation++;
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
