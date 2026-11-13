/**
 * The acoustic kit's drums: kick, snare, toms and the cross-stick.
 *
 * A struck drumhead is the sum of a few modes, each a tone that dies away at
 * its own rate (docs/sound/drums.md). Each drum here is one object that keeps
 * its state: a stroke adds energy to modes that may still be ringing from the
 * stroke before, as on a real head. A harder stroke is brighter, starts
 * sharper in pitch and, on the snare, throws the wires further; it is not
 * the soft stroke turned up.
 *
 * Every voice has the same small surface: a `strike`, a `render` that adds
 * its sound to a buffer, and `settle`, which puts it to sleep once it has
 * died away. A sleeping voice holds only zeros and costs nothing.
 */
import { Biquad } from '../dsp/biquad';
import type { Random } from '../dsp/random';

/** While the pitch is moving, the modes' coefficients are refreshed this often, in samples. */
const CONTROL = 16;
/** A pitch rise smaller than this is treated as none. */
const GLIDE_FLOOR = 1e-4;
/** A voice quieter than this, with nothing more to play, goes to sleep. */
export const VOICE_SLEEP_LEVEL = 1e-6;

/** What every drum voice offers the kit. */
export interface DrumVoice {
  /** Sounding. A sleeping voice holds only zeros. */
  readonly active: boolean;
  /** Add the voice's next `count` samples to `out[0..count)`. */
  render(out: Float64Array, count: number): void;
  /** Housekeeping, every 128 samples or so: go to sleep once the sound has died away. */
  settle(): void;
  /** Stop at once and zero the memory. */
  sleep(): void;
  /** Every number the voice remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void;
}

/**
 * The modes of one drumhead. Each mode is a point turning round a circle and
 * spiralling inwards: its height is the sound. A stroke pushes every point
 * outwards. While the head is stretched by a hard stroke, all the modes turn
 * faster, which is the drum's pitch starting sharp and falling.
 */
export class MembraneModes {
  readonly count: number;
  private readonly sampleRate: number;
  private readonly radians: Float64Array;
  private readonly shrink: Float64Array;
  private readonly rc: Float64Array;
  private readonly rs: Float64Array;
  private readonly x: Float64Array;
  private readonly y: Float64Array;
  private glide = 0;
  private glideStep = 1;
  private age = 0;
  private settled = true;

  constructor(sampleRate: number, count: number) {
    this.sampleRate = sampleRate;
    this.count = count;
    this.radians = new Float64Array(count);
    this.shrink = new Float64Array(count);
    this.rc = new Float64Array(count);
    this.rs = new Float64Array(count);
    this.x = new Float64Array(count);
    this.y = new Float64Array(count);
  }

  /** Set a mode's resting frequency and the time it takes to fall by 60 dB. */
  tune(mode: number, hz: number, t60: number): void {
    const limit = this.sampleRate * 0.45;
    this.radians[mode] = (2 * Math.PI * Math.min(hz, limit)) / this.sampleRate;
    this.shrink[mode] = Math.exp(-6.907755 / (Math.max(0.002, t60) * this.sampleRate));
    this.settled = false;
  }

  /** Push a mode outwards by `amount`: its tone rises from zero to that amplitude within a quarter cycle. */
  push(mode: number, amount: number): void {
    this.x[mode] += amount;
  }

  /**
   * Stretch the head: every mode starts `amount` sharp (0.2 is 20%) and falls
   * back with a time constant of `seconds`. A weaker stretch than the one
   * still in force changes nothing.
   */
  stretch(amount: number, seconds: number): void {
    if (amount > this.glide) this.glide = amount;
    this.glideStep = Math.exp(-CONTROL / (Math.max(0.001, seconds) * this.sampleRate));
    this.settled = false;
  }

  /** Add the modes' sound to `out[0..count)`. */
  render(out: Float64Array, count: number): void {
    const { x, y, rc, rs } = this;
    let done = 0;
    while (done < count) {
      const phase = this.age % CONTROL;
      if (phase === 0 && !this.settled) this.refresh();
      const chunk = Math.min(count - done, CONTROL - phase);
      for (let m = 0; m < this.count; m++) {
        const c = rc[m];
        const s = rs[m];
        let px = x[m];
        let py = y[m];
        for (let i = done; i < done + chunk; i++) {
          const nx = c * px - s * py;
          py = s * px + c * py;
          px = nx;
          out[i] += py;
        }
        x[m] = px;
        y[m] = py;
      }
      done += chunk;
      this.age += chunk;
    }
  }

