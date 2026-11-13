import * as Tone from 'tone';
import processorCode from './bassProcessor.ts?worklet';
import { BASS_PROCESSOR_NAME, type BassMessage, type BassProcessorOptions } from './bassMessages';
import type { BassParams } from './bassParams';

const loading = new WeakMap<object, Promise<void>>();

/**
 * Load the modelled bass's processor onto a context's audio thread. Safe to
 * call often: each context loads it once. Rejects where AudioWorklet is
 * missing or the module cannot be fetched, and the caller falls back to
 * another voice.
 */
export function loadModelledBass(context: Tone.BaseContext = Tone.getContext()): Promise<void> {
  const raw = context.rawContext;
  let promise = loading.get(raw);
  if (!promise) {
    if (raw.audioWorklet) {
      // The processor arrives as one self-contained script (see vite.worklet.ts) and loads from a Blob.
      // Straight to the context: Tone's own `addAudioWorkletModule` remembers only the first module it was given.
      const url = URL.createObjectURL(new Blob([processorCode], { type: 'application/javascript' }));
      promise = raw.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    } else {
      promise = Promise.reject(new Error('AudioWorklet is not available here.'));
    }
    promise.catch(() => loading.delete(raw));
    loading.set(raw, promise);
  }
  return promise;
}

export interface ModelledBassOptions {
  params?: Partial<BassParams>;
  /** Level trim in decibels, on top of the model's own calibrated output gain. */
  trimDb?: number;
  /** Seed for the note-to-note variation. */
  seed?: number;
}

/**
 * The modelled electric bass as a voice for the jam loop: the same
 * `play`, `stop` and `dispose` as `BassVoice`, so the engine can use either.
 * The sound is made on the audio thread by `bassProcessor.ts`.
 *
 * Make one with `ModelledBassVoice.create`, which loads the processor first.
 */
export class ModelledBassVoice {
  private readonly node: AudioWorkletNode;
  private readonly out: Tone.Gain;
  private disposed = false;

  private constructor(context: Tone.BaseContext, destination: Tone.InputNode, options: ModelledBassOptions) {
    const processorOptions: BassProcessorOptions = { params: options.params, seed: options.seed };
    this.out = new Tone.Gain(Tone.dbToGain(options.trimDb ?? 0)).connect(destination);
    this.node = context.createAudioWorkletNode(BASS_PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions,
    });
    Tone.connect(this.node, this.out);
  }

  static async create(destination: Tone.InputNode, options: ModelledBassOptions = {}): Promise<ModelledBassVoice> {
    const context = Tone.getContext();
    await loadModelledBass(context);
    return new ModelledBassVoice(context, destination, options);
  }

  /** Play this MIDI note from `time` (seconds on the audio clock) for `duration` seconds. */
  play(midi: number, time: number, duration: number, velocity = 0.8): void {
    this.post({ type: 'note', midi, time, duration: Math.max(0.03, duration), velocity });
  }

  /** Silence it now. */
  stop(): void {
    this.post({ type: 'stop' });
  }

  /** Change some of the model's controls. Tone and drive apply at once, the rest from the next note. */
  setParams(params: Partial<BassParams>): void {
    this.post({ type: 'params', params });
  }

  /** Set the level trim, in decibels. */
  setTrim(db: number): void {
    this.out.gain.rampTo(Tone.dbToGain(db), 0.03);
  }

  dispose(): void {
    if (this.disposed) return;
    this.post({ type: 'dispose' });
    this.disposed = true;
    this.node.port.close();
    this.node.disconnect();
    this.out.dispose();
  }

  private post(message: BassMessage): void {
    if (!this.disposed) this.node.port.postMessage(message);
  }
}
