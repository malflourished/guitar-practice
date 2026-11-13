import * as Tone from 'tone';

/**
 * A round synth bass for the jam loop: a sawtooth (its filter opens briefly on
 * each note) with a triangle at the same pitch, under a 700 Hz low-pass, so
 * the harmonics carry on small speakers. One note at a time: each note holds
 * until the next starts.
 */
export class BassVoice {
  private readonly saw: Tone.MonoSynth;
  private readonly triangle: Tone.Synth;
  private readonly filter: Tone.Filter;
  private readonly out: Tone.Gain;

  constructor(destination: Tone.InputNode, options: { volumeDb?: number } = {}) {
    this.out = new Tone.Gain(1).connect(destination);
    this.filter = new Tone.Filter(700, 'lowpass').connect(this.out);
    const envelope = { attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.15 };
    const volume = options.volumeDb ?? -4.5;
    this.saw = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope,
      filter: { type: 'lowpass', Q: 1, rolloff: -12 },
      filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.4, baseFrequency: 220, octaves: 1.6 },
      volume,
    }).connect(this.filter);
    this.triangle = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope, volume: volume - 3 }).connect(this.filter);
  }

  /** Play this MIDI note from `time` for `duration` seconds. */
  play(midi: number, time: number, duration: number, velocity = 0.8) {
    this.out.gain.cancelScheduledValues(time);
    this.out.gain.setValueAtTime(1, time);
    const frequency = Tone.Frequency(midi, 'midi').toFrequency();
    const length = Math.max(0.05, duration);
    this.saw.triggerAttackRelease(frequency, length, time, velocity);
    this.triangle.triggerAttackRelease(frequency, length, time, velocity);
  }

  /** Silence it now. */
  stop() {
    const now = Tone.now();
    this.saw.triggerRelease(now);
    this.triangle.triggerRelease(now);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.rampTo(0, 0.04);
  }

  dispose() {
    this.saw.dispose();
    this.triangle.dispose();
    this.filter.dispose();
    this.out.dispose();
  }
}