  /** The largest value any mode holds. */
  level(): number {
    let largest = 0;
    for (let m = 0; m < this.count; m++) {
      const magnitude = Math.max(Math.abs(this.x[m]), Math.abs(this.y[m]));
      if (magnitude > largest) largest = magnitude;
    }
    return largest;
  }

  sleep(): void {
    this.x.fill(0);
    this.y.fill(0);
    this.glide = 0;
    this.age = 0;
    this.settled = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.x.forEach(visit);
    this.y.forEach(visit);
    visit(this.glide);
  }

  /** Work out each mode's turn and shrink per sample at the pitch the head has now. */
  private refresh(): void {
    const factor = 1 + this.glide;
    for (let m = 0; m < this.count; m++) {
      const angle = Math.min(this.radians[m] * factor, 2.8);
      this.rc[m] = this.shrink[m] * Math.cos(angle);
      this.rs[m] = this.shrink[m] * Math.sin(angle);
    }
    if (this.glide > GLIDE_FLOOR) {
      this.glide *= this.glideStep;
    } else {
      this.glide = 0;
      this.settled = true; // the coefficients now stand until the next stroke or retune
    }
  }
}

/**
 * A short burst of noise with its own fade: the beater's or the stick's
 * click, shaped by a filter the voice sets. The burst restarts on each stroke.
 */
class NoiseBurst {
  level = 0;
  private fade = 0;
  readonly filter = new Biquad();
  readonly second = new Biquad();
  private useSecond = false;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  /** Start a burst at `level` that falls by 60 dB in `seconds`. */
  start(level: number, seconds: number): void {
    this.level = level;
    this.fade = Math.exp(-6.907755 / (Math.max(0.0005, seconds) * this.sampleRate));
  }

  /** A band-pass at `hz`: the knock of felt on a head. */
  band(hz: number, q: number): void {
    this.filter.setBandpass(hz, q, this.sampleRate);
    this.useSecond = false;
  }

  /** Everything above `lowHz` and below `highHz`: the tick of wood, or wires. */
  between(lowHz: number, highHz: number): void {
    this.filter.setHighpass(lowHz, 0.707, this.sampleRate);
    this.second.setLowpass(highHz, 0.707, this.sampleRate);
    this.useSecond = true;
  }

  get sounding(): boolean {
    return this.level > 0 || this.filter.magnitude() > VOICE_SLEEP_LEVEL || this.second.magnitude() > VOICE_SLEEP_LEVEL;
  }

  render(out: Float64Array, count: number, random: Random): void {
    const { filter, second, fade, useSecond } = this;
    let level = this.level;
    for (let i = 0; i < count; i++) {
      let sample = filter.process(level * random.bipolar());
      if (useSecond) sample = second.process(sample);
      out[i] += sample;
      level *= fade;
    }
    this.level = level < 1e-7 ? 0 : level;
  }

  sleep(): void {
    this.level = 0;
    this.filter.reset();
    this.second.reset();
  }

  forEachState(visit: (value: number) => void): void {
    visit(this.level);
    this.filter.state().forEach(visit);
    this.second.state().forEach(visit);
  }
}

/** One stroke's small differences from the last: strike point and hardness, each -1 to 1, scaled by Variation. */
export interface StrokeVariation {
  /** Changes which modes the stroke favours. */
  position: number;
  hardness: number;
  level: number;
}

export function strokeVariation(random: Random, amount: number): StrokeVariation {
  return { position: amount * random.bipolar(), hardness: amount * random.bipolar(), level: amount * random.bipolar() };
}

/** A stroke's loudness from its velocity: soft strokes are much softer, as on a real drum. */
function strength(velocity: number, exponent: number): number {
  return Math.min(1, Math.max(0, velocity)) ** exponent;
}

/* ------------------------------------------------------------------ kick */

/** The kick's modes as multiples of its lowest, with their share of the stroke and of the decay time. */
const KICK_MODES = [
  // the three modes a centre stroke excites, lowered and spread by the air in the shell
  { ratio: 1, level: 1, decay: 1, order: 0 },
  { ratio: 2.13, level: 0.55, decay: 0.55, order: 0.6 },
  { ratio: 3.27, level: 0.26, decay: 0.36, order: 1.2 },
  // the head's slap: higher modes that last a few hundredths of a second, and that small speakers can carry
  { ratio: 7.4, level: 0.13, decay: 0.14, order: 2 },
  { ratio: 11.3, level: 0.08, decay: 0.1, order: 2.6 },
];

export interface KickSettings {
  hz: number;
  decay: number;
  punch: number;
}

export class AcousticKick implements DrumVoice {
  active = false;
  private readonly modes: MembraneModes;
  private readonly click: NoiseBurst;
  private readonly random: Random;
  private settings: KickSettings;

