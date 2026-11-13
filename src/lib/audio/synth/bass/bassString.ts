/**
 * One sounding string of the modelled bass: a single delay loop.
 *
 *   pluck pulses ─►(+)─► delay line ─► stiffness all-passes ─► loss filter ─┐
 *                   ▲                                                       │
 *                   └───────────────────────────────────────────────────────┘
 *   loop signal ─► pickup comb ─► integrate ─► pickup nonlinearity ─► out
 *
 * The loop carries the string's acceleration wave, in which an ideal pluck
 * is a single pulse (Smith, "Physical Audio Signal Processing", on the ideal
 * plucked string). A pluck is fed in as a pulse and, later, its inverted
 * reflection: together they place the pluck along the string. The pickup
 * hears the loop and a delayed, inverted copy of it, which places the pickup
 * along the string, and the sum is integrated once, because a magnetic pickup
 * senses the string's velocity.
 *
 * The voice is silent, and costs nothing, until `start`. Once the string has
 * stopped, `sleepIfStopped` zeroes its memory and switches it off again.
 */
import { gainPerRoundTrip } from '../dsp/stringFilters';
import type { Random } from '../dsp/random';
import type { NoteDesign } from './bassNote';

/** Below this level at the pickup, a string with nothing more to play is put to sleep. */
const SLEEP_LEVEL = 2e-6;
/** The leak of the integrators, in hertz: they forget anything slower than this. */
const INTEGRATOR_LEAK_HZ = 5;
/** How strongly the pickup's sensitivity follows the string's position. */
const PICKUP_NONLINEARITY = 0.12;
/** The smoothing time of the energy that drives the pitch bloom, in seconds. */
const ENERGY_SMOOTHING_SECONDS = 0.03;

export class BassStringVoice {
  /** Sounding (or about to). A sleeping voice holds only zeros. */
  active = false;
  /** The note it is playing, and the physical string that note is on. */
  noteId = -1;
  string = -1;
  /** A finger is on the string: it is dying away. */
  damped = false;
  /** A slow-falling measure of the output level, for choosing a voice to reuse. */
  level = 0;

  private readonly line: Float64Array;
  private readonly mask: number;
  private writeIndex = 0;
  private readonly excitation: Float64Array;
  private excitationLength = 0;
  private excitationIndex = 0;

  // The note's numbers (see NoteDesign).
  private frequency = 0;
  private delay = 0;
  private bloom = 0;
  private energyScale = 0;
  private allpass = 0;
  private lossPole = 0;
  private lossGain = 0;
  private dampGain = 1;
  private pickupWhole = 0;
  private pickupFraction = 0;
  private displacementRate = 0;
  private pulseSamples = 0;
  private pluckDelay = 0;

  // Filter memory.
  private a0 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private a4 = 0;
  private a5 = 0;
  private loss = 0;
  private velocity = 0;
  private displacement = 0;
  private energy1 = 0;
  private energy2 = 0;

  private readonly leak: number;
  private readonly energyRate: number;
  private readonly levelDecay: number;

  /** `maxPeriod` is the period of the lowest note it will be asked for, in samples. */
  constructor(sampleRate: number, maxPeriod: number) {
    let size = 64;
    while (size < maxPeriod + 16) size *= 2;
    this.line = new Float64Array(size);
    this.mask = size - 1;
    this.excitation = new Float64Array(Math.ceil(maxPeriod + 0.02 * sampleRate) + 16);
    this.leak = Math.exp((-2 * Math.PI * INTEGRATOR_LEAK_HZ) / sampleRate);
    this.energyRate = 1 - Math.exp(-1 / (ENERGY_SMOOTHING_SECONDS * sampleRate));
    this.levelDecay = Math.exp(-1 / (0.015 * sampleRate));
  }

