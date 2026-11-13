/**
 * The acoustic kit's metal: hi-hats, ride and crash.
 *
 * A cymbal has over a thousand modes that feed energy to each other, which
 * no cheap method reproduces (docs/sound/drums.md). This is "tones plus
 * noise", with two ideas that keep it from sounding like either:
 *
 * - Each cymbal is one object. A bank of a few dozen modes keeps ringing,
 *   and every stroke adds to it. A ride pattern builds a wash, as on metal,
 *   and the hi-hat's foot is the bank's damping: closing it chokes the ring.
 * - After a stroke, noise keeps exciting the bank, rising late for a crash
 *   and dying over seconds. Every mode filters it into a narrow, fluttering
 *   band, which stands for the energy that the other thousand modes of a
 *   real cymbal would be passing in. Above the modes, plain filtered noise
 *   fills the top of the spectrum, where the ear hears only a band's level.
 */
import { Biquad } from '../dsp/biquad';
import { ModalBank, plateModeFrequencies, type ModeSpec } from '../dsp/modalBank';
import type { Random } from '../dsp/random';
import { VOICE_SLEEP_LEVEL, type DrumVoice, type StrokeVariation } from './membranes';

/** The longest stretch a voice is asked to render at once: the synth's housekeeping grid. */
const MAX_CHUNK = 128;
/** The noisy part of a stroke lasts this long, in seconds: the stick's bounce on the metal. */
const STRIKE_NOISE_SECONDS = 0.0015;
/** An envelope below this is treated as finished. */
const ENVELOPE_FLOOR = 1e-7;

/** One cymbal's fixed facts. */
export interface PlateDesign {
  /** Picks the set of mode frequencies: a different cymbal for each seed. */
  seed: number;
  modes: number;
  lowHz: number;
  highHz: number;
  /** How long a mode at 1 kHz rings by itself, in seconds: longer is purer, shorter is noisier. */
  ringSeconds: number;
  /** How that falls with frequency: the ring time goes as (f / 1 kHz) to minus this power. */
  ringSlope: number;
  /** Extra short-lived partials for a ride's "ping". */
  ping?: { count: number; lowHz: number; highHz: number; seconds: number; level: number };
  /** Where the noise above the modes starts, in hertz. */
  airHz: number;
}

/** One stroke, as the cymbal sees it. */
export interface PlateStroke {
  /** The pulse the stick delivers: its strength and how long it stays on the metal, in seconds. */
  level: number;
  pulseSeconds: number;
  /** The share of the stroke that is random, 0 to 1: what makes two strokes differ. */
  noise: number;
  /** The stick's own tick, heard directly. */
  click: number;
  /** The wash: how much noise goes on feeding the modes, how fast it arrives and how long it lasts (60 dB), in seconds. */
  cascade: number;
  cascadeRise: number;
  cascadeSeconds: number;
  /** The share of the wash that is there at once, 0 to 1; the rest blooms. */
  cascadeInstant: number;
  /** The noise above the modes, with its own rise and length. */
  air: number;
  airRise: number;
  airSeconds: number;
}

/** A mode's gain against frequency: `tilt` above 0 leans towards the treble. */
function tiltGain(hz: number, tilt: number): number {
  return (hz / 1000) ** tilt;
}

export class PlateCymbal implements DrumVoice {
  active = false;
  private readonly sampleRate: number;
  private readonly design: PlateDesign;
  private readonly random: Random;
  private readonly bank: ModalBank;
  private readonly frequencies: number[];
  private readonly pingFrequencies: number[];
  private readonly strikeBuffer = new Float64Array(MAX_CHUNK);
  private readonly cascadeBuffer = new Float64Array(MAX_CHUNK);
  private readonly clickFilter = new Biquad();
  private readonly airFilter = new Biquad();
  // the stroke being delivered
  private pulseIndex = 0;
  private pulseLength = 0;
  private pulseScale = 0;
  private noiseLength = 0;
  private noiseScale = 0;
  private clickLevel = 0;
  // the wash and the air: each the difference of a slow and a fast fade, so it can bloom
  private cascadeSlow = 0;
  private cascadeFast = 0;
  private cascadeSlowStep = 0;
  private cascadeFastStep = 0;
  private airSlow = 0;
  private airFast = 0;
  private airSlowStep = 0;
  private airFastStep = 0;
  private tone = 0.5;
  private ringScale = 1;

