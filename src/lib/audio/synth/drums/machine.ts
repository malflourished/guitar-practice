/**
 * The machine kit's voices: a drum machine in the early-1980s analogue
 * tradition (docs/sound/drums.md, "The classic designs").
 *
 * Nothing here imitates a recording. Each voice is the kind of small circuit
 * those machines used, written as arithmetic: a tone swept down in pitch for
 * a drum's body, filtered noise for its snap, and six square waves at
 * unrelated pitches through two band-pass filters for everything metal. The
 * tunings and envelopes are our own, not a copy of any one machine.
 */
import { Biquad } from '../dsp/biquad';
import type { Random } from '../dsp/random';
import { VOICE_SLEEP_LEVEL, type DrumVoice, type StrokeVariation } from './membranes';

const TWO_PI = 2 * Math.PI;
/** A retriggered voice fades its old sound out over this long, so the restart does not click. */
const RETRIGGER_SECONDS = 0.002;

/** The per-sample factor that makes a level fall by 60 dB in `seconds`. */
function fadeFor(seconds: number, sampleRate: number): number {
  return Math.exp(-6.907755 / (Math.max(0.001, seconds) * sampleRate));
}

/** The per-sample factor of a time constant: a level falls to 37% in `seconds`. */
function timeConstant(seconds: number, sampleRate: number): number {
  return Math.exp(-1 / (Math.max(0.0002, seconds) * sampleRate));
}

/** A soft clipper: straight for small signals, flattening smoothly to ±2/3 at ±1 and beyond. */
export function softClip(x: number): number {
  if (x >= 1) return 2 / 3;
  if (x <= -1) return -2 / 3;
  return x - (x * x * x) / 3;
}

function strength(velocity: number, exponent: number): number {
  return Math.min(1, Math.max(0, velocity)) ** exponent;
}

/**
 * One tone whose pitch starts high and falls to rest: the body of every drum
 * in the kit. It restarts from silence on each stroke, as a triggered
 * circuit does, with the old sound faded out underneath.
 */
class SweptTone {
  level = 0;
  private phase = 0;
  private fade = 0;
  private sweep = 0;
  private sweepStep = 0;
  private sag = 0;
  private sagStep = 0;
  private hz = 100;
  private tail = 0;
  private tailStep = 0;
  private last = 0;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  /**
   * Start the tone at `level`, to fall by 60 dB in `seconds`. Its pitch
   * begins a fraction `sweep` above `hz` (1 is twice the frequency, an
   * octave up) and falls with a time constant of `sweepSeconds`; `sag` is a
   * smaller, slower fall under that.
   */
  start(hz: number, level: number, seconds: number, sweep: number, sweepSeconds: number, sag = 0, sagSeconds = 0.15): void {
    const { sampleRate } = this;
    this.tail = this.last;
    this.tailStep = this.tail / Math.max(1, Math.round(RETRIGGER_SECONDS * sampleRate));
    this.hz = hz;
    this.level = level;
    this.fade = fadeFor(seconds, sampleRate);
    this.sweep = sweep;
    this.sweepStep = timeConstant(sweepSeconds, sampleRate);
    this.sag = sag;
    this.sagStep = timeConstant(sagSeconds, sampleRate);
    this.phase = 0;
  }

  get sounding(): boolean {
    return this.level > 0 || this.tail !== 0;
  }

  /** Add the tone to `out`, pushed through a soft clipper by `drive` (1 is clean). */
  render(out: Float64Array, count: number, drive: number): void {
    const { fade, sweepStep, sagStep, hz, sampleRate } = this;
    const limit = sampleRate * 0.45;
    const makeup = 1 / drive;
    let { phase, level, sweep, sag, tail, last } = this;
    const tailStep = this.tailStep;
    for (let i = 0; i < count; i++) {
      const frequency = Math.min(limit, hz * (1 + sweep + sag));
      phase += frequency / sampleRate;
      if (phase >= 1) phase -= 1;
      last = softClip(drive * level * Math.sin(TWO_PI * phase)) * makeup;
      let sample = last;
      if (tail !== 0) {
        sample += tail;
        const next = tail - tailStep;
        tail = next * tail <= 0 ? 0 : next;
      }
      out[i] += sample;
      level *= fade;
      sweep *= sweepStep;
      sag *= sagStep;
    }
    this.phase = phase;
    this.level = level < 1e-7 ? 0 : level;
    this.sweep = sweep < 1e-9 ? 0 : sweep;
    this.sag = sag < 1e-9 ? 0 : sag;
    this.tail = tail;
    this.last = this.level === 0 ? 0 : last;
  }

