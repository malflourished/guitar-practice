/**
 * A room for a drum kit: a mono signal in, a stereo room out.
 *
 * `SmallRoom` (room.ts) was measured against what a drum needs
 * (docs/sound/drums.md, "Why the first kits fell short"). Its echoes are
 * still separate for the first 60 ms after a stroke, so a snare gets a patter
 * behind it and not a room, and its tail rings at a few pitches. This room
 * answers both:
 *
 * - **A diffuser in front.** The stroke is split eight ways; three times
 *   over, each copy is delayed by a different amount and all eight are mixed
 *   into each other. That makes 512 echoes of the stroke inside about 40 ms,
 *   which is what the walls of a real room do in that time. They are the
 *   early reflections, different in each ear.
 * - **Longer delay lines in the tail**, fed by those echoes, so the tail's
 *   resonances are closer together than the ear can separate.
 * - **The lows are kept out**, as an engineer keeps the kick out of the room.
 *
 * It can also be **gated**: the room rings on inside, but is heard only for
 * a moment after `open` is called, then shut. That is the snare sound of the
 * early 1980s (a big, bright room cut off after a fifth of a second).
 *
 * The method is the one described by Geraint Luff ("Let's write a reverb",
 * 2021) on top of Jot's feedback delay network; the code is our own. Times
 * are in seconds, so it sounds the same at any sample rate. It goes to sleep,
 * and costs nothing, once its tail has died away.
 */

export interface DrumRoomSettings {
  /** The time the tail takes to fall by 60 dB, in seconds. */
  seconds: number;
  /** How much shorter that is for the treble (about 6 kHz), as a ratio: 0.5 is a damped room, 0.8 a bright plate. */
  treble: number;
  /** The room's size: 1 is a medium live room. It scales every delay. */
  size: number;
  /** Nothing below this goes into the room, in hertz. */
  lowCutHz: number;
  /** The early reflections' level against the tail. */
  early: number;
  /** A gated room: how long it stays open after `open`, and how fast it shuts, in seconds. */
  gate?: { holdSeconds: number; releaseSeconds: number };
}

const LINES = 8;
/** The tail's delay-line lengths in seconds at size 1: unrelated, so their echoes never line up. */
// The shortest comes back while the diffuser's echoes are still arriving, so there is no gap between the two.
const LINE_SECONDS = [0.01531, 0.02113, 0.02887, 0.03709, 0.04567, 0.05591, 0.06607, 0.07727];
/** The diffuser's three steps: the longest delay in each, in seconds at size 1. Each is twice the one before. */
const STEP_SECONDS = [0.0047, 0.0094, 0.0188];
const STEPS = STEP_SECONDS.length;
/** Each of the eight copies' delay as a share of its step's longest: spread out, and never two the same. */
const SPREAD = [
  [0.13, 0.29, 0.41, 0.52, 0.63, 0.77, 0.88, 1],
  [0.52, 0.91, 0.29, 0.66, 1, 0.41, 0.77, 0.11],
  [0.79, 0.37, 1, 0.14, 0.48, 0.9, 0.23, 0.61],
];
/** Which copies are turned upside down after each step, so the echoes do not pile up in one direction. */
const FLIPS = [
  [1, -1, 1, 1, -1, 1, -1, -1],
  [1, 1, -1, 1, -1, -1, 1, -1],
  [-1, 1, 1, -1, 1, -1, -1, 1],
];
const PRE_DELAY_SECONDS = 0.003;
const SLEEP_LEVEL = 1e-7;
/** The gate opens over this long, in seconds: fast, without a click. */
const GATE_ATTACK_SECONDS = 0.0015;

interface Delay {
  buffer: Float64Array;
  mask: number;
  length: number;
}

function delay(seconds: number, sampleRate: number, odd = false): Delay {
  let length = Math.max(1, Math.round(seconds * sampleRate));
  if (odd) length |= 1;
  let size = 8;
  while (size < length + 2) size *= 2;
  return { buffer: new Float64Array(size), mask: size - 1, length };
}

export class DrumRoom {
  /** True while the room holds sound. */
  active = false;

  private readonly sampleRate: number;
  private readonly lines: Delay[] = [];
  /** The diffuser's delays: eight for each step, one step after another. */
  private readonly spreaders: Delay[] = [];
  private readonly pre: Delay;
  private readonly earlyLevel: number;
  private readonly gains = new Float64Array(LINES);
  private readonly lowpass = new Float64Array(LINES);
  /** The eight copies as they pass through the diffuser. */
  private readonly copies = new Float64Array(LINES);
  private damping = 0;
  private lowCut = 0;
  private lowState = 0;
  private index = 0;
  private peak = 0;
  private quietChecks = 0;
  // the gate
  private readonly gated: boolean;
  private gate = 1;
  private gateHold = 0;
  private readonly gateRise: number;
  private readonly gateFall: number;
  private readonly gateHoldSamples: number;

