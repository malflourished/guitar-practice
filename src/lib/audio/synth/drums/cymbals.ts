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
import { ENVELOPE_FLOOR, VOICE_SLEEP_LEVEL, noiseGain, type DrumVoice, type StrokeVariation } from './membranes';

/** The longest stretch a voice is asked to render at once: the synth's housekeeping grid. */
const MAX_CHUNK = 128;
/** The noisy part of a stroke lasts this long, in seconds: the stick's bounce on the metal. */
const STRIKE_NOISE_SECONDS = 0.0015;
/** A wash with no low-pass asked for is this bright, in hertz. */
const WASH_OPEN_HZ = 20000;
/** The wash's low-pass is moved every this many samples (a power of two). */
const WASH_CONTROL = 64;

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
  /**
   * How the modes' levels lean with frequency at the middle of the Tone
   * control: a mode's gain goes as (f / 1 kHz) to this power. Hi-hats lean
   * hard to the treble; a crash is nearly level.
   */
  tilt: number;
  /** Where the noise above the modes starts, in hertz. */
  airHz: number;
  /**
   * Plain noise under the modes, following the wash: it fills the gaps
   * between the few dozen partials, where a real cymbal has hundreds. `hz` is
   * the centre of its wide band and `level` its strength against the modes:
   * more makes the cymbal washier and less like a cluster of bells.
   */
  body: { hz: number; level: number };
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
  /** Darken the wash: a low-pass on the noise that feeds the modes, in hertz. Left out, it is as bright as the cymbal. */
  cascadeHz?: number;
  /**
   * Let the wash darken as it dies, as a cymbal's top goes first: the
   * low-pass falls from `cascadeHz` towards `hz` with a time constant of
   * `seconds`.
   */
  cascadeDark?: { hz: number; seconds: number };
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
  // one source of chance for each of the three noises, so none depends on how the others were drawn
  private readonly strikeRandom: Random;
  private readonly cascadeRandom: Random;
  private readonly airRandom: Random;
  private readonly bank: ModalBank;
  private readonly frequencies: number[];
  private readonly pingFrequencies: number[];
  private readonly strikeBuffer = new Float64Array(MAX_CHUNK);
  private readonly clickBuffer = new Float64Array(MAX_CHUNK);
  private readonly cascadeBuffer = new Float64Array(MAX_CHUNK);
  private readonly airBuffer = new Float64Array(MAX_CHUNK);
  private readonly bodyBuffer = new Float64Array(MAX_CHUNK);
  private readonly bodyFilter = new Biquad();
  private readonly bodyLevel: number;
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
  private cascadeSmooth = 1;
  private cascadeLast = 0;
  /** The wash's low-pass now, where it is falling to, and how fast, in hertz and per 64 samples. */
  private washHz = WASH_OPEN_HZ;
  private washDarkHz = WASH_OPEN_HZ;
  private washDarkStep = 1;
  private washAge = 0;
  private clickNoiseGain = 1;
  private airSlow = 0;
  private airFast = 0;
  private airSlowStep = 0;
  private airFastStep = 0;
  private tone = 0.5;
  private ringScale = 1;
  // Which parts are still to be rendered. Each is switched on by a stroke and
  // off only in `settle`, at fixed points on the clock, so the sound cannot
  // depend on how the caller slices its blocks.
  private clickOn = false;
  private washOn = false;
  private airOn = false;
  private readonly airGain: number;

  constructor(sampleRate: number, design: PlateDesign, random: Random) {
    this.sampleRate = sampleRate;
    this.design = design;
    this.strikeRandom = random.fork();
    this.cascadeRandom = random.fork();
    this.airRandom = random.fork();
    this.frequencies = plateModeFrequencies(design.modes, design.lowHz, design.highHz, design.seed);
    this.pingFrequencies = design.ping
      ? plateModeFrequencies(design.ping.count, design.ping.lowHz, design.ping.highHz, design.seed * 7 + 3, 0.3)
      : [];
    this.bank = new ModalBank(sampleRate, this.modeSpecs());
    this.clickFilter.setHighpass(2200, 0.707, sampleRate);
    this.airFilter.setHighpass(design.airHz, 0.707, sampleRate);
    this.airGain = noiseGain(sampleRate);
    this.clickNoiseGain = noiseGain(sampleRate);
    this.bodyFilter.setBandpass(design.body.hz, 0.6, sampleRate);
    this.bodyLevel = design.body.level * noiseGain(sampleRate);
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
    // New energy arrives bright, and the wash darkens again from there.
    this.washHz = stroke.cascadeHz ?? WASH_OPEN_HZ;
    this.washDarkHz = stroke.cascadeDark ? Math.min(this.washHz, stroke.cascadeDark.hz) : this.washHz;
    this.washDarkStep = stroke.cascadeDark ? Math.exp(-WASH_CONTROL / (Math.max(0.01, stroke.cascadeDark.seconds) * sampleRate)) : 1;
    this.washAge = 0;
    this.airSlow += stroke.air * this.airGain;
    this.airFast += stroke.air * this.airGain;
    this.airSlowStep = step(stroke.airSeconds);
    this.airFastStep = rise(stroke.airRise);
    this.clickOn = stroke.click > 0 || this.clickOn;
    this.washOn = true;
    this.airOn = true;
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    const { strikeBuffer, cascadeBuffer } = this;

    // The stroke: a smooth pulse, and a burst of noise that makes each one its own.
    const strokeLength = Math.max(this.pulseLength, this.noiseLength);
    const striking = this.pulseIndex < strokeLength;
    if (striking) {
      const { pulseLength, noiseLength, pulseScale, noiseScale, strikeRandom, clickBuffer, clickNoiseGain } = this;
      let k = this.pulseIndex;
      for (let i = 0; i < count; i++, k++) {
        const pulse = k < pulseLength ? pulseScale * (1 - Math.cos((2 * Math.PI * (k + 0.5)) / pulseLength)) : 0;
        const noise = k < noiseLength ? noiseScale * strikeRandom.bipolar() * (1 - Math.cos((2 * Math.PI * (k + 0.5)) / noiseLength)) : 0;
        strikeBuffer[i] = pulse + noise;
        // Heard directly, the burst's noise is spread over half the sample rate: keep its audible part the same at any rate.
        clickBuffer[i] = pulse + noise * clickNoiseGain;
      }
      this.pulseIndex = k;
    }
    // The stick's own tick: the stroke heard directly, through a high-pass that then rings out.
    if (this.clickOn) {
      const { clickLevel, clickFilter, clickBuffer } = this;
      if (striking) for (let i = 0; i < count; i++) out[i] += clickLevel * clickFilter.process(clickBuffer[i]);
      else for (let i = 0; i < count; i++) out[i] += clickLevel * clickFilter.process(0);
    }

    // The wash: noise into the modes, under an envelope that can bloom.
    if (this.washOn) {
      const { cascadeSlowStep, cascadeFastStep, washDarkHz, washDarkStep, sampleRate } = this;
      let { cascadeSlow, cascadeFast, cascadeLast, cascadeSmooth, washHz, washAge } = this;
      this.cascadeRandom.fillBipolar(cascadeBuffer, count);
      for (let i = 0; i < count; i++) {
        // The wash's low-pass is moved at fixed points in the stroke's own time, not the caller's blocks.
        if ((washAge++ & (WASH_CONTROL - 1)) === 0) {
          cascadeSmooth = 1 - Math.exp((-2 * Math.PI * washHz) / sampleRate);
          washHz = washDarkHz + (washHz - washDarkHz) * washDarkStep;
        }
        cascadeLast += cascadeSmooth * ((cascadeSlow - cascadeFast) * cascadeBuffer[i] - cascadeLast);
        cascadeBuffer[i] = cascadeLast;
        cascadeSlow *= cascadeSlowStep;
        cascadeFast *= cascadeFastStep;
      }
      this.cascadeSlow = cascadeSlow;
      this.cascadeFast = cascadeFast;
      this.cascadeLast = cascadeLast;
      this.cascadeSmooth = cascadeSmooth;
      this.washHz = washHz;
      this.washAge = washAge;
      // the same wash as plain noise, to fill between the modes
      const { bodyBuffer, bodyLevel } = this;
      for (let i = 0; i < count; i++) bodyBuffer[i] = cascadeBuffer[i];
      this.bodyFilter.processBlock(bodyBuffer, 0, count);
      for (let i = 0; i < count; i++) out[i] += bodyLevel * bodyBuffer[i];
    }

    this.bank.process(out, striking ? strikeBuffer : null, this.washOn ? cascadeBuffer : null, count);

    // The air above the modes.
    if (this.airOn) {
      const { airBuffer, airSlowStep, airFastStep } = this;
      let { airSlow, airFast } = this;
      this.airRandom.fillBipolar(airBuffer, count);
      for (let i = 0; i < count; i++) {
        airBuffer[i] *= airSlow - airFast;
        airSlow *= airSlowStep;
        airFast *= airFastStep;
      }
      this.airFilter.processBlock(airBuffer, 0, count);
      for (let i = 0; i < count; i++) out[i] += airBuffer[i];
      this.airSlow = airSlow;
      this.airFast = airFast;
    }
  }

  settle(): void {
    if (!this.active) return;
    const stroke = this.pulseIndex < Math.max(this.pulseLength, this.noiseLength);
    if (this.clickOn && !stroke && this.clickFilter.magnitude() < VOICE_SLEEP_LEVEL) {
      this.clickOn = false;
      this.clickFilter.reset();
    }
    if (this.washOn) {
      if (this.cascadeFast < ENVELOPE_FLOOR) this.cascadeFast = 0;
      if (this.cascadeSlow < ENVELOPE_FLOOR) {
        this.washOn = false;
        this.cascadeSlow = this.cascadeFast = this.cascadeLast = 0;
        this.bodyFilter.reset();
      }
    }
    if (this.airOn) {
      if (this.airFast < ENVELOPE_FLOOR) this.airFast = 0;
      if (this.airSlow < ENVELOPE_FLOOR) {
        this.airSlow = this.airFast = 0;
        if (this.airFilter.magnitude() < VOICE_SLEEP_LEVEL) {
          this.airOn = false;
          this.airFilter.reset();
        }
      }
    }
    const ringing = this.bank.settle();
    if (ringing < VOICE_SLEEP_LEVEL && !stroke && !this.clickOn && !this.washOn && !this.airOn) this.sleep();
  }

  sleep(): void {
    this.bank.sleep();
    this.clickFilter.reset();
    this.airFilter.reset();
    this.bodyFilter.reset();
    this.bodyBuffer.fill(0);
    this.pulseIndex = 0;
    this.pulseLength = 0;
    this.noiseLength = 0;
    this.cascadeSlow = this.cascadeFast = this.cascadeLast = this.airSlow = this.airFast = 0;
    this.clickOn = this.washOn = this.airOn = false;
    this.washHz = this.washDarkHz = WASH_OPEN_HZ;
    this.washAge = 0;
    this.strikeBuffer.fill(0);
    this.clickBuffer.fill(0);
    this.cascadeBuffer.fill(0);
    this.airBuffer.fill(0);
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.bank.forEachState(visit);
    this.clickFilter.state().forEach(visit);
    this.airFilter.state().forEach(visit);
    this.bodyFilter.state().forEach(visit);
    [this.cascadeSlow, this.cascadeFast, this.cascadeLast, this.airSlow, this.airFast].forEach(visit);
  }

  /** The bank's modes for the tone and ring now set. */
  private modeSpecs(): ModeSpec[] {
    const { design, tone, ringScale } = this;
    // Tone leans the whole cymbal: a dark one favours its low modes, a bright one its high modes.
    const tilt = design.tilt + 0.9 * (tone - 0.5);
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
  lowHz: 520,
  highHz: 11000,
  ringSeconds: 0.5,
  ringSlope: 0.4,
  tilt: 0.9,
  airHz: 7000,
  body: { hz: 6000, level: 0.5 },
};