  sleep(): void {
    this.level = this.sweep = this.sag = this.tail = this.last = this.phase = 0;
  }

  forEachState(visit: (value: number) => void): void {
    [this.level, this.sweep, this.sag, this.tail, this.last, this.phase].forEach(visit);
  }
}

/** Noise through a high-pass and a low-pass, under a fade: the snap of a snare, a tom's breath, a click. */
class ShapedNoise {
  level = 0;
  private fade = 0;
  private readonly low = new Biquad();
  private readonly high = new Biquad();
  private readonly sampleRate: number;

  constructor(sampleRate: number, lowHz: number, highHz: number) {
    this.sampleRate = sampleRate;
    this.shape(lowHz, highHz);
  }

  shape(lowHz: number, highHz: number): void {
    this.low.setHighpass(lowHz, 0.707, this.sampleRate);
    this.high.setLowpass(highHz, 0.707, this.sampleRate);
  }

  start(level: number, seconds: number): void {
    this.level = Math.max(this.level, level);
    this.fade = fadeFor(seconds, this.sampleRate);
  }

  get sounding(): boolean {
    return this.level > 0 || this.high.magnitude() > VOICE_SLEEP_LEVEL;
  }

  render(out: Float64Array, count: number, random: Random): void {
    const { low, high, fade } = this;
    let level = this.level;
    for (let i = 0; i < count; i++) {
      out[i] += high.process(low.process(level * random.bipolar()));
      level *= fade;
    }
    this.level = level < 1e-7 ? 0 : level;
  }

  sleep(): void {
    this.level = 0;
    this.low.reset();
    this.high.reset();
  }

  forEachState(visit: (value: number) => void): void {
    visit(this.level);
    this.low.state().forEach(visit);
    this.high.state().forEach(visit);
  }
}

/* ------------------------------------------------------------------ kick */

export interface MachineKickSettings {
  hz: number;
  decay: number;
  punch: number;
}

/**
 * The kick: one tone at the drum's resting pitch, which for its first few
 * hundredths of a second is swept down from well over an octave above (the
 * punch), then sags a little as it dies. A short click starts it.
 */
export class MachineKick implements DrumVoice {
  active = false;
  private readonly tone: SweptTone;
  private readonly click: ShapedNoise;
  private readonly random: Random;
  private settings: MachineKickSettings;
  private drive = 1.4;

  constructor(sampleRate: number, settings: MachineKickSettings, random: Random) {
    this.tone = new SweptTone(sampleRate);
    this.click = new ShapedNoise(sampleRate, 900, 6500);
    this.random = random;
    this.settings = settings;
  }

  configure(settings: MachineKickSettings): void {
    this.settings = settings;
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const { hz, decay, punch } = this.settings;
    const level = strength(velocity, 1.5) * (1 + 0.04 * variation.level);
    const hard = Math.min(1, velocity);
    // An accent drives the circuit harder: more punch and a little more grit.
    this.drive = 1.2 + 0.8 * hard;
    this.tone.start(hz, level, decay, (0.8 + 3.2 * punch) * (0.5 + 0.5 * hard), 0.011 + 0.006 * (1 - punch), 0.07, 0.16);
    this.click.start(level * (0.15 + 0.85 * punch) * 0.7, 0.006);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    if (this.tone.sounding) this.tone.render(out, count, this.drive);
    if (this.click.sounding) this.click.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && !this.tone.sounding && !this.click.sounding) this.sleep();
  }

  sleep(): void {
    this.tone.sleep();
    this.click.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.tone.forEachState(visit);
    this.click.forEachState(visit);
  }
}

/* ----------------------------------------------------------------- snare */

export interface MachineSnareSettings {
  hz: number;
  wires: number;
  decay: number;
}

/** The second tone sits this far above the first: not an octave, so the drum has a colour and no note. */
const SNARE_UPPER_RATIO = 1.83;

