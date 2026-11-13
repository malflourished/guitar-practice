/**
 * The modelled bass on the audio thread. An AudioWorklet processor that owns
 * a `BassSynth` and does two things: turns messages into scheduled notes, and
 * fills each 128-sample block. All the sound is in `bassSynth.ts`, which the
 * tests exercise in Node.
 *
 * Notes arrive ahead of time with their start on the audio clock, and the
 * synth places them to the sample. A note that arrives late starts at once.
 *
 * This file runs only inside an AudioWorkletGlobalScope. Load it with
 * `loadModelledBass` (`modelledBassVoice.ts`); do not import it anywhere else.
 */
import { BASS_PROCESSOR_NAME, type BassMessage, type BassProcessorOptions } from './bassMessages';
import { BassSynth } from './bassSynth';

// The parts of the worklet scope this file uses (TypeScript's DOM library does not describe it).
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}
declare function registerProcessor(
  name: string,
  processor: new (options: { processorOptions?: BassProcessorOptions }) => AudioWorkletProcessor,
): void;

class BassProcessor extends AudioWorkletProcessor {
  private readonly synth: BassSynth;
  private alive = true;

  constructor(options: { processorOptions?: BassProcessorOptions }) {
    super();
    const setup = options.processorOptions ?? {};
    this.synth = new BassSynth(sampleRate, setup.params, setup.seed);
    this.port.onmessage = (event: MessageEvent<BassMessage>) => this.receive(event.data);
  }

  private receive(message: BassMessage): void {
    switch (message.type) {
      case 'note':
        this.synth.noteOn(message.time * sampleRate, message.midi, message.velocity, message.duration * sampleRate);
        break;
      case 'stop':
        this.synth.stop();
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
    const first = output?.[0];
    if (!first) return this.alive;
    this.synth.render(first, currentFrame);
    for (let channel = 1; channel < output.length; channel++) output[channel].set(first);
    return this.alive;
  }
}

registerProcessor(BASS_PROCESSOR_NAME, BassProcessor);
