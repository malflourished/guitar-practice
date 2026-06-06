import * as Tone from 'tone';
import {
  DEFAULT_INSTRUMENT,
  GUITAR_INSTRUMENTS,
  INSTRUMENT_SAMPLES,
  type GuitarInstrumentName,
} from './instruments';
import { midiToNote } from './midiToNote';

export { GUITAR_INSTRUMENTS, DEFAULT_INSTRUMENT, type GuitarInstrumentName };

export interface EngineState {
  instrument: GuitarInstrumentName;
  loading: boolean;
  ready: boolean;
  /** 0..1 user-facing volume. */
  volume: number;
  muted: boolean;
}

interface PlayOptions {
  velocity?: number;
  duration?: number;
}

interface ChordOptions extends PlayOptions {
  /** Milliseconds between successive strings in the strum. */
  strumMs?: number;
}

interface SequenceOptions extends PlayOptions {
  /** Milliseconds between successive notes. */
  gapMs?: number;
}

const DEFAULT_VELOCITY = 0.78;
const DEFAULT_STRUM_MS = 28;
const DEFAULT_SEQUENCE_GAP_MS = 320;

/**
 * Sample-based guitar engine using Tone.Sampler and curated CC0 recordings
 * (FreePats + Discord SFZ GM). Loads samples from jsDelivr CDN.
 */
export class GuitarAudioEngine {
  private sampler: Tone.Sampler | null = null;
  private reverb: Tone.Reverb | null = null;
  private outputGain: Tone.Gain | null = null;
  private loadToken = 0;
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  private state: EngineState = {
    instrument: DEFAULT_INSTRUMENT,
    loading: false,
    ready: false,
    volume: 0.85,
    muted: false,
  };

  private listeners = new Set<(state: EngineState) => void>();

  subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): EngineState {
    return this.state;
  }

  private setState(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  /** Start/resume the Tone audio context (requires a user gesture). */
  private async ensureAudio(): Promise<void> {
    await Tone.start();
  }

  private applyOutputVolume() {
    if (!this.outputGain) return;
    const value = this.state.muted ? 0 : this.state.volume;
    this.outputGain.gain.rampTo(value, 0.02);
  }

  private disposeInstrument() {
    this.cancelScheduled();
    this.sampler?.dispose();
    this.sampler = null;
  }

  async ensureLoaded(name: GuitarInstrumentName = this.state.instrument): Promise<void> {
    if (this.sampler && this.state.instrument === name && this.state.ready) {
      return;
    }
    await this.setInstrument(name);
  }

  /** Load (or swap to) a curated guitar sample pack. */
  async setInstrument(name: GuitarInstrumentName): Promise<void> {
    const token = ++this.loadToken;
    this.setState({ instrument: name, loading: true, ready: false });

    await this.ensureAudio();
    this.disposeInstrument();

    const config = INSTRUMENT_SAMPLES[name];

    if (!this.reverb) {
      this.reverb = new Tone.Reverb({ decay: 2.2, wet: config.reverbWet }).toDestination();
      await this.reverb.generate();
    } else {
      this.reverb.wet.rampTo(config.reverbWet, 0.05);
    }

    if (!this.outputGain) {
      this.outputGain = new Tone.Gain(this.state.muted ? 0 : this.state.volume);
      this.outputGain.connect(this.reverb);
    }

    const sampler = new Tone.Sampler({
      urls: config.urls,
      baseUrl: config.baseUrl,
      release: config.release,
      onload: () => {
        if (token === this.loadToken) {
          this.setState({ loading: false, ready: true });
        }
      },
      onerror: () => {
        if (token === this.loadToken) {
          this.setState({ loading: false, ready: false });
        }
      },
    });

    sampler.connect(this.outputGain);

    // A newer load started while buffers were fetching.
    if (token !== this.loadToken) {
      sampler.dispose();
      return;
    }

    this.sampler = sampler;
    this.applyOutputVolume();

    try {
      await Tone.loaded();
    } catch {
      if (token === this.loadToken) {
        this.setState({ loading: false, ready: false });
      }
    }
  }

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.setState({ volume: clamped });
    this.applyOutputVolume();
  }

  setMuted(muted: boolean) {
    this.setState({ muted });
    this.applyOutputVolume();
  }

  private triggerNote(midi: number, duration?: number, velocity = DEFAULT_VELOCITY) {
    if (!this.sampler) return;
    const note = midiToNote(midi);
    if (duration !== undefined) {
      this.sampler.triggerAttackRelease(note, duration, Tone.now(), velocity);
    } else {
      this.sampler.triggerAttackRelease(note, '8n', Tone.now(), velocity);
    }
  }

  async playNote(midi: number, options: PlayOptions = {}): Promise<void> {
    await this.ensureLoaded();
    const velocity =
      options.velocity !== undefined ? options.velocity / 127 : DEFAULT_VELOCITY;
    this.triggerNote(midi, options.duration, velocity);
  }

  async playChord(midis: number[], options: ChordOptions = {}): Promise<void> {
    await this.ensureLoaded();
    if (!this.sampler || midis.length === 0) return;

    this.cancelScheduled();
    const strumMs = options.strumMs ?? DEFAULT_STRUM_MS;
    const velocity =
      options.velocity !== undefined ? options.velocity / 127 : DEFAULT_VELOCITY;
    const ordered = [...midis].sort((a, b) => a - b);

    ordered.forEach((midi, index) => {
      const id = setTimeout(() => {
        this.triggerNote(midi, options.duration, velocity);
      }, index * strumMs);
      this.timeouts.push(id);
    });
  }

  async playSequence(midis: number[], options: SequenceOptions = {}): Promise<void> {
    await this.ensureLoaded();
    if (!this.sampler || midis.length === 0) return;

    this.cancelScheduled();
    const gapMs = options.gapMs ?? DEFAULT_SEQUENCE_GAP_MS;
    const velocity =
      options.velocity !== undefined ? options.velocity / 127 : DEFAULT_VELOCITY;
    const noteDuration = options.duration ?? gapMs / 1000;

    midis.forEach((midi, index) => {
      const id = setTimeout(() => {
        this.triggerNote(midi, noteDuration, velocity);
      }, index * gapMs);
      this.timeouts.push(id);
    });
  }

  private cancelScheduled() {
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts = [];
  }

  stopAll() {
    this.cancelScheduled();
    this.sampler?.releaseAll(Tone.now());
  }
}
