/**
 * A small room for an instrument that needs one of its own: a mono signal
 * in, a stereo reverberation out.
 *
 * A feedback delay network (Jot's design; see Välimäki et al., "Fifty years
 * of artificial reverberation", 2012): eight delay lines of unrelated
 * lengths, mixed into each other through a Hadamard matrix so that every
 * echo spreads into all the lines, each with a loss that sets the decay time
 * and takes the treble first, as air and walls do. Two short all-pass filters
 * in front smear a drum's sharp start so the first echoes do not rattle.
 *
 * Times are in seconds, so the room sounds the same at any sample rate. It
 * goes to sleep, and costs nothing, once its tail has died away.
 */

/** Delay-line lengths in seconds: unrelated, so their echoes never line up. */
const LINE_SECONDS = [0.01427, 0.01789, 0.02113, 0.02467, 0.02833, 0.03191, 0.03607, 0.04027];
const DIFFUSER_SECONDS = [0.00311, 0.00127];
const DIFFUSER_GAIN = 0.55;
const PRE_DELAY_SECONDS = 0.007;
const LINES = 8;
const SLEEP_LEVEL = 1e-7;

export class SmallRoom {
  /** True while the room holds sound. */
  active = false;

  private readonly sampleRate: number;
  private readonly buffers: Float64Array[] = [];
  private readonly masks: number[] = [];
  private readonly lengths: number[] = [];
  private readonly gains = new Float64Array(LINES);
  private readonly lowpass = new Float64Array(LINES);
  private damping = 0;
  private index = 0;
  private readonly pre: Float64Array;
  private readonly preMask: number;
  private readonly preLength: number;
  private readonly diffusers: { buffer: Float64Array; mask: number; length: number }[] = [];
  private peak = 0;

  constructor(sampleRate: number, decaySeconds = 0.45, trebleRatio = 0.45) {
    this.sampleRate = sampleRate;
    for (let i = 0; i < LINES; i++) {
      // an odd number of samples, different for every line
      const length = Math.max(8, Math.round(LINE_SECONDS[i] * sampleRate) | 1);
      const size = powerOfTwoAbove(length + 2);
      this.buffers.push(new Float64Array(size));
      this.masks.push(size - 1);
      this.lengths.push(length);
    }
    this.preLength = Math.max(1, Math.round(PRE_DELAY_SECONDS * sampleRate));
    const preSize = powerOfTwoAbove(this.preLength + 2);
    this.pre = new Float64Array(preSize);
    this.preMask = preSize - 1;
    for (const seconds of DIFFUSER_SECONDS) {
      const length = Math.max(1, Math.round(seconds * sampleRate));
      const size = powerOfTwoAbove(length + 2);
      this.diffusers.push({ buffer: new Float64Array(size), mask: size - 1, length });
    }
    this.setDecay(decaySeconds, trebleRatio);
  }

  /**
   * The time the room takes to fall by 60 dB, and how much shorter that is
   * for the treble (at about 6 kHz) as a ratio: 0.45 is a damped studio room.
   */
  setDecay(seconds: number, trebleRatio = 0.45): void {
    const t60 = Math.max(0.05, seconds);
    for (let i = 0; i < LINES; i++) {
      this.gains[i] = 10 ** ((-3 * this.lengths[i]) / (t60 * this.sampleRate));
    }
    // One-pole low-pass in each line: its gain at 6 kHz makes the treble's decay `trebleRatio` of the rest.
    // For a middle line, the extra loss per trip at 6 kHz is the difference between the two decay rates.
    const middle = this.lengths[LINES >> 1];
    const extraDb = ((-60 * middle) / this.sampleRate) * (1 / (t60 * Math.min(1, Math.max(0.1, trebleRatio))) - 1 / t60);
    const target = 10 ** (extraDb / 20); // gain wanted at 6 kHz, under 1
    // |H(w)|² of y = (1-d)x + d·y is (1-d)² / (1 - 2d·cos w + d²): solve for d by bisection.
    const cosine = Math.cos((2 * Math.PI * Math.min(6000, this.sampleRate * 0.4)) / this.sampleRate);
    let low = 0;
    let high = 0.999;
    for (let step = 0; step < 40; step++) {
      const d = (low + high) / 2;
      const gain = (1 - d) / Math.sqrt(1 - 2 * d * cosine + d * d);
      if (gain > target) low = d;
      else high = d;
    }
    this.damping = (low + high) / 2;
  }

