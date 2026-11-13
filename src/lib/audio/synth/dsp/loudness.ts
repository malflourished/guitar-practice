/**
 * Level meters for comparing sounds fairly: peak, RMS, and the K-weighted
 * loudness of ITU-R BS.1770 (the measure behind LUFS). All work on a finished
 * buffer of samples, so they run the same in a test and in the sound lab.
 */
import { Biquad } from './biquad';

/** A ratio as decibels; silence is -Infinity. */
export function toDb(ratio: number): number {
  return ratio > 0 ? 20 * Math.log10(ratio) : -Infinity;
}

/** Decibels as a plain gain ratio. */
export function fromDb(db: number): number {
  return 10 ** (db / 20);
}

/** The largest sample, as a plain ratio (1 is full scale). */
export function peak(samples: ArrayLike<number>, from = 0, to = samples.length): number {
  let max = 0;
  for (let i = from; i < to; i++) {
    const magnitude = Math.abs(samples[i]);
    if (magnitude > max) max = magnitude;
  }
  return max;
}

/** The root-mean-square level, as a plain ratio. */
export function rms(samples: ArrayLike<number>, from = 0, to = samples.length): number {
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

/**
 * The two filters of K-weighting for any sample rate: a shelf that lifts the
 * treble by 4 dB (the head's effect on sound arriving at the ear), then a
 * high-pass near 38 Hz (the ear's weak response to deep bass). The standard
 * gives coefficients for 48 kHz only; these are the same two analogue shapes
 * placed at the given rate, and the test checks them against the standard's
 * table.
 */
export function kWeightingFilters(sampleRate: number): [Biquad, Biquad] {
  const shelf = new Biquad();
  {
    const k = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
    const q = 0.7071752369554196;
    const vh = 10 ** (3.999843853973347 / 20);
    const vb = vh ** 0.4996667741545416;
    const a0 = 1 + k / q + k * k;
    shelf.b0 = (vh + (vb * k) / q + k * k) / a0;
    shelf.b1 = (2 * (k * k - vh)) / a0;
    shelf.b2 = (vh - (vb * k) / q + k * k) / a0;
    shelf.a1 = (2 * (k * k - 1)) / a0;
    shelf.a2 = (1 - k / q + k * k) / a0;
  }
  const highpass = new Biquad();
  {
    const k = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
    const q = 0.5003270373238773;
    const a0 = 1 + k / q + k * k;
    highpass.b0 = 1;
    highpass.b1 = -2;
    highpass.b2 = 1;
    highpass.a1 = (2 * (k * k - 1)) / a0;
    highpass.a2 = (1 - k / q + k * k) / a0;
  }
  return [shelf, highpass];
}

/**
 * K-weighted loudness of a mono buffer, in LKFS (the same unit as LUFS):
 * the mean square after K-weighting, as in BS.1770, without the gating that
 * the standard adds for programmes with long silences.
 */
export function kWeightedLoudness(samples: ArrayLike<number>, sampleRate: number): number {
  const [shelf, highpass] = kWeightingFilters(sampleRate);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const y = highpass.process(shelf.process(samples[i]));
    sum += y * y;
  }
  if (samples.length === 0 || sum === 0) return -Infinity;
  return -0.691 + 10 * Math.log10(sum / samples.length);
}