/** The snare: two short swept tones for the shell, and a burst of bright noise for the wires. */
export class MachineSnare implements DrumVoice {
  active = false;
  private readonly lower: SweptTone;
  private readonly upper: SweptTone;
  private readonly snap: ShapedNoise;
  private readonly random: Random;
  private settings: MachineSnareSettings;

  constructor(sampleRate: number, settings: MachineSnareSettings, random: Random) {
    this.lower = new SweptTone(sampleRate);
    this.upper = new SweptTone(sampleRate);
    this.snap = new ShapedNoise(sampleRate, 1700, 9000);
    this.random = random;
    this.settings = settings;
  }

  configure(settings: MachineSnareSettings): void {
    this.settings = settings;
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const { hz, wires, decay } = this.settings;
    const hard = Math.min(1, velocity);
    const vary = 1 + 0.04 * variation.level;
    const body = strength(velocity, 1.7) * vary * (1 - 0.4 * wires);
    this.lower.start(hz, body * 0.85, 0.13, 0.5 * hard, 0.009);
    this.upper.start(hz * SNARE_UPPER_RATIO, body * 0.5, 0.085, 0.4 * hard, 0.007);
    // The snap answers velocity less steeply than the body, so a soft stroke is mostly snap.
    this.snap.shape(1700, 5200 + 5000 * hard);
    this.snap.start(strength(velocity, 1.2) * vary * wires * 1.35, decay * (0.5 + 0.5 * hard));
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    if (this.lower.sounding) this.lower.render(out, count, 1.3);
    if (this.upper.sounding) this.upper.render(out, count, 1.3);
    if (this.snap.sounding) this.snap.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && !this.lower.sounding && !this.upper.sounding && !this.snap.sounding) this.sleep();
  }

  sleep(): void {
    this.lower.sleep();
    this.upper.sleep();
    this.snap.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.lower.forEachState(visit);
    this.upper.forEachState(visit);
    this.snap.forEachState(visit);
  }
}

/* ------------------------------------------------------------------ toms */

/** A tom: a tone that falls most of an octave as it sounds (the electronic tom of the decade), with a breath of noise. */
export class MachineTom implements DrumVoice {
  active = false;
  private readonly tone: SweptTone;
  private readonly breath: ShapedNoise;
  private readonly random: Random;
  private readonly hz: number;
  private readonly seconds: number;

  constructor(sampleRate: number, hz: number, seconds: number, random: Random) {
    this.tone = new SweptTone(sampleRate);
    this.breath = new ShapedNoise(sampleRate, 500, 4500);
    this.random = random;
    this.hz = hz;
    this.seconds = seconds;
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const level = strength(velocity, 1.5) * (1 + 0.04 * variation.level);
    const hard = Math.min(1, velocity);
    this.tone.start(this.hz, level, this.seconds, 0.75 * (0.5 + 0.5 * hard), 0.055);
    this.breath.start(level * 0.22, 0.05);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    if (this.tone.sounding) this.tone.render(out, count, 1.3);
    if (this.breath.sounding) this.breath.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && !this.tone.sounding && !this.breath.sounding) this.sleep();
  }

  sleep(): void {
    this.tone.sleep();
    this.breath.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.tone.forEachState(visit);
    this.breath.forEachState(visit);
  }
}

/* ------------------------------------------------------------------- rim */

/** The rim: two very short high tones and a tick. Closer to a clave than to a drum. */
export class MachineRim implements DrumVoice {
  active = false;
  private readonly high: SweptTone;
  private readonly low: SweptTone;
  private readonly tick: ShapedNoise;
  private readonly random: Random;

  constructor(sampleRate: number, random: Random) {
    this.high = new SweptTone(sampleRate);
    this.low = new SweptTone(sampleRate);
    this.tick = new ShapedNoise(sampleRate, 2500, 11000);
    this.random = random;
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const level = strength(velocity, 1.4) * (1 + 0.04 * variation.level);
    this.high.start(1730, level * 0.8, 0.035, 0.04, 0.003);
    this.low.start(520, level * 0.45, 0.03, 0.04, 0.003);
    this.tick.start(level * 0.5, 0.004);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    if (this.high.sounding) this.high.render(out, count, 1.6);
    if (this.low.sounding) this.low.render(out, count, 1.6);
    if (this.tick.sounding) this.tick.render(out, count, this.random);
  }

