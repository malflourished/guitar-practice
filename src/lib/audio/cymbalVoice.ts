import * as Tone from 'tone';

/** How long the crash takes to die away, in seconds. */
export const CYMBAL_DECAY = 1.5;
/**
 * About 12 dB under the guitar's peak, so it marks the top of the form without
 * competing with the player. Measured 2026-11-13 in the app (90 BPM, steel
 * acoustic at the default volume, after the limiter): the guitar on Quarter
 * peaks at -5.1 dBFS; at -19 dB this voice peaked at -17.9 dBFS (12.8 dB
 * under), so it is 1 dB hotter here, about 11.8 dB under. Its tail falls about
 * 50 dB a second: 60 dB down after about 1.2 s.
 */
export const CYMBAL_DB = -18;

/**
 * A soft cymbal for the top of the form: white noise through a high-pass at
 * about 6 kHz, ringing out over about 1.5 s. Give it a Tone node to play into
 * (the engine's output). It has no fader of its own.
 */
export class CymbalVoice {
  private readonly noise: Tone.NoiseSynth;
  private readonly filter: Tone.Filter;
  private readonly out: Tone.Gain;

  constructor(destination: Tone.InputNode, options: { volumeDb?: number } = {}) {
    this.out = new Tone.Gain(1).connect(destination);
    this.filter = new Tone.Filter(6000, 'highpass').connect(this.out);
    this.noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      // sustain 0: the decay is the whole sound, so the release never matters
      envelope: { attack: 0.002, decay: CYMBAL_DECAY, sustain: 0, release: 0.3 },
      volume: options.volumeDb ?? CYMBAL_DB,
    }).connect(this.filter);
  }

  /** Strike it at `time`. */
  play(time: number, velocity = 1) {
    this.out.gain.cancelScheduledValues(time);
    this.out.gain.setValueAtTime(1, time);
    this.noise.triggerAttackRelease(CYMBAL_DECAY + 0.002, time, velocity);
  }

  /** Silence it now, with no tail left ringing. */
  stop() {
    const now = Tone.now();
    this.noise.triggerRelease(now);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.rampTo(0, 0.04);
  }

  dispose() {
    this.noise.dispose();
    this.filter.dispose();
    this.out.dispose();
  }
}