  constructor(sampleRate: number, settings: KickSettings, random: Random) {
    this.modes = new MembraneModes(sampleRate, KICK_MODES.length);
    this.click = new NoiseBurst(sampleRate);
    this.random = random;
    this.settings = settings;
    this.configure(settings);
  }

  configure(settings: KickSettings): void {
    this.settings = settings;
    KICK_MODES.forEach((mode, i) => this.modes.tune(i, settings.hz * mode.ratio, settings.decay * mode.decay));
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const { punch } = this.settings;
    const hard = Math.min(1, Math.max(0, velocity * (1 + 0.15 * variation.hardness)));
    const level = strength(velocity, 1.6) * (1 + 0.06 * variation.level);
    // A harder stroke puts more into the upper modes: the beater leaves the head sooner.
    const brightness = 0.3 + 0.7 * hard;
    KICK_MODES.forEach((mode, i) => {
      const wobble = 1 + 0.2 * variation.position * (i % 2 === 0 ? 1 : -1) * Math.min(1, i);
      this.modes.push(i, level * mode.level * brightness ** mode.order * wobble);
    });
    // The head stretches under the beater, so the pitch starts high and falls: the "boom".
    this.modes.stretch((0.1 + 0.55 * punch) * hard * hard, 0.022);
    // The beater's click: a knock of felt, higher and louder for a harder stroke.
    this.click.band(1500 + 2800 * hard * (0.4 + punch), 0.9);
    this.click.start(level * (0.1 + 0.9 * punch) * 1.6, 0.012);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    this.modes.render(out, count);
    if (this.click.sounding) this.click.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && this.modes.level() < VOICE_SLEEP_LEVEL && !this.click.sounding) this.sleep();
  }

  sleep(): void {
    this.modes.sleep();
    this.click.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.click.forEachState(visit);
  }
}

/* ----------------------------------------------------------------- snare */

/**
 * The snare head's modes as multiples of its lowest. The first two are the
 * lowest mode's pair (the two heads moving together, and in opposition); the
 * third is the ring a drummer tames with a damper.
 */
const SNARE_MODES = [
  { ratio: 1, level: 1, seconds: 0.11, order: 0 },
  { ratio: 1.17, level: 0.55, seconds: 0.09, order: 0.2 },
  { ratio: 1.74, level: 0.75, seconds: 0.16, order: 0.5 },
  { ratio: 2.42, level: 0.4, seconds: 0.11, order: 1 },
  { ratio: 3.1, level: 0.28, seconds: 0.08, order: 1.5 },
  { ratio: 3.84, level: 0.2, seconds: 0.06, order: 2 },
];

export interface SnareSettings {
  hz: number;
  wires: number;
  decay: number;
}

export class AcousticSnare implements DrumVoice {
  active = false;
  private readonly sampleRate: number;
  private readonly modes: MembraneModes;
  private readonly click: NoiseBurst;
  private readonly random: Random;
  private settings: SnareSettings;
  // the wires: noise that the head's motion switches on and off
  private readonly wireLow = new Biquad();
  private readonly wireHigh = new Biquad();
  private wireLevel = 0;
  private wireFade = 0;
  private buzzDepth = 0;
  private buzzFade = 0;
  private buzzCos = 1;
  private buzzSin = 0;
  private buzzStepCos = 1;
  private buzzStepSin = 0;

