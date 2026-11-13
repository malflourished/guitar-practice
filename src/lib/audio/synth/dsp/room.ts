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
/** How the eight lines are shared between the two ears, with alternating signs to keep the sides different. */
const LEFT_SIGNS = [1, 0, -1, 0, 1, 0, -1, 0];
const RIGHT_SIGNS = [0, 1, 0, -1, 0, 1, 0, -1];
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
  private readonly work = new Float64Array(LINES);
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
    const { buffers, masks, lengths, gains, lowpass, work, damping, pre, preMask, preLength, diffusers } = this;
    const scale = 1 / Math.sqrt(LINES);
    let index = this.index;
    let peak = this.peak;
    for (let n = 0; n < count; n++) {
      // Pre-delay, then the two all-pass diffusers.
      let x = pre[(index - preLength) & preMask];
      pre[index & preMask] = input ? input[n] : 0;
      for (let k = 0; k < diffusers.length; k++) {
        const diffuser = diffusers[k];
        const delayed = diffuser.buffer[(index - diffuser.length) & diffuser.mask];
        const feed = x + DIFFUSER_GAIN * delayed;
        diffuser.buffer[index & diffuser.mask] = feed;
        x = delayed - DIFFUSER_GAIN * feed;
      }

      // Read the eight lines, with their losses.
      let outL = 0;
      let outR = 0;
      for (let i = 0; i < LINES; i++) {
        const read = buffers[i][(index - lengths[i]) & masks[i]];
        const filtered = (1 - damping) * read + damping * lowpass[i];
        lowpass[i] = filtered;
        work[i] = filtered * gains[i];
        outL += LEFT_SIGNS[i] * filtered;
        outR += RIGHT_SIGNS[i] * filtered;
      }

      // Mix every line into every other (a fast Hadamard transform), and feed the input to all.
      for (let span = 1; span < LINES; span *= 2) {
        for (let i = 0; i < LINES; i += span * 2) {
          for (let j = i; j < i + span; j++) {
            const a = work[j];
            const b = work[j + span];
            work[j] = a + b;
            work[j + span] = a - b;
          }
        }
      }
      for (let i = 0; i < LINES; i++) buffers[i][index & masks[i]] = work[i] * scale + x;

      left[n] += outL * level;
      right[n] += outR * level;
      const magnitude = (outL < 0 ? -outL : outL) + (outR < 0 ? -outR : outR);
      if (magnitude > peak) peak = magnitude;
      index++;
    }
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
    this.work.fill(0);
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
