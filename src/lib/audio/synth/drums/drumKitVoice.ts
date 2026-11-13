import * as Tone from 'tone';
import processorCode from './drumProcessor.ts?worklet';
import { DRUM_PROCESSOR_NAME, type DrumMessage, type DrumProcessorOptions } from './drumMessages';
import type { DrumKitId, DrumParams, DrumPiece } from './drumParams';

const loading = new WeakMap<object, Promise<void>>();

/**
 * Load the drum kit's processor onto a context's audio thread. Safe to call
 * often: each context loads it once. Rejects where AudioWorklet is missing or
 * the module cannot be loaded, and the caller carries on without drums.
 */
export function loadDrumKit(context: Tone.BaseContext = Tone.getContext()): Promise<void> {
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

export interface DrumKitOptions {
  kit?: DrumKitId;
  params?: Partial<DrumParams>;
  /** Level trim in decibels, on top of the kit's own calibrated output gain. */
  trimDb?: number;
  /** Seed for the stroke-to-stroke variation. */
  seed?: number;
}

/**
 * The drum kit as a voice for the jam loop and the sound lab: `hit` a piece
 * at a time on the audio clock, `stop`, `dispose`. The sound is made on the
 * audio thread by `drumProcessor.ts`, in stereo.
 *
 * Make one with `DrumKitVoice.create`, which loads the processor first.
 */
export class DrumKitVoice {
  private readonly node: AudioWorkletNode;
  private readonly out: Tone.Gain;
  private disposed = false;

  private constructor(context: Tone.BaseContext, destination: Tone.InputNode, options: DrumKitOptions) {
    const processorOptions: DrumProcessorOptions = { kit: options.kit, params: options.params, seed: options.seed };
    this.out = new Tone.Gain(Tone.dbToGain(options.trimDb ?? 0)).connect(destination);
    this.node = context.createAudioWorkletNode(DRUM_PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions,
    });
    Tone.connect(this.node, this.out);
  }

  static async create(destination: Tone.InputNode, options: DrumKitOptions = {}): Promise<DrumKitVoice> {
    const context = Tone.getContext();
    await loadDrumKit(context);
    return new DrumKitVoice(context, destination, options);
  }

  /**
   * Play `piece` at `time` (seconds on the audio clock). `duration` is how
   * long a brush sweep lasts, in seconds; other pieces ignore it.
   */
  hit(piece: DrumPiece, time: number, velocity = 0.8, duration = 0): void {
    this.post({ type: 'hit', piece, time, velocity, duration });
  }

  /** Silence it now. */
  stop(): void {
    this.post({ type: 'stop' });
  }

  /** Change kit, with that kit's controls. What is sounding fades out first. */
  setKit(kit: DrumKitId, params: Partial<DrumParams> = {}): void {
    this.post({ type: 'kit', kit, params });
  }

  /** Change some of the kit's controls. They apply from the next stroke. */
  setParams(params: Partial<DrumParams>): void {
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

  private post(message: DrumMessage): void {
    if (!this.disposed) this.node.port.postMessage(message);
  }
}
