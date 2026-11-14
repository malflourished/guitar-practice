/**
 * The drum kit on the audio thread. An AudioWorklet processor that owns a
 * `DrumSynth` and does two things: turns messages into scheduled strokes, and
 * fills each 128-sample block of its two output channels. All the sound is in
 * `drumSynth.ts`, which the tests exercise in Node.
 *
 * Strokes arrive ahead of time with their start on the audio clock, and the
 * synth places them to the sample. A stroke that arrives late plays at once.
 *
 * This file runs only inside an AudioWorkletGlobalScope. Load it with
 * `loadDrumKit` (`drumKitVoice.ts`); do not import it anywhere else.
 */
import { DRUM_PROCESSOR_NAME, type DrumMessage, type DrumProcessorOptions } from './drumMessages';
import { DrumSynth } from './drumSynth';

// The parts of the worklet scope this file uses (TypeScript's DOM library does not describe it).
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}
declare function registerProcessor(
  name: string,
  processor: new (options: { processorOptions?: DrumProcessorOptions }) => AudioWorkletProcessor,
): void;

class DrumProcessor extends AudioWorkletProcessor {
  private readonly synth: DrumSynth;
  /** The second ear, for a host that gives the node only one output channel. */
  private spare = new Float32Array(128);
  private alive = true;

  constructor(options: { processorOptions?: DrumProcessorOptions }) {
    super();
    const setup = options.processorOptions ?? {};
    this.synth = new DrumSynth(sampleRate, setup.kit, setup.params, setup.seed);
    this.port.onmessage = (event: MessageEvent<DrumMessage>) => this.receive(event.data);
  }

  private receive(message: DrumMessage): void {
    switch (message.type) {
      case 'hit':
        this.synth.hit(message.time * sampleRate, message.piece, message.velocity, message.duration * sampleRate);
        break;
      case 'stop':
        this.synth.stop();
        break;
      case 'kit':
        this.synth.setKit(message.kit, message.params);
        break;
      case 'params':
        this.synth.setParams(message.params);
        break;
      case 'dispose':
        this.alive = false;
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    const left = output?.[0];
    if (!left) return this.alive;
    let right = output[1];
    if (!right) {
      if (this.spare.length !== left.length) this.spare = new Float32Array(left.length);
      right = this.spare;
    }
    this.synth.render(left, right, currentFrame);
    if (!output[1]) {
      // one channel only: fold the two ears together
      for (let i = 0; i < left.length; i++) left[i] = 0.5 * (left[i] + right[i]);
    }
    return this.alive;
  }
}

registerProcessor(DRUM_PROCESSOR_NAME, DrumProcessor);