  constructor(sampleRate: number, design: PlateDesign, random: Random) {
    this.sampleRate = sampleRate;
    this.design = design;
    this.random = random;
    this.frequencies = plateModeFrequencies(design.modes, design.lowHz, design.highHz, design.seed);
    this.pingFrequencies = design.ping
      ? plateModeFrequencies(design.ping.count, design.ping.lowHz, design.ping.highHz, design.seed * 7 + 3, 0.3)
      : [];
    this.bank = new ModalBank(sampleRate, this.modeSpecs());
    this.clickFilter.setHighpass(2200, 0.707, sampleRate);
    this.airFilter.setHighpass(design.airHz, 0.707, sampleRate);
  }

  /** Brightness, 0 to 1, and how long the modes ring as a multiple of the design's. Safe while sounding. */
  voice(tone: number, ringScale = 1): void {
    if (tone === this.tone && ringScale === this.ringScale) return;
    this.tone = tone;
    this.ringScale = ringScale;
    this.bank.retune(this.modeSpecs());
  }

  /** Put a hand or a foot on the metal: every mode's ring time is multiplied by `scale` (1 lets go). */
  damp(scale: number): void {
    this.bank.setDamping(scale);
  }

  strike(stroke: PlateStroke): void {
    const { sampleRate } = this;
    this.pulseIndex = 0;
    this.pulseLength = Math.max(2, Math.round(stroke.pulseSeconds * sampleRate));
    this.noiseLength = Math.max(2, Math.round(STRIKE_NOISE_SECONDS * sampleRate));
    this.pulseScale = (stroke.level * (1 - stroke.noise)) / this.pulseLength;
    // sized so the burst puts as much into a mode, on average, as the pulse it replaces
    this.noiseScale = stroke.level * stroke.noise * Math.sqrt(2 / this.noiseLength);
    this.clickLevel = stroke.click;

    const step = (seconds: number) => Math.exp(-6.907755 / (Math.max(0.002, seconds) * sampleRate));
    const rise = (seconds: number) => Math.exp(-1 / (Math.max(0.0002, seconds) * sampleRate));
    this.cascadeSlow += stroke.cascade;
    this.cascadeFast += stroke.cascade * (1 - stroke.cascadeInstant);
    this.cascadeSlowStep = step(stroke.cascadeSeconds);
    this.cascadeFastStep = rise(stroke.cascadeRise);
    this.airSlow += stroke.air;
    this.airFast += stroke.air;
    this.airSlowStep = step(stroke.airSeconds);
    this.airFastStep = rise(stroke.airRise);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    const { random, strikeBuffer, cascadeBuffer } = this;

    // The stroke: a smooth pulse, and a burst of noise that makes each one its own.
    let striking = false;
    if (this.pulseIndex < Math.max(this.pulseLength, this.noiseLength)) {
      striking = true;
      const { pulseLength, noiseLength, pulseScale, noiseScale, clickLevel, clickFilter } = this;
      let k = this.pulseIndex;
      for (let i = 0; i < count; i++, k++) {
        let sample = 0;
        if (k < pulseLength) sample += pulseScale * (1 - Math.cos((2 * Math.PI * (k + 0.5)) / pulseLength));
        if (k < noiseLength) sample += noiseScale * random.bipolar() * (1 - Math.cos((2 * Math.PI * (k + 0.5)) / noiseLength));
        strikeBuffer[i] = sample;
        out[i] += clickLevel * clickFilter.process(sample);
      }
      this.pulseIndex = k;
    } else if (this.clickFilter.magnitude() > VOICE_SLEEP_LEVEL) {
      // let the tick's filter ring out
      for (let i = 0; i < count; i++) out[i] += this.clickLevel * this.clickFilter.process(0);
    }

    // The wash: noise into the modes, under an envelope that can bloom.
    let washing = false;
    if (this.cascadeSlow > ENVELOPE_FLOOR) {
      washing = true;
      const { cascadeSlowStep, cascadeFastStep } = this;
      let { cascadeSlow, cascadeFast } = this;
      for (let i = 0; i < count; i++) {
        cascadeBuffer[i] = (cascadeSlow - cascadeFast) * random.bipolar();
        cascadeSlow *= cascadeSlowStep;
        cascadeFast *= cascadeFastStep;
      }
      this.cascadeSlow = cascadeSlow;
      this.cascadeFast = cascadeFast < ENVELOPE_FLOOR ? 0 : cascadeFast;
    } else {
      this.cascadeSlow = 0;
      this.cascadeFast = 0;
    }

    this.bank.process(out, striking ? strikeBuffer : null, washing ? cascadeBuffer : null, count);

    // The air above the modes.
    if (this.airSlow > ENVELOPE_FLOOR) {
      const { airFilter, airSlowStep, airFastStep } = this;
      let { airSlow, airFast } = this;
      for (let i = 0; i < count; i++) {
        out[i] += airFilter.process((airSlow - airFast) * random.bipolar());
        airSlow *= airSlowStep;
        airFast *= airFastStep;
      }
      this.airSlow = airSlow;
      this.airFast = airFast < ENVELOPE_FLOOR ? 0 : airFast;
    } else if (this.airSlow !== 0 || this.airFilter.magnitude() > VOICE_SLEEP_LEVEL) {
      this.airSlow = 0;
      this.airFast = 0;
      for (let i = 0; i < count; i++) out[i] += this.airFilter.process(0);
    }
  }