  /** Pluck the string. The voice must be asleep (`active` false). */
  start(design: NoteDesign, noteId: number, random: Random): void {
    this.noteId = noteId;
    this.string = design.string;
    this.damped = false;
    this.frequency = design.frequency;
    this.delay = design.delay;
    this.bloom = design.bloomSamples * design.energyScale;
    this.energyScale = design.energyScale;
    this.allpass = design.allpass;
    this.lossPole = design.lossPole;
    this.lossGain = design.lossGain * (1 - design.lossPole);
    this.dampGain = 1;
    this.pickupWhole = Math.floor(design.pickupDelay);
    this.pickupFraction = design.pickupDelay - this.pickupWhole;
    this.displacementRate = design.displacementRate;
    this.pulseSamples = design.pulseSamples;
    this.pluckDelay = design.pluckDelay;
    // The string is at its most stretched as it is let go, so the bloom starts at its peak.
    this.energy1 = design.energyStart;
    this.energy2 = design.energyStart;

    const length = this.writePulsePair(design.amplitude, design.pulseSamples, design.pluckDelay);
    this.excitationLength = this.addNoise(design, random, length);
    this.excitationIndex = 0;
    this.level = Math.abs(design.amplitude);
    this.active = true;
  }

  /**
   * Put a finger on the string: it stops in about `seconds` (never faster than
   * a wave takes to reach the finger). `thump` is the strength of the small
   * pulse the finger makes as it lands.
   */
  damp(seconds: number, thump = 0): void {
    if (!this.active) return;
    this.damped = true;
    this.dampGain = Math.min(this.dampGain, gainPerRoundTrip(seconds, this.frequency));
    if (thump !== 0 && this.excitationIndex >= this.excitationLength) {
      this.excitationLength = this.writePulsePair(thump, this.pulseSamples * 2.5, this.pluckDelay);
      this.excitationIndex = 0;
    }
  }

  /** Add this string's sound to `out[from..to)`. */
  process(out: Float64Array, from: number, to: number): void {
    const { line, mask, excitation, leak, energyRate, levelDecay } = this;
    const { delay, bloom, allpass: a, lossPole, pickupWhole, pickupFraction, displacementRate } = this;
    const excitationLength = this.excitationLength;
    const lossGain = this.lossGain * this.dampGain;
    const maxBloom = 1.2 / this.energyScale;
    let { writeIndex, excitationIndex, a0, a1, a2, a3, a4, a5, loss, velocity, displacement, energy1, energy2, level } = this;

    for (let i = from; i < to; i++) {
      // The delay line, shortened a touch while the string is swinging widely (tension raises the pitch).
      const length = delay - bloom * (energy2 < maxBloom ? energy2 : maxBloom);
      const whole = length | 0;
      const d = length - whole;
      const base = writeIndex - whole;
      // Third-order Lagrange interpolation between the four nearest samples (see dsp/delayLine.ts).
      const dMinus1 = d - 1;
      const dMinus2 = d - 2;
      const dPlus1 = d + 1;
      let x =
        (-d * dMinus1 * dMinus2 * line[(base + 1) & mask] + dPlus1 * d * dMinus1 * line[(base - 2) & mask]) / 6 +
        (dPlus1 * dMinus1 * dMinus2 * line[base & mask] - dPlus1 * d * dMinus2 * line[(base - 1) & mask]) / 2;

      // Stiffness: six all-pass sections that let the treble run ahead.
      let y = a * x + a0;
      a0 = x - a * y;
      x = a * y + a1;
      a1 = y - a * x;
      y = a * x + a2;
      a2 = x - a * y;
      x = a * y + a3;
      a3 = y - a * x;
      y = a * x + a4;
      a4 = x - a * y;
      x = a * y + a5;
      a5 = y - a * x;

      // Loss: the treble fades fastest. A damping finger lowers the gain.
      loss = lossGain * x + lossPole * loss;

      // Back into the string, with the pluck.
      const s = excitationIndex < excitationLength ? loss + excitation[excitationIndex++] : loss;
      line[writeIndex] = s;

      // The pickup: this wave and its reflection from the bridge, as velocity.
      const tap = writeIndex - pickupWhole;
      const near = line[tap & mask];
      const reflected = near + pickupFraction * (line[(tap - 1) & mask] - near);
      writeIndex = (writeIndex + 1) & mask;
      velocity = s - reflected + leak * velocity;
      // Its sensitivity depends on where the string is, which adds even harmonics as the note gets louder.
      displacement = leak * displacement + velocity * displacementRate;
      const swing = displacement > 2 ? 2 : displacement < -2 ? -2 : displacement;
      out[i] += velocity * (1 + PICKUP_NONLINEARITY * swing);

      // The string's energy, smoothed, for the pitch bloom.
      energy1 += energyRate * (velocity * velocity - energy1);
      energy2 += energyRate * (energy1 - energy2);
      const magnitude = velocity < 0 ? -velocity : velocity;
      level = magnitude > level ? magnitude : level * levelDecay;
    }

    this.writeIndex = writeIndex;
    this.excitationIndex = excitationIndex;
    this.a0 = a0;
    this.a1 = a1;
    this.a2 = a2;
    this.a3 = a3;
    this.a4 = a4;
    this.a5 = a5;
    this.loss = loss;
    this.velocity = velocity;
    this.displacement = displacement;
    this.energy1 = energy1;
    this.energy2 = energy2;
    this.level = level;
  }