  constructor(sampleRate: number, settings: SnareSettings, random: Random) {
    this.sampleRate = sampleRate;
    this.modes = new MembraneModes(sampleRate, SNARE_MODES.length);
    this.click = new NoiseBurst(sampleRate);
    this.random = random;
    this.settings = settings;
    this.wireLow.setHighpass(1100, 0.8, sampleRate);
    this.wireHigh.setLowpass(9000, 0.707, sampleRate);
    this.buzzFade = Math.exp(-1 / (0.045 * sampleRate));
    this.configure(settings);
  }

  configure(settings: SnareSettings): void {
    this.settings = settings;
    SNARE_MODES.forEach((mode, i) => this.modes.tune(i, settings.hz * mode.ratio, mode.seconds));
    const angle = (2 * Math.PI * settings.hz) / this.sampleRate;
    this.buzzStepCos = Math.cos(angle);
    this.buzzStepSin = Math.sin(angle);
  }

  /**
   * `soft` is a brush or a ghosted tap: the stroke lands over several
   * milliseconds, so there is no stick click and little of the upper modes.
   */
  strike(velocity: number, variation: StrokeVariation, soft = false): void {
    const { wires, decay } = this.settings;
    const hard = Math.min(1, Math.max(0, velocity * (1 + 0.15 * variation.hardness)));
    const vary = 1 + 0.06 * variation.level;
    // Head and wires answer velocity differently: a ghost note is mostly wires.
    const head = strength(velocity, 1.8) * vary * (1 - 0.35 * wires) * (soft ? 0.5 : 1);
    const brightness = (soft ? 0.25 : 0.4) + 0.6 * hard;
    SNARE_MODES.forEach((mode, i) => {
      // off-centre strokes ring the third mode more; centre strokes are drier
      const wobble = 1 + 0.3 * variation.position * (i === 2 || i === 3 ? 1 : -0.4);
      this.modes.push(i, head * mode.level * brightness ** mode.order * wobble);
    });
    this.modes.stretch(0.07 * hard * hard, 0.014);
    if (!soft) {
      this.click.between(2800, 11000);
      this.click.start(strength(velocity, 1.5) * vary * 0.9, 0.004);
    }
    // The wires: thrown further, and for longer, by a harder stroke, and brighter.
    const thrown = strength(velocity, 1.15) * vary * wires * 1.5 * (soft ? 0.8 : 1);
    this.wireLevel = Math.max(this.wireLevel, thrown);
    const seconds = decay * (0.45 + 0.55 * hard);
    this.wireFade = Math.exp(-6.907755 / (seconds * this.sampleRate));
    this.wireHigh.setLowpass((soft ? 3200 : 4200) + 6800 * hard, 0.707, this.sampleRate);
    // They slap in time with the head while it swings widely, which is the buzz in a snare.
    this.buzzDepth = 0.6;
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    this.modes.render(out, count);
    if (this.click.sounding) this.click.render(out, count, this.random);
    if (this.wireLevel > 0) {
      const { wireLow, wireHigh, wireFade, buzzFade, buzzStepCos, buzzStepSin, random } = this;
      let { wireLevel, buzzDepth, buzzCos, buzzSin } = this;
      for (let i = 0; i < count; i++) {
        const turned = buzzCos * buzzStepCos - buzzSin * buzzStepSin;
        buzzSin = buzzSin * buzzStepCos + buzzCos * buzzStepSin;
        buzzCos = turned;
        const gate = 1 + buzzDepth * buzzSin;
        out[i] += wireHigh.process(wireLow.process(wireLevel * gate * random.bipolar()));
        wireLevel *= wireFade;
        buzzDepth *= buzzFade;
      }
      // keep the turning point on the unit circle
      const drift = 1.5 - 0.5 * (buzzCos * buzzCos + buzzSin * buzzSin);
      this.buzzCos = buzzCos * drift;
      this.buzzSin = buzzSin * drift;
      this.wireLevel = wireLevel < 1e-7 ? 0 : wireLevel;
      this.buzzDepth = buzzDepth;
    }
  }

  settle(): void {
    if (!this.active) return;
    const filterQuiet = this.wireHigh.magnitude() < VOICE_SLEEP_LEVEL;
    if (this.modes.level() < VOICE_SLEEP_LEVEL && this.wireLevel < VOICE_SLEEP_LEVEL && filterQuiet && !this.click.sounding) {
      this.sleep();
    }
  }