  settle(): void {
    if (this.active && !this.high.sounding && !this.low.sounding && !this.tick.sounding) this.sleep();
  }

  sleep(): void {
    this.high.sleep();
    this.low.sleep();
    this.tick.sleep();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.high.forEachState(visit);
    this.low.forEachState(visit);
    this.tick.forEachState(visit);
  }
}

/* ----------------------------------------------------------------- metal */

/**
 * Six square waves at pitches with no simple relation to each other. Their
 * fundamentals are low and are filtered away; what is used is the crowd of
 * their upper harmonics between 3 and 9 kHz, which beat against each other
 * like the modes of a small piece of metal.
 */
const CLUSTER_HZ = [211, 298, 367, 439, 547, 811];
/** The two bands the cluster is heard through, in hertz. */
const METAL_LOW_BAND_HZ = 3400;
const METAL_HIGH_BAND_HZ = 7300;

/** The six oscillators, shared by the hi-hat, the ride and the crash. They run only while one of those sounds. */
export class SquareCluster {
  /** The cluster's sum over the stretch last asked for. */
  readonly buffer = new Float64Array(128);
  private readonly phase = new Float64Array(CLUSTER_HZ.length);
  private readonly step = new Float64Array(CLUSTER_HZ.length);

  constructor(sampleRate: number, random: Random) {
    CLUSTER_HZ.forEach((hz, i) => {
      this.step[i] = hz / sampleRate;
      this.phase[i] = random.next(); // free-running: no two strokes catch them in the same place
    });
  }

  /** Fill `buffer[0..count)` with the next samples. */
  fill(count: number): void {
    const { buffer, phase, step } = this;
    buffer.fill(0, 0, count);
    for (let k = 0; k < phase.length; k++) {
      const dt = step[k];
      let p = phase[k];
      for (let i = 0; i < count; i++) {
        // a square wave with its two edges smoothed just enough not to alias (polyBLEP)
        let value = p < 0.5 ? 1 : -1;
        if (p < dt) {
          const t = p / dt;
          value += t + t - t * t - 1;
        } else if (p > 1 - dt) {
          const t = (p - 1) / dt;
          value += t * t + t + t + 1;
        }
        const q = p < 0.5 ? p + 0.5 : p - 0.5;
        if (q < dt) {
          const t = q / dt;
          value -= t + t - t * t - 1;
        } else if (q > 1 - dt) {
          const t = (q - 1) / dt;
          value -= t * t + t + t + 1;
        }
        buffer[i] += value;
        p += dt;
        if (p >= 1) p -= 1;
      }
      phase[k] = p;
    }
    for (let i = 0; i < count; i++) buffer[i] *= 1 / 6;
  }

  forEachState(visit: (value: number) => void): void {
    this.phase.forEach(visit);
  }
}

/** One stroke on a metal channel: the level and length (60 dB) of each band. */
export interface MetalStroke {
  low: number;
  lowSeconds: number;
  high: number;
  highSeconds: number;
}

/**
 * One metal sound: the cluster through a low and a high band-pass, each band
 * with its own fade, then a high-pass. A new stroke replaces the old one, so
 * a closed hi-hat chokes an open one.
 */
export class MetalChannel implements DrumVoice {
  active = false;
  private readonly cluster: SquareCluster;
  private readonly lowBand = new Biquad();
  private readonly highBand = new Biquad();
  private readonly highpass = new Biquad();
  private readonly sampleRate: number;
  private low = 0;
  private high = 0;
  private lowFade = 0;
  private highFade = 0;
  /** A fast ramp at the start of a stroke, so that replacing a ringing sound does not click. */
  private rise = 1;
  private riseStep = 0;

  constructor(sampleRate: number, cluster: SquareCluster, highpassHz: number) {
    this.sampleRate = sampleRate;
    this.cluster = cluster;
    this.lowBand.setBandpass(METAL_LOW_BAND_HZ, 2.2, sampleRate);
    this.highBand.setBandpass(METAL_HIGH_BAND_HZ, 2.6, sampleRate);
    this.highpass.setHighpass(highpassHz, 0.707, sampleRate);
    this.riseStep = 1 / Math.max(1, Math.round(0.0004 * sampleRate));
  }