  settle(): void {
    if (!this.active) return;
    const ringing = this.bank.settle();
    const stroke = this.pulseIndex < Math.max(this.pulseLength, this.noiseLength);
    const filters = this.clickFilter.magnitude() + this.airFilter.magnitude();
    if (ringing < VOICE_SLEEP_LEVEL && !stroke && this.cascadeSlow === 0 && this.airSlow === 0 && filters < VOICE_SLEEP_LEVEL) {
      this.sleep();
    }
  }

  sleep(): void {
    this.bank.sleep();
    this.clickFilter.reset();
    this.airFilter.reset();
    this.pulseIndex = 0;
    this.pulseLength = 0;
    this.noiseLength = 0;
    this.cascadeSlow = this.cascadeFast = this.airSlow = this.airFast = 0;
    this.strikeBuffer.fill(0);
    this.cascadeBuffer.fill(0);
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.bank.forEachState(visit);
    this.clickFilter.state().forEach(visit);
    this.airFilter.state().forEach(visit);
    [this.cascadeSlow, this.cascadeFast, this.airSlow, this.airFast].forEach(visit);
  }

  /** The bank's modes for the tone and ring now set. */
  private modeSpecs(): ModeSpec[] {
    const { design, tone, ringScale } = this;
    // Tone leans the whole cymbal: a dark one favours its low modes, a bright one its high modes.
    const tilt = -0.25 + 0.9 * tone;
    // so that the wash is as loud whatever the tilt: divide by the root of the sum of squares
    let power = 0;
    for (const hz of this.frequencies) power += tiltGain(hz, tilt) ** 2;
    const norm = 1 / Math.sqrt(power);
    const specs: ModeSpec[] = this.frequencies.map((hz) => ({
      hz,
      t60: design.ringSeconds * ringScale * (hz / 1000) ** -design.ringSlope,
      strike: tiltGain(hz, tilt) * norm,
      cascade: tiltGain(hz, tilt) * norm,
    }));
    if (design.ping) {
      const { seconds, level } = design.ping;
      for (const hz of this.pingFrequencies) {
        specs.push({ hz, t60: seconds * (hz / 4000) ** -0.5, strike: level / Math.sqrt(this.pingFrequencies.length), cascade: 0 });
      }
    }
    return specs;
  }
}

/* --------------------------------------------------------------- designs */

/** 14-inch hi-hats: the brightest and shortest metal in the kit. */
export const HAT_DESIGN: PlateDesign = {
  seed: 0x51f15e,
  modes: 30,
  lowHz: 420,
  highHz: 9800,
  ringSeconds: 0.5,
  ringSlope: 0.4,
  airHz: 7000,
};