  /** Go to sleep if the string has stopped and has nothing more to play. */
  sleepIfStopped(): void {
    if (this.active && this.level < SLEEP_LEVEL && this.excitationIndex >= this.excitationLength) this.sleep();
  }

  /** Stop at once and zero the memory, so nothing is left to decay into denormal numbers. */
  sleep(): void {
    this.active = false;
    this.damped = false;
    this.noteId = -1;
    this.string = -1;
    this.level = 0;
    this.line.fill(0);
    this.excitation.fill(0, 0, this.excitationLength);
    this.excitationLength = 0;
    this.excitationIndex = 0;
    this.a0 = this.a1 = this.a2 = this.a3 = this.a4 = this.a5 = 0;
    this.loss = this.velocity = this.displacement = this.energy1 = this.energy2 = 0;
  }

  /** Every number the voice remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void {
    this.line.forEach(visit);
    this.excitation.forEach(visit);
    [this.a0, this.a1, this.a2, this.a3, this.a4, this.a5, this.loss, this.velocity, this.displacement,
      this.energy1, this.energy2, this.level].forEach(visit);
  }

  /**
   * Write a pluck into the excitation buffer: a raised-cosine pulse of area
   * `amplitude`, then its inverse `delay` samples later. The two have exactly
   * equal areas, so the loop is never left with an offset. Returns the length used.
   */
  private writePulsePair(amplitude: number, width: number, delay: number): number {
    const excitation = this.excitation;
    const length = Math.min(excitation.length, Math.ceil(delay + width) + 2);
    excitation.fill(0, 0, Math.max(length, this.excitationLength));
    for (const [offset, sign] of [[0, 1], [delay, -1]] as const) {
      const first = Math.floor(offset);
      const last = Math.min(length - 1, Math.ceil(offset + width));
      let sum = 0;
      for (let k = first; k <= last; k++) sum += pulseShape((k - offset + 0.5) / width);
      if (sum <= 0) continue;
      const scale = (sign * amplitude) / sum;
      for (let k = first; k <= last; k++) excitation[k] += scale * pulseShape((k - offset + 0.5) / width);
    }
    return length;
  }

  /**
   * Add the finger's noise to the pluck: a short burst of low-passed noise
   * under a raised-cosine envelope, differenced so it sums to exactly zero,
   * and its inverse after the pluck delay. Returns the excitation length.
   */
  private addNoise(design: NoteDesign, random: Random, length: number): number {
    const excitation = this.excitation;
    const burst = Math.max(8, Math.round(design.pulseSamples * 3));
    const second = Math.round(design.pluckDelay);
    const total = Math.min(excitation.length, Math.max(length, second + burst + 2));
    const scale = design.amplitude * design.noiseLevel;
    if (scale === 0) return length;
    let smooth = 0;
    let previous = 0;
    for (let k = 0; k <= burst; k++) {
      smooth = (1 - design.noisePole) * random.bipolar() + design.noisePole * smooth;
      const shaped = k === burst ? 0 : smooth * pulseShape((k + 0.5) / burst);
      const value = scale * (shaped - previous);
      previous = shaped;
      if (k < total) excitation[k] += value;
      if (second + k < total) excitation[second + k] -= value;
    }
    return total;
  }
}

/** A raised cosine over 0..1, zero outside: the shape of a pluck's release. */
function pulseShape(x: number): number {
  return x > 0 && x < 1 ? 1 - Math.cos(2 * Math.PI * x) : 0;
}
