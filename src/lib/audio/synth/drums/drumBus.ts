/**
 * The drum bus of the S2.1 kits: what an engineer calls "glue".
 *
 * The first kits measured about 19 dB from their peaks to their average
 * level: all tick and no body, which is how close microphones sound before
 * anything is done to them (docs/sound/drums.md). A mixed kit is nearer 12
 * to 14 dB. This is the usual way there:
 *
 * - **A compressor across the whole kit**, room included, that is slow to
 *   react (about a hundredth of a second), so the first instant of a stroke
 *   passes and its body, the room and the cymbals behind it are levelled.
 *   Between strokes it lets go, and the room and the tails come up: the kit
 *   breathes as one thing. It listens with the lows turned down, so the kick
 *   does not duck everything else. Some of the kit goes round it untouched
 *   (parallel compression), which keeps the strokes sharp.
 * - **A soft clipper after it** that rounds the instants the compressor let
 *   through. It costs a little of the stroke's very top and gives back
 *   several decibels of headroom in the jam's mix.
 *
 * The kit's 30 Hz high-pass is here too, in front of everything. Measured on
 * the first kits, the same filter placed after the clipper put back 3 to 4 dB
 * of the peak the clipper had taken off: it shifts a kick's harmonics against
 * its fundamental, and the flattened top grows a corner. A kit with this bus
 * has no filter after it.
 */
import { Biquad } from '../dsp/biquad';

export interface GlueSettings {
  /** The level above which the compressor works, as an amplitude (0.2 is about -14 dB). */
  threshold: number;
  /** How long it takes to react and to let go, in seconds. */
  attackSeconds: number;
  releaseSeconds: number;
  /** The share of the kit that goes through the compressor, 0 to 1. The rest goes round it. */
  mix: number;
  /** Gain after the compressor. */
  makeup: number;
  /** The compressor listens with everything below this turned down, in hertz. */
  sidechainHz: number;
  /** The clipper: untouched up to `knee`, bending smoothly above it, never past `ceiling`. */
  knee: number;
  ceiling: number;
}

/** Nothing below this is of use from a drum kit, and small speakers only suffer from it. */
const HIGHPASS_HZ = 30;

export class GlueBus {
  private readonly threshold: number;
  private readonly attack: number;
  private readonly release: number;
  private readonly mix: number;
  private readonly makeup: number;
  private readonly sidechain: number;
  private readonly knee: number;
  private readonly bend: number;
  private readonly highpassLeft = new Biquad();
  private readonly highpassRight = new Biquad();
  private envelope = 0;
  private lowLeft = 0;
  private lowRight = 0;
  /** The most the compressor has turned the kit down since `takeReduction`, as a gain (1 is none). */
  private deepest = 1;

  constructor(sampleRate: number, settings: GlueSettings) {
    this.threshold = settings.threshold;
    this.attack = 1 - Math.exp(-1 / (Math.max(0.0005, settings.attackSeconds) * sampleRate));
    this.release = 1 - Math.exp(-1 / (Math.max(0.005, settings.releaseSeconds) * sampleRate));
    this.mix = settings.mix;
    this.makeup = settings.makeup;
    this.sidechain = Math.exp((-2 * Math.PI * settings.sidechainHz) / sampleRate);
    this.knee = settings.knee;
    this.bend = Math.max(1e-6, settings.ceiling - settings.knee);
    this.highpassLeft.setHighpass(HIGHPASS_HZ, 0.707, sampleRate);
    this.highpassRight.setHighpass(HIGHPASS_HZ, 0.707, sampleRate);
  }

  /** Process `left[0..count)` and `right[0..count)` in place. */
  process(left: Float64Array, right: Float64Array, count: number): void {
    const { threshold, attack, release, mix, makeup, sidechain, knee, bend, highpassLeft, highpassRight } = this;
    let { envelope, lowLeft, lowRight, deepest } = this;
    for (let i = 0; i < count; i++) {
      const l = highpassLeft.process(left[i]);
      const r = highpassRight.process(right[i]);
      // Listen with the lows turned down, to the louder ear.
      lowLeft = l + sidechain * (lowLeft - l);
      lowRight = r + sidechain * (lowRight - r);
      const heardLeft = l - lowLeft;
      const heardRight = r - lowRight;
      const heard = Math.max(heardLeft < 0 ? -heardLeft : heardLeft, heardRight < 0 ? -heardRight : heardRight);
      envelope += (heard - envelope) * (heard > envelope ? attack : release);
      // Four to one above the threshold: the gain is the overshoot to the power of minus three quarters.
      let gain = 1;
      if (envelope > threshold) {
        const root = Math.sqrt(envelope / threshold);
        gain = 1 / (root * Math.sqrt(root));
        if (gain < deepest) deepest = gain;
      }
      const applied = (1 - mix + mix * gain) * makeup;
      let outLeft = l * applied;
      let outRight = r * applied;
      // Round what is left of the peaks.
      const sizeLeft = outLeft < 0 ? -outLeft : outLeft;
      if (sizeLeft > knee) {
        const bent = knee + bend * Math.tanh((sizeLeft - knee) / bend);
        outLeft = outLeft < 0 ? -bent : bent;
      }
      const sizeRight = outRight < 0 ? -outRight : outRight;
      if (sizeRight > knee) {
        const bent = knee + bend * Math.tanh((sizeRight - knee) / bend);
        outRight = outRight < 0 ? -bent : bent;
      }
      left[i] = outLeft;
      right[i] = outRight;
    }
    this.envelope = envelope;
    this.lowLeft = lowLeft;
    this.lowRight = lowRight;
    this.deepest = deepest;
  }

  /** The deepest gain reduction since the last call, in decibels (0 is none), for measuring. */
  takeReduction(): number {
    const db = -20 * Math.log10(this.deepest);
    this.deepest = 1;
    return db;
  }

  /** Forget everything: the kit has gone quiet. */
  reset(): void {
    this.envelope = 0;
    this.lowLeft = 0;
    this.lowRight = 0;
    this.highpassLeft.reset();
    this.highpassRight.reset();
  }

  forEachState(visit: (value: number) => void): void {
    visit(this.envelope);
    visit(this.lowLeft);
    visit(this.lowRight);
    this.highpassLeft.state().forEach(visit);
    this.highpassRight.state().forEach(visit);
  }
}