/** A 20-inch ride: a clear ping over a long, quiet wash. */
export const RIDE_DESIGN: PlateDesign = {
  seed: 0x7a11ce,
  modes: 38,
  lowHz: 330,
  highHz: 7600,
  ringSeconds: 0.9,
  ringSlope: 0.6,
  ping: { count: 7, lowHz: 2700, highHz: 7400, seconds: 0.4, level: 1 },
  airHz: 6000,
};

/** A 16-inch crash: all wash and bloom. */
export const CRASH_DESIGN: PlateDesign = {
  seed: 0xc4a54,
  modes: 42,
  lowHz: 240,
  highHz: 8200,
  ringSeconds: 0.55,
  ringSlope: 0.6,
  airHz: 5200,
};

/** How loud a stroke on metal is for its velocity. */
function metalStrength(velocity: number): number {
  return Math.min(1, Math.max(0, velocity)) ** 1.5;
}

/**
 * The hi-hats: one pair of cymbals and a foot. A closed stroke, an open
 * stroke and the foot alone all play the same metal; what differs is how
 * hard the two cymbals are pressed together when the sound starts.
 */
export class HiHat implements DrumVoice {
  private readonly plate: PlateCymbal;
  private tone = 0.5;
  private length = 0.5;

  constructor(sampleRate: number, random: Random) {
    this.plate = new PlateCymbal(sampleRate, HAT_DESIGN, random);
  }

  get active(): boolean {
    return this.plate.active;
  }

  /** `tone` is brightness and `length` how loose the hats are, both 0 to 1. */
  configure(tone: number, length: number): void {
    this.tone = tone;
    this.length = length;
    this.plate.voice(tone);
  }

  /** The stick on closed hats: a tick. A harder stroke is the shoulder of the stick on the edge: fuller and longer. */
  closed(velocity: number, variation: StrokeVariation, variationAmount: number): void {
    const level = metalStrength(velocity) * (1 + 0.06 * variation.level);
    const hard = Math.min(1, velocity * (1 + 0.15 * variation.hardness));
    const tight = 0.5 + this.length; // 0.5 to 1.5
    this.plate.damp(0.11 * tight);
    this.plate.strike({
      level: level * 0.75,
      pulseSeconds: 0.00012 + 0.00018 * (1 - hard),
      noise: 0.25 + 0.5 * variationAmount,
      click: level * 0.45,
      cascade: level * 0.55 * (0.6 + 0.4 * hard),
      cascadeRise: 0.0006,
      cascadeSeconds: 0.05 * tight * (0.8 + 0.5 * hard),
      cascadeInstant: 0.6,
      air: level * (0.25 + 0.5 * this.tone) * hard,
      airRise: 0.0004,
      airSeconds: 0.04 * tight,
    });
  }

  /** The stick on open hats: they ring and sizzle until the foot closes them. */
  open(velocity: number, variation: StrokeVariation, variationAmount: number): void {
    const level = metalStrength(velocity) * (1 + 0.06 * variation.level);
    const hard = Math.min(1, velocity * (1 + 0.15 * variation.hardness));
    const loose = 0.5 + this.length;
    this.plate.damp(1);
    this.plate.strike({
      level: level * 0.8,
      pulseSeconds: 0.0002 + 0.0002 * (1 - hard),
      noise: 0.3 + 0.5 * variationAmount,
      click: level * 0.35,
      cascade: level * 0.75,
      cascadeRise: 0.004,
      cascadeSeconds: 0.9 * loose,
      cascadeInstant: 0.45,
      air: level * (0.3 + 0.5 * this.tone) * (0.5 + 0.5 * hard),
      airRise: 0.002,
      airSeconds: 0.55 * loose,
    });
  }

  /** The foot alone: the two cymbals clap shut. No stick, less treble, a softer start. */
  foot(velocity: number, variation: StrokeVariation, variationAmount: number): void {
    const level = metalStrength(velocity) * (1 + 0.06 * variation.level);
    const tight = 0.5 + this.length;
    this.plate.damp(0.14 * tight);
    this.plate.strike({
      level: level * 0.5,
      pulseSeconds: 0.0011,
      noise: 0.4 + 0.4 * variationAmount,
      click: 0,
      cascade: level * 0.4,
      cascadeRise: 0.002,
      cascadeSeconds: 0.07 * tight,
      cascadeInstant: 0.2,
      air: level * 0.06,
      airRise: 0.002,
      airSeconds: 0.04 * tight,
    });
  }

