import * as Tone from 'tone';

/**
 * A soft sustained voice for holding chords: a saw, rounded by a low-pass
 * and a light chorus, with a slow attack and a long release so one chord
 * melts into the next. The jam loop's pad uses it; so can a drone.
 * Give it a Tone node to play into (the engine's reverb or output).
 */
export class PadVoice {
  private readonly synth: Tone.PolySynth;
  private readonly filter: Tone.Filter;
  private readonly chorus: Tone.Chorus;
  private readonly out: Tone.Gain;

  constructor(destination: Tone.InputNode, options: { volumeDb?: number } = {}) {
    this.out = new Tone.Gain(1).connect(destination);
    this.chorus = new Tone.Chorus({ frequency: 0.7, delayTime: 3.5, depth: 0.4, wet: 0.5 }).connect(this.out);
    this.chorus.start();
    this.filter = new Tone.Filter(1200, 'lowpass').connect(this.chorus);
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.3, decay: 0.2, sustain: 0.85, release: 0.8 },
      volume: options.volumeDb ?? -20,
    }).connect(this.filter);
    this.synth.maxPolyphony = 16;
  }

  /** Hold these MIDI notes from `time` for `duration` seconds; they die away over the release. */
  play(midis: readonly number[], time: number, duration: number, velocity = 0.8) {
    if (midis.length === 0) return;
    this.out.gain.cancelScheduledValues(time);
    this.out.gain.setValueAtTime(1, time);
    const frequencies = midis.map(midi => Tone.Frequency(midi, 'midi').toFrequency());
    this.synth.triggerAttackRelease(frequencies, Math.max(0.1, duration), time, velocity);
  }

  /** Silence it now, with no tail and nothing left ringing. */
  stop() {
    const now = Tone.now();
    this.synth.releaseAll(now);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.rampTo(0, 0.04);
  }

  dispose() {
    this.synth.dispose();
    this.filter.dispose();
    this.chorus.dispose();
    this.out.dispose();
  }
}