  /** Add the room's answer to `input[0..count)` to the two outputs, scaled by `level`. */
  process(input: Float64Array | null, left: Float64Array, right: Float64Array, count: number, level: number): void {
    if (!input && !this.active) return;
    // Written out line by line, not as loops over the eight lines: this runs for every sample the kit makes.
    const { buffers, masks, lengths, gains, lowpass, damping: d, pre, preMask, preLength, diffusers } = this;
    const [b0, b1, b2, b3, b4, b5, b6, b7] = buffers;
    const [m0, m1, m2, m3, m4, m5, m6, m7] = masks;
    const [n0, n1, n2, n3, n4, n5, n6, n7] = lengths;
    const g0 = gains[0], g1 = gains[1], g2 = gains[2], g3 = gains[3], g4 = gains[4], g5 = gains[5], g6 = gains[6], g7 = gains[7];
    let p0 = lowpass[0], p1 = lowpass[1], p2 = lowpass[2], p3 = lowpass[3], p4 = lowpass[4], p5 = lowpass[5], p6 = lowpass[6], p7 = lowpass[7];
    const first = diffusers[0];
    const second = diffusers[1];
    const scale = 1 / Math.sqrt(LINES);
    let index = this.index;
    let peak = this.peak;
    for (let n = 0; n < count; n++) {
      // Pre-delay, then the two all-pass diffusers.
      let x = pre[(index - preLength) & preMask];
      pre[index & preMask] = input ? input[n] : 0;
      let delayed = first.buffer[(index - first.length) & first.mask];
      let feed = x + DIFFUSER_GAIN * delayed;
      first.buffer[index & first.mask] = feed;
      x = delayed - DIFFUSER_GAIN * feed;
      delayed = second.buffer[(index - second.length) & second.mask];
      feed = x + DIFFUSER_GAIN * delayed;
      second.buffer[index & second.mask] = feed;
      x = delayed - DIFFUSER_GAIN * feed;

      // Read the eight lines, each through its loss: a one-pole low-pass that takes the treble first.
      let r = b0[(index - n0) & m0];
      p0 = r + d * (p0 - r);
      r = b1[(index - n1) & m1];
      p1 = r + d * (p1 - r);
      r = b2[(index - n2) & m2];
      p2 = r + d * (p2 - r);
      r = b3[(index - n3) & m3];
      p3 = r + d * (p3 - r);
      r = b4[(index - n4) & m4];
      p4 = r + d * (p4 - r);
      r = b5[(index - n5) & m5];
      p5 = r + d * (p5 - r);
      r = b6[(index - n6) & m6];
      p6 = r + d * (p6 - r);
      r = b7[(index - n7) & m7];
      p7 = r + d * (p7 - r);
      // The lines are shared between the two ears with alternating signs, to keep the sides different.
      const outL = p0 - p2 + p4 - p6;
      const outR = p1 - p3 + p5 - p7;

      // Mix every line into every other (a Hadamard transform, in three rounds of sums and differences).
      const w0 = p0 * g0, w1 = p1 * g1, w2 = p2 * g2, w3 = p3 * g3, w4 = p4 * g4, w5 = p5 * g5, w6 = p6 * g6, w7 = p7 * g7;
      const a0 = w0 + w1, a1 = w0 - w1, a2 = w2 + w3, a3 = w2 - w3, a4 = w4 + w5, a5 = w4 - w5, a6 = w6 + w7, a7 = w6 - w7;
      const c0 = a0 + a2, c1 = a1 + a3, c2 = a0 - a2, c3 = a1 - a3, c4 = a4 + a6, c5 = a5 + a7, c6 = a4 - a6, c7 = a5 - a7;
      // ...and feed the input to all of them.
      b0[index & m0] = (c0 + c4) * scale + x;
      b1[index & m1] = (c1 + c5) * scale + x;
      b2[index & m2] = (c2 + c6) * scale + x;
      b3[index & m3] = (c3 + c7) * scale + x;
      b4[index & m4] = (c0 - c4) * scale + x;
      b5[index & m5] = (c1 - c5) * scale + x;
      b6[index & m6] = (c2 - c6) * scale + x;
      b7[index & m7] = (c3 - c7) * scale + x;

      left[n] += outL * level;
      right[n] += outR * level;
      const magnitude = (outL < 0 ? -outL : outL) + (outR < 0 ? -outR : outR);
      if (magnitude > peak) peak = magnitude;
      index++;
    }
    lowpass[0] = p0;
    lowpass[1] = p1;
    lowpass[2] = p2;
    lowpass[3] = p3;
    lowpass[4] = p4;
    lowpass[5] = p5;
    lowpass[6] = p6;
    lowpass[7] = p7;
    this.index = index & 0x3fffffff;
    this.peak = peak;
    this.active = true;
  }

  /**
   * Housekeeping, for the caller to run now and then: go to sleep when the
   * tail has died away. `fed` says whether sound is still arriving.
   */
  settle(fed: boolean): void {
    const quiet = this.peak < SLEEP_LEVEL;
    this.peak = 0;
    if (this.active && quiet && !fed) {
      this.quietChecks += 1;
      // The longest line is 40 ms: wait well past it before trusting the silence.
      if (this.quietChecks * 128 > 0.25 * this.sampleRate) this.sleep();
    } else {
      this.quietChecks = 0;
    }
  }
  private quietChecks = 0;

  sleep(): void {
    for (const buffer of this.buffers) buffer.fill(0);
    for (const diffuser of this.diffusers) diffuser.buffer.fill(0);
    this.pre.fill(0);
    this.lowpass.fill(0);
    this.peak = 0;
    this.quietChecks = 0;
    this.active = false;
  }

  /** Every number the room remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void {
    for (const buffer of this.buffers) buffer.forEach(visit);
    for (const diffuser of this.diffusers) diffuser.buffer.forEach(visit);
    this.pre.forEach(visit);
    this.lowpass.forEach(visit);
  }
}

function powerOfTwoAbove(length: number): number {
  let size = 8;
  while (size < length) size *= 2;
  return size;
}