  constructor(sampleRate: number, settings: DrumRoomSettings) {
    this.sampleRate = sampleRate;
    const size = Math.max(0.3, settings.size);
    for (let i = 0; i < LINES; i++) this.lines.push(delay(LINE_SECONDS[i] * size, sampleRate, true));
    for (let step = 0; step < STEPS; step++) {
      for (let c = 0; c < LINES; c++) this.spreaders.push(delay(STEP_SECONDS[step] * SPREAD[step][c] * size, sampleRate));
    }
    this.pre = delay(PRE_DELAY_SECONDS * size, sampleRate);
    this.earlyLevel = settings.early;
    this.lowCut = Math.exp((-2 * Math.PI * settings.lowCutHz) / sampleRate);
    this.gated = Boolean(settings.gate);
    this.gate = this.gated ? 0 : 1;
    this.gateRise = 1 - Math.exp(-1 / (GATE_ATTACK_SECONDS * sampleRate));
    this.gateFall = Math.exp(-6.907755 / (Math.max(0.005, settings.gate?.releaseSeconds ?? 0.03) * sampleRate));
    this.gateHoldSamples = Math.round((settings.gate?.holdSeconds ?? 0) * sampleRate);
    this.setDecay(settings.seconds, settings.treble);
  }

  /** The time the tail takes to fall by 60 dB, and how much shorter that is for the treble. */
  setDecay(seconds: number, trebleRatio = 0.5): void {
    const t60 = Math.max(0.05, seconds);
    for (let i = 0; i < LINES; i++) this.gains[i] = 10 ** ((-3 * this.lines[i].length) / (t60 * this.sampleRate));
    // One-pole low-pass in each line: its gain at 6 kHz makes the treble's decay `trebleRatio` of the rest.
    const middle = this.lines[LINES >> 1].length;
    const extraDb = ((-60 * middle) / this.sampleRate) * (1 / (t60 * Math.min(1, Math.max(0.1, trebleRatio))) - 1 / t60);
    const target = 10 ** (extraDb / 20);
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

  /** A gated room opens now and stays open for its hold time. `scale` stretches the hold. A room with no gate ignores this. */
  open(scale = 1): void {
    if (!this.gated) return;
    this.gateHold = Math.max(this.gateHold, Math.round(this.gateHoldSamples * scale));
  }

  /** Add the room's answer to `input[0..count)` to the two outputs, scaled by `level`. */
  process(input: Float64Array | null, left: Float64Array, right: Float64Array, count: number, level: number): void {
    if (!input && !this.active) return;
    const { lines, spreaders, pre, earlyLevel, gains, lowpass, copies, damping, lowCut, gated, gateRise, gateFall } = this;
    const scale = 1 / Math.sqrt(LINES);
    let { index, peak, lowState, gate, gateHold } = this;
    for (let n = 0; n < count; n++) {
      // Keep the lows out, and wait a moment: the room's first answer comes after the stroke itself.
      const dry = input ? input[n] : 0;
      lowState = dry + lowCut * (lowState - dry);
      if (lowState < 1e-20 && lowState > -1e-20) lowState = 0;
      const x = pre.buffer[(index - pre.length) & pre.mask];
      pre.buffer[index & pre.mask] = dry - lowState;

      // The diffuser: eight copies, three times delayed by different amounts and mixed into each other.
      for (let c = 0; c < LINES; c++) copies[c] = x;
      for (let step = 0; step < STEPS; step++) {
        const flips = FLIPS[step];
        const base = step * LINES;
        const d0 = spreaders[base], d1 = spreaders[base + 1], d2 = spreaders[base + 2], d3 = spreaders[base + 3];
        const d4 = spreaders[base + 4], d5 = spreaders[base + 5], d6 = spreaders[base + 6], d7 = spreaders[base + 7];
        d0.buffer[index & d0.mask] = copies[0];
        d1.buffer[index & d1.mask] = copies[1];
        d2.buffer[index & d2.mask] = copies[2];
        d3.buffer[index & d3.mask] = copies[3];
        d4.buffer[index & d4.mask] = copies[4];
        d5.buffer[index & d5.mask] = copies[5];
        d6.buffer[index & d6.mask] = copies[6];
        d7.buffer[index & d7.mask] = copies[7];
        const v0 = d0.buffer[(index - d0.length) & d0.mask], v1 = d1.buffer[(index - d1.length) & d1.mask];
        const v2 = d2.buffer[(index - d2.length) & d2.mask], v3 = d3.buffer[(index - d3.length) & d3.mask];
        const v4 = d4.buffer[(index - d4.length) & d4.mask], v5 = d5.buffer[(index - d5.length) & d5.mask];
        const v6 = d6.buffer[(index - d6.length) & d6.mask], v7 = d7.buffer[(index - d7.length) & d7.mask];
        const e0 = v0 + v1, e1 = v0 - v1, e2 = v2 + v3, e3 = v2 - v3, e4 = v4 + v5, e5 = v4 - v5, e6 = v6 + v7, e7 = v6 - v7;
        const f0 = e0 + e2, f1 = e1 + e3, f2 = e0 - e2, f3 = e1 - e3, f4 = e4 + e6, f5 = e5 + e7, f6 = e4 - e6, f7 = e5 - e7;
        copies[0] = (f0 + f4) * scale * flips[0];
        copies[1] = (f1 + f5) * scale * flips[1];
        copies[2] = (f2 + f6) * scale * flips[2];
        copies[3] = (f3 + f7) * scale * flips[3];
        copies[4] = (f0 - f4) * scale * flips[4];
        copies[5] = (f1 - f5) * scale * flips[5];
        copies[6] = (f2 - f6) * scale * flips[6];
        copies[7] = (f3 - f7) * scale * flips[7];
      }
      // What comes out of the diffuser is the early reflections: half of the copies to each ear.
      let outL = (copies[0] + copies[2] + copies[4] + copies[6]) * 0.5 * earlyLevel;
      let outR = (copies[1] + copies[3] + copies[5] + copies[7]) * 0.5 * earlyLevel;

      // The tail: read the eight lines, each through its loss, and share them between the ears.
      for (let i = 0; i < LINES; i++) {
        const line = lines[i];
        const r = line.buffer[(index - line.length) & line.mask];
        lowpass[i] = r + damping * (lowpass[i] - r);
      }
      outL += lowpass[0] - lowpass[2] + lowpass[4] - lowpass[6];
      outR += lowpass[1] - lowpass[3] + lowpass[5] - lowpass[7];

      // Mix every line into every other (a Hadamard transform), and feed each one its own copy from the diffuser.
      const w0 = lowpass[0] * gains[0], w1 = lowpass[1] * gains[1], w2 = lowpass[2] * gains[2], w3 = lowpass[3] * gains[3];
      const w4 = lowpass[4] * gains[4], w5 = lowpass[5] * gains[5], w6 = lowpass[6] * gains[6], w7 = lowpass[7] * gains[7];
      const a0 = w0 + w1, a1 = w0 - w1, a2 = w2 + w3, a3 = w2 - w3, a4 = w4 + w5, a5 = w4 - w5, a6 = w6 + w7, a7 = w6 - w7;
      const c0 = a0 + a2, c1 = a1 + a3, c2 = a0 - a2, c3 = a1 - a3, c4 = a4 + a6, c5 = a5 + a7, c6 = a4 - a6, c7 = a5 - a7;
      lines[0].buffer[index & lines[0].mask] = (c0 + c4) * scale + copies[0];
      lines[1].buffer[index & lines[1].mask] = (c1 + c5) * scale + copies[1];
      lines[2].buffer[index & lines[2].mask] = (c2 + c6) * scale + copies[2];
      lines[3].buffer[index & lines[3].mask] = (c3 + c7) * scale + copies[3];
      lines[4].buffer[index & lines[4].mask] = (c0 - c4) * scale + copies[4];
      lines[5].buffer[index & lines[5].mask] = (c1 - c5) * scale + copies[5];
      lines[6].buffer[index & lines[6].mask] = (c2 - c6) * scale + copies[6];
      lines[7].buffer[index & lines[7].mask] = (c3 - c7) * scale + copies[7];

      if (gated) {
        if (gateHold > 0) {
          gateHold--;
          gate += gateRise * (1 - gate);
        } else {
          gate = gate < 1e-6 ? 0 : gate * gateFall;
        }
        left[n] += outL * level * gate;
        right[n] += outR * level * gate;
      } else {
        left[n] += outL * level;
        right[n] += outR * level;
      }
      const magnitude = (outL < 0 ? -outL : outL) + (outR < 0 ? -outR : outR) + (x < 0 ? -x : x);
      if (magnitude > peak) peak = magnitude;
      index++;
    }
    this.index = index & 0x3fffffff;
    this.peak = peak;
    this.lowState = lowState;
    this.gate = gate;
    this.gateHold = gateHold;
    this.active = true;
  }

  /**
   * Housekeeping, for the caller to run now and then: go to sleep when the
   * tail has died away. `fed` says whether sound is still arriving.
   */
  settle(fed: boolean): void {
    // A gated room that has shut, with nothing arriving, will not be heard again: the next stroke starts it afresh.
    if (this.active && this.gated && !fed && this.gate === 0 && this.gateHold === 0) {
      this.sleep();
      return;
    }
    const quiet = this.peak < SLEEP_LEVEL;
    this.peak = 0;
    if (this.active && quiet && !fed) {
      this.quietChecks += 1;
      // The longest line is a tenth of a second: wait well past it before trusting the silence.
      if (this.quietChecks * 128 > 0.4 * this.sampleRate) this.sleep();
    } else {
      this.quietChecks = 0;
    }
  }

  sleep(): void {
    for (const line of [...this.lines, ...this.spreaders, this.pre]) line.buffer.fill(0);
    this.lowpass.fill(0);
    this.copies.fill(0);
    this.lowState = 0;
    this.peak = 0;
    this.quietChecks = 0;
    this.gate = this.gated ? 0 : 1;
    this.gateHold = 0;
    this.active = false;
  }

  /** Every number the room remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void {
    for (const line of [...this.lines, ...this.spreaders, this.pre]) line.buffer.forEach(visit);
    this.lowpass.forEach(visit);
    this.copies.forEach(visit);
    visit(this.lowState);
    if (this.gated) visit(this.gate);
  }
}