  render(out: Float64Array, count: number): void {
    this.plate.render(out, count);
  }
  settle(): void {
    this.plate.settle();
  }
  sleep(): void {
    this.plate.sleep();
  }
  forEachState(visit: (value: number) => void): void {
    this.plate.forEachState(visit);
  }
}

/** The ride: the tip of the stick on the bow. Each stroke is a ping, and the pings build a wash. */
export class RideCymbal implements DrumVoice {
  private readonly plate: PlateCymbal;
  private tone = 0.5;
  private decay = 2.2;

  constructor(sampleRate: number, random: Random) {
    this.plate = new PlateCymbal(sampleRate, RIDE_DESIGN, random);
  }

  get active(): boolean {
    return this.plate.active;
  }

  /** `tone` is brightness, 0 to 1; `decay` is the crash's ring time in seconds, which the ride follows. */
  configure(tone: number, decay: number): void {
    this.tone = tone;
    this.decay = decay;
    this.plate.voice(tone);
  }

  strike(velocity: number, variation: StrokeVariation, variationAmount: number): void {
    const level = metalStrength(velocity) * (1 + 0.06 * variation.level);
    const hard = Math.min(1, velocity * (1 + 0.15 * variation.hardness));
    this.plate.strike({
      level: level * 0.55,
      pulseSeconds: 0.00012 + 0.00016 * (1 - hard),
      noise: 0.2 + 0.5 * variationAmount,
      click: level * 0.5,
      // the wash grows with force much faster than the ping does
      cascade: level * hard * 0.16,
      cascadeRise: 0.035,
      cascadeSeconds: this.decay * 1.4,
      cascadeInstant: 0.1,
      air: level * hard * (0.05 + 0.1 * this.tone),
      airRise: 0.004,
      airSeconds: this.decay * 0.35,
    });
  }

  render(out: Float64Array, count: number): void {
    this.plate.render(out, count);
  }
  settle(): void {
    this.plate.settle();
  }
  sleep(): void {
    this.plate.sleep();
  }
  forEachState(visit: (value: number) => void): void {
    this.plate.forEachState(visit);
  }
}

/** The crash: the shoulder of the stick on the edge. The sound blooms after the stroke. */
export class CrashCymbal implements DrumVoice {
  private readonly plate: PlateCymbal;
  private tone = 0.5;
  private decay = 2.2;

  constructor(sampleRate: number, random: Random) {
    this.plate = new PlateCymbal(sampleRate, CRASH_DESIGN, random);
  }

  get active(): boolean {
    return this.plate.active;
  }

  configure(tone: number, decay: number): void {
    this.tone = tone;
    this.decay = decay;
    this.plate.voice(tone);
  }

  strike(velocity: number, variation: StrokeVariation, variationAmount: number): void {
    const level = metalStrength(velocity) * (1 + 0.06 * variation.level);
    const hard = Math.min(1, velocity * (1 + 0.15 * variation.hardness));
    this.plate.strike({
      level: level * 0.5,
      pulseSeconds: 0.0009,
      noise: 0.4 + 0.4 * variationAmount,
      click: level * 0.12,
      cascade: level * (0.35 + 0.65 * hard),
      // a harder stroke blooms sooner
      cascadeRise: 0.012 - 0.006 * hard,
      cascadeSeconds: this.decay,
      cascadeInstant: 0.15,
      air: level * (0.35 + 0.65 * hard) * (0.5 + 0.9 * this.tone),
      airRise: 0.016 - 0.008 * hard,
      airSeconds: this.decay * 0.45,
    });
  }

  render(out: Float64Array, count: number): void {
    this.plate.render(out, count);
  }
  settle(): void {
    this.plate.settle();
  }
  sleep(): void {
    this.plate.sleep();
  }
  forEachState(visit: (value: number) => void): void {
    this.plate.forEachState(visit);
  }
}