  sleep(): void {
    this.modes.sleep();
    this.click.sleep();
    this.wireLow.reset();
    this.wireHigh.reset();
    this.wireLevel = 0;
    this.buzzDepth = 0;
    this.buzzCos = 1;
    this.buzzSin = 0;
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.click.forEachState(visit);
    this.wireLow.state().forEach(visit);
    this.wireHigh.state().forEach(visit);
    [this.wireLevel, this.buzzDepth, this.buzzCos, this.buzzSin].forEach(visit);
  }
}

/* ------------------------------------------------------------------ toms */

const TOM_MODES = [
  { ratio: 1, level: 1, decay: 1, order: 0 },
  { ratio: 1.58, level: 0.5, decay: 0.6, order: 0.5 },
  { ratio: 2.16, level: 0.3, decay: 0.4, order: 1 },
  { ratio: 2.9, level: 0.16, decay: 0.25, order: 1.6 },
];

export class AcousticTom implements DrumVoice {
  active = false;
  private readonly modes: MembraneModes;
  private readonly click: NoiseBurst;
  private readonly random: Random;

  /** `hz` is the tom's resting pitch and `seconds` how long it rings. */
  constructor(sampleRate: number, hz: number, seconds: number, random: Random) {
    this.modes = new MembraneModes(sampleRate, TOM_MODES.length);
    this.click = new NoiseBurst(sampleRate);
    this.random = random;
    TOM_MODES.forEach((mode, i) => this.modes.tune(i, hz * mode.ratio, seconds * mode.decay));
  }

  /** `soft` is a brush: no stick click, and less of the upper modes. */
  strike(velocity: number, variation: StrokeVariation, soft = false): void {
    const hard = Math.min(1, Math.max(0, velocity * (1 + 0.15 * variation.hardness)));
    const level = strength(velocity, 1.6) * (1 + 0.06 * variation.level) * (soft ? 0.6 : 1);
    const brightness = (soft ? 0.2 : 0.35) + 0.65 * hard;
    TOM_MODES.forEach((mode, i) => {
      const wobble = 1 + 0.25 * variation.position * (i % 2 === 0 ? -0.3 : 1);
      this.modes.push(i, level * mode.level * brightness ** mode.order * wobble);
    });
    // Both heads are free, so a tom has the most audible pitch fall in the kit.
    this.modes.stretch(0.11 * hard * hard, 0.04);
    if (!soft) {
      this.click.between(1800, 9000);
      this.click.start(level * 0.5, 0.005);
    }
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    this.modes.render(out, count);
    if (this.click.sounding) this.click.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && this.modes.level() < VOICE_SLEEP_LEVEL && !this.click.sounding) this.sleep();
  }

  sleep(): void {
    this.modes.sleep();
    this.click.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.click.forEachState(visit);
  }
}

/* ----------------------------------------------------------- cross-stick */

/**
 * A cross-stick is the stick and the rim, not the head: the stick's own
 * bending modes (a 40 cm hickory stick, pinned at one end by the hand) and a
 * short thump from the damped head under it.
 */
const RIM_MODES = [
  { hz: 215, level: 0.3, seconds: 0.04 },
  { hz: 470, level: 0.4, seconds: 0.05 },
  { hz: 1010, level: 1, seconds: 0.07 },
  { hz: 1870, level: 0.7, seconds: 0.05 },
  { hz: 2940, level: 0.32, seconds: 0.03 },
];

export class CrossStick implements DrumVoice {
  active = false;
  private readonly modes: MembraneModes;
  private readonly click: NoiseBurst;
  private readonly random: Random;

  constructor(sampleRate: number, random: Random) {
    this.modes = new MembraneModes(sampleRate, RIM_MODES.length);
    this.click = new NoiseBurst(sampleRate);
    this.random = random;
    RIM_MODES.forEach((mode, i) => this.modes.tune(i, mode.hz, mode.seconds));
    this.click.between(2500, 12000);
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const level = strength(velocity, 1.4) * (1 + 0.06 * variation.level);
    RIM_MODES.forEach((mode, i) => {
      // where along the stick it meets the rim changes the balance of its modes
      const wobble = 1 + 0.3 * variation.position * (i % 2 === 0 ? 1 : -1);
      this.modes.push(i, level * mode.level * wobble * 0.8);
    });
    this.click.start(level * 0.8, 0.003);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    this.modes.render(out, count);
    if (this.click.sounding) this.click.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && this.modes.level() < VOICE_SLEEP_LEVEL && !this.click.sounding) this.sleep();
  }

  sleep(): void {
    this.modes.sleep();
    this.click.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.click.forEachState(visit);
  }
}