/** A 20-inch ride: a clear ping over a long, quiet wash. */
export const RIDE_DESIGN: PlateDesign = {
  seed: 0x7a11ce,
  modes: 38,
  lowHz: 380,
  highHz: 7600,
  ringSeconds: 0.8,
  ringSlope: 0.5,
  ping: { count: 7, lowHz: 2700, highHz: 7400, seconds: 0.4, level: 1 },
  tilt: 0.6,
  airHz: 6000,
  body: { hz: 3200, level: 0.3 },
};

/** A 16-inch crash: all wash and bloom. Its modes ring briefly, so each is a band of noise more than a tone. */
export const CRASH_DESIGN: PlateDesign = {
  seed: 0xc4a54,
  modes: 42,
  lowHz: 300,
  highHz: 8200,
  ringSeconds: 0.32,
  ringSlope: 0.35,
  tilt: 0.8,
  airHz: 5200,
  body: { hz: 3600, level: 0.8 },
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
      // the tip, played softly, wakes less of the top of the metal
      cascadeHz: 3500 + 16500 * hard * hard,
      air: level * (0.25 + 0.5 * this.tone) * hard * hard,
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
      cascadeHz: 5000 + 15000 * hard,
      cascadeDark: { hz: 4500, seconds: 0.3 * loose },
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
      cascade: level * 1.6,
      cascadeRise: 0.002,
      cascadeSeconds: 0.07 * tight,
      cascadeInstant: 0.2,
      // the plates meet flat on: the clap is in the middle of the spectrum, not the top
      cascadeHz: 2600,
      air: level * 0.03,
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
      cascadeHz: 16000,
      cascadeDark: { hz: 3000, seconds: this.decay * 0.3 },
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
      cascade: level * (0.45 + 0.55 * hard),
      // a harder stroke blooms sooner
      cascadeRise: 0.012 - 0.006 * hard,
      cascadeSeconds: this.decay,
      cascadeInstant: 0.15,
      // a soft crash never wakes the top of the metal
      cascadeHz: 6000 + 14000 * hard,
      // and the top goes first: by the time a crash is half gone it is a darker sound
      cascadeDark: { hz: 2400, seconds: this.decay * 0.18 },
      // and reaches further up: the top of the spectrum grows faster with force than the rest
      air: level * (0.15 + 0.85 * hard * hard) * (0.5 + 0.9 * this.tone),
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