  strike(stroke: MetalStroke): void {
    this.low = stroke.low;
    this.high = stroke.high;
    this.lowFade = fadeFor(stroke.lowSeconds, this.sampleRate);
    this.highFade = fadeFor(stroke.highSeconds, this.sampleRate);
    this.rise = 0;
    this.active = true;
  }

  /** Add the channel to `out`. The cluster must have been filled for this stretch first. */
  render(out: Float64Array, count: number): void {
    const source = this.cluster.buffer;
    const { lowBand, highBand, highpass, lowFade, highFade, riseStep } = this;
    let { low, high, rise } = this;
    for (let i = 0; i < count; i++) {
      const x = source[i];
      const mixed = rise * (low * lowBand.process(x) + high * highBand.process(x));
      out[i] += highpass.process(mixed);
      low *= lowFade;
      high *= highFade;
      if (rise < 1) rise = Math.min(1, rise + riseStep);
    }
    this.low = low < 1e-7 ? 0 : low;
    this.high = high < 1e-7 ? 0 : high;
    this.rise = rise;
  }

  settle(): void {
    if (this.active && this.low === 0 && this.high === 0 && this.highpass.magnitude() < VOICE_SLEEP_LEVEL) this.sleep();
  }

  sleep(): void {
    this.low = this.high = 0;
    this.rise = 1;
    this.lowBand.reset();
    this.highBand.reset();
    this.highpass.reset();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    [this.low, this.high].forEach(visit);
    this.lowBand.state().forEach(visit);
    this.highBand.state().forEach(visit);
    this.highpass.state().forEach(visit);
  }
}

/* ------------------------------------------------------- the gated burst */

/**
 * The gated room of early-1980s records, made directly: when the snare or a
 * tom is struck, a dense burst of noise in the room's band holds for a
 * moment and is then cut off, a different burst in each ear.
 */
export class GatedBurst {
  active = false;
  private readonly sampleRate: number;
  private readonly random: Random;
  private readonly left = new Biquad();
  private readonly right = new Biquad();
  private readonly leftTop = new Biquad();
  private readonly rightTop = new Biquad();
  private level = 0;
  private target = 0;
  private hold = 0;
  private readonly attack: number;
  private readonly sag: number;
  private readonly release: number;

  constructor(sampleRate: number, random: Random) {
    this.sampleRate = sampleRate;
    this.random = random;
    for (const filter of [this.left, this.right]) filter.setHighpass(420, 0.707, sampleRate);
    for (const filter of [this.leftTop, this.rightTop]) filter.setLowpass(5200, 0.707, sampleRate);
    this.attack = 1 - timeConstant(0.003, sampleRate);
    this.sag = timeConstant(0.22, sampleRate);
    this.release = timeConstant(0.006, sampleRate);
  }

  /** Open the gate at `level` for `seconds`. */
  trigger(level: number, seconds: number): void {
    if (level <= 0) return;
    this.target = Math.max(this.target, level);
    this.hold = Math.max(this.hold, Math.round(seconds * this.sampleRate));
    this.active = true;
  }

  /** Add the burst to the two outputs. */
  render(left: Float64Array, right: Float64Array, count: number): void {
    const { random, attack, sag, release } = this;
    let { level, target, hold } = this;
    for (let i = 0; i < count; i++) {
      if (hold > 0) {
        hold--;
        level += attack * (target - level);
        target *= sag; // the room dies a little under the gate before it shuts
      } else {
        target = 0;
        level *= release;
      }
      left[i] += this.leftTop.process(this.left.process(level * random.bipolar()));
      right[i] += this.rightTop.process(this.right.process(level * random.bipolar()));
    }
    this.level = level < 1e-7 && hold === 0 ? 0 : level;
    this.target = target;
    this.hold = hold;
  }

  settle(): void {
    if (this.active && this.level === 0 && this.hold === 0 && this.leftTop.magnitude() + this.rightTop.magnitude() < VOICE_SLEEP_LEVEL) {
      this.sleep();
    }
  }

  sleep(): void {
    this.level = this.target = 0;
    this.hold = 0;
    for (const filter of [this.left, this.right, this.leftTop, this.rightTop]) filter.reset();
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    [this.level, this.target].forEach(visit);
    for (const filter of [this.left, this.right, this.leftTop, this.rightTop]) filter.state().forEach(visit);
  }
}