/* --------------------------------------------------------------- brushes */

/** A brush sweep's hiss runs from this level of the hand's speed... */
const SWEEP_LOW_HZ = 1700;
/** ...to this, at its fastest. */
const SWEEP_HIGH_HZ = 4600;

/**
 * A wire brush swept across the snare head: a hiss whose loudness and
 * brightness follow the speed of the hand, which rises and falls once over
 * the sweep with a push at its start. Sweeps overlap, as two hands do.
 */
export class BrushSweep implements DrumVoice {
  active = false;
  private readonly sampleRate: number;
  private readonly random: Random;
  private readonly band = new Biquad();
  private readonly air = new Biquad();
  /** Up to two sweeps at once: one finishing as the next begins. */
  private readonly position = new Float64Array(2);
  private readonly length = new Float64Array(2);
  private readonly level = new Float64Array(2);
  private next = 0;
  private speed = 0;
  private target = 0;
  private tick = 0;
  private readonly smoothing: number;

  constructor(sampleRate: number, random: Random) {
    this.sampleRate = sampleRate;
    this.random = random;
    this.band.setBandpass(SWEEP_LOW_HZ, 0.8, sampleRate);
    this.air.setHighpass(5200, 0.707, sampleRate);
    this.smoothing = 1 - Math.exp(-1 / (0.005 * sampleRate));
  }

  /** Sweep for `seconds`, at a strength set by `velocity`. */
  sweep(velocity: number, seconds: number, variation: StrokeVariation): void {
    const slot = this.next;
    this.next = 1 - slot;
    this.position[slot] = 0;
    this.length[slot] = Math.max(0.03, seconds) * this.sampleRate;
    this.level[slot] = strength(velocity, 1.3) * (1 + 0.08 * variation.level);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    const { band, air, random, position, length, level, sampleRate, smoothing } = this;
    let { speed, target, tick } = this;
    for (let i = 0; i < count; i++) {
      // The hand's speed is worked out every 32 samples and smoothed in between.
      if ((tick & 31) === 0) {
        target = 0;
        for (let slot = 0; slot < 2; slot++) {
          if (level[slot] === 0) continue;
          const through = position[slot] / length[slot];
          if (through >= 1) {
            level[slot] = 0;
            continue;
          }
          // each sweep is one push: quick to its fastest, then a slower fall to the end of the stroke
          const shape = through < 0.18 ? Math.sin((Math.PI * through) / 0.36) : Math.cos((Math.PI * (through - 0.18)) / 1.64) ** 1.6;
          target += level[slot] * shape;
          position[slot] += 32;
        }
        // the hiss follows the speed in brightness as well as in level
        band.setBandpass(SWEEP_LOW_HZ + (SWEEP_HIGH_HZ - SWEEP_LOW_HZ) * Math.min(1, speed * 1.4), 0.8, sampleRate);
      }
      tick++;
      speed += smoothing * (target - speed);
      const noise = random.bipolar();
      out[i] += speed * (band.process(noise) * 0.9 + air.process(noise) * 0.16 * speed);
    }
    this.speed = speed;
    this.target = target;
    this.tick = tick & 0xffff;
  }

  /** The hiss as it is now, for the snare drum to answer: the kit feeds it to the snare's own modes. */
  get strength(): number {
    return this.speed;
  }

  settle(): void {
    if (this.active && this.level[0] === 0 && this.level[1] === 0 && this.speed < VOICE_SLEEP_LEVEL) this.sleep();
  }

  sleep(): void {
    this.position.fill(0);
    this.length.fill(0);
    this.level.fill(0);
    this.speed = 0;
    this.target = 0;
    this.tick = 0;
    this.band.reset();
    this.air.reset();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    visit(this.speed);
    visit(this.target);
    this.band.state().forEach(visit);
    this.air.state().forEach(visit);
  }
}
