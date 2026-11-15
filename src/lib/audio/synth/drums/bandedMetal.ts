/**
 * Cymbals and hi-hats for the S2.1 kits: a thousand partials each, and the
 * way a cymbal's energy moves between them.
 *
 * The partials are in tables, one for each band of frequencies
 * (`metalTable.ts`). A cymbal here is the energy in each band:
 *
 * - a stroke puts energy in, mostly low and in the middle;
 * - while the cymbal is loud, energy climbs from each band to the one above.
 *   That is the bloom of a crash and the hiss a ride builds when it is leaned
 *   on, and it is why a hard stroke is a brighter sound and not a louder one.
 *   On real metal it is the modes feeding each other (docs/sound/drums.md);
 * - each band dies at its own rate, the top first;
 * - the bands trade a little energy at random, so the sound never sits still.
 *
 * A cymbal is one object that keeps ringing: strokes add to it, and the
 * hi-hat's foot is its damping. The tables play on from wherever they are,
 * so no two strokes start alike. Each cymbal is stereo: the same partials
 * read from two places in the table are unrelated sounds, and the difference
 * between them is the width a pair of overhead microphones gives.
 */
import type { Random } from '../dsp/random';
import { MembraneModes, NoiseBurst, VOICE_SLEEP_LEVEL, type DrumVoice, type StrokeVariation } from './membranes';
import { metalTables, type MetalRecipe, type MetalTables } from './metalTable';

/** The bands' levels are worked out this often, in samples, and glide in between. */
const CONTROL = 16;
/** A band with less energy than this has none. */
const ENERGY_FLOOR = 1e-14;
/** The bands trade up to this share of their energy at each step. */
const EXCHANGE = 0.05;
/**
 * Energy climbs more slowly the higher it has got: the top of a cymbal is
 * where it is lost, not where it gathers. Each band's rate of climb is this
 * share of the one below.
 */
const CLIMB_TAPER = 0.5;

/** A drum voice with two ears. The kit plays `renderStereo` when a voice has it. */
export interface StereoDrumVoice extends DrumVoice {
  renderStereo(left: Float64Array, right: Float64Array, count: number): void;
}

export class BandedMetal {
  active = false;
  readonly bandCount: number;
  private readonly sampleRate: number;
  private readonly tables: MetalTables;
  private readonly mask: number;
  private readonly sideOffset: number;
  private readonly random: Random;
  private readonly energy: Float64Array;
  private readonly feed: Float64Array;
  private readonly gain: Float64Array;
  private readonly target: Float64Array;
  private readonly step: Float64Array;
  private readonly decay: Float64Array;
  private readonly voicing: Float64Array;
  private readonly climb: Float64Array;
  private riseShare = 0;
  private cascadeShare = 0;
  private cascadeLevel = 1;
  private midGain = 1;
  private sideGain = 0;
  private phase = 0;
  private position = 0;

  constructor(sampleRate: number, recipe: MetalRecipe, random: Random) {
    this.sampleRate = sampleRate;
    this.tables = metalTables(recipe, sampleRate);
    this.mask = this.tables.size - 1;
    this.sideOffset = (this.tables.size >> 1) + 4099;
    this.random = random.fork();
    const count = this.tables.bands.length;
    this.bandCount = count;
    this.energy = new Float64Array(count);
    this.feed = new Float64Array(count);
    this.gain = new Float64Array(count);
    this.target = new Float64Array(count);
    this.step = new Float64Array(count);
    this.decay = new Float64Array(count).fill(1);
    this.voicing = new Float64Array(count).fill(1);
    this.climb = new Float64Array(count);
    for (let b = 0; b < count; b++) this.climb[b] = CLIMB_TAPER ** b;
  }

  /**
   * `voicing` is each band's level in the sound. `cascade` is how fast energy
   * climbs to the next band, as a rate per second, once the cymbal holds
   * `cascadeLevel` of energy or more. `width` is how different the two ears are, 0 to 1.
   */
  voice(voicing: readonly number[], cascade: number, cascadeLevel: number, width: number): void {
    for (let b = 0; b < this.bandCount; b++) this.voicing[b] = voicing[b] ?? 1;
    this.cascadeShare = cascade > 0 ? 1 - Math.exp((-CONTROL * cascade) / this.sampleRate) : 0;
    this.cascadeLevel = Math.max(1e-9, cascadeLevel);
    const scale = 1 / Math.sqrt(1 + width * width);
    this.midGain = scale;
    this.sideGain = width * scale;
  }

  /** How long each band rings: `seconds[b] * scale` to fall by 60 dB, from now on. This is also the hi-hat's foot. */
  ring(seconds: readonly number[], scale: number): void {
    for (let b = 0; b < this.bandCount; b++) {
      const t60 = Math.max(0.004, (seconds[b] ?? 1) * scale);
      this.decay[b] = Math.exp((-13.815511 * CONTROL) / (t60 * this.sampleRate));
    }
  }

  /**
   * A stroke: `now[b] * amount` of energy in each band at once, and
   * `later[b] * lateAmount` arriving over `riseSeconds`.
   */
  strike(now: ArrayLike<number>, amount: number, later: ArrayLike<number> | null, lateAmount: number, riseSeconds: number): void {
    if (!this.active) {
      // a cymbal at rest starts anywhere in its tables: no two first strokes alike
      this.position = Math.floor(this.random.next() * this.tables.size);
    }
    for (let b = 0; b < this.bandCount; b++) {
      this.energy[b] += Math.max(0, now[b] * amount);
      if (later) this.feed[b] += Math.max(0, later[b] * lateAmount);
      // the stroke is heard on this very sample: the band's level steps up to it
      const level = Math.sqrt(this.energy[b]) * this.voicing[b];
      if (level > this.gain[b]) this.gain[b] = level;
      this.target[b] = this.gain[b];
      this.step[b] = 0;
    }
    this.riseShare = 1 - Math.exp(-CONTROL / (Math.max(0.001, riseSeconds) * this.sampleRate));
    this.phase = 0;
    this.active = true;
  }

  /** The energy the cymbal holds, all bands together. */
  held(): number {
    let total = 0;
    for (let b = 0; b < this.bandCount; b++) total += this.energy[b] + this.feed[b];
    return total;
  }

  render(left: Float64Array, right: Float64Array, count: number): void {
    const { tables, mask, sideOffset, gain, step, midGain, sideGain } = this;
    let done = 0;
    while (done < count) {
      if (this.phase === 0) this.control();
      const chunk = Math.min(count - done, CONTROL - this.phase);
      const end = done + chunk;
      for (let b = 0; b < this.bandCount; b++) {
        let level = gain[b];
        const change = step[b];
        if (level === 0 && change === 0) continue;
        const table = tables.bands[b];
        let p = this.position;
        for (let i = done; i < end; i++) {
          level += change;
          const mid = table[p & mask] * midGain;
          const side = table[(p + sideOffset) & mask] * sideGain;
          left[i] += level * (mid + side);
          right[i] += level * (mid - side);
          p++;
        }
        gain[b] = level;
      }
      this.position = (this.position + chunk) & mask;
      this.phase = (this.phase + chunk) % CONTROL;
      done = end;
    }
  }

  settle(): void {
    if (!this.active) return;
    for (let b = 0; b < this.bandCount; b++) {
      if (this.energy[b] !== 0 || this.feed[b] !== 0 || this.gain[b] !== 0 || this.target[b] !== 0) return;
    }
    this.sleep();
  }

  sleep(): void {
    this.energy.fill(0);
    this.feed.fill(0);
    this.gain.fill(0);
    this.target.fill(0);
    this.step.fill(0);
    this.phase = 0;
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    // (where the tables are being read is not something that decays)
    this.energy.forEach(visit);
    this.feed.forEach(visit);
    this.gain.forEach(visit);
    this.target.forEach(visit);
    this.step.forEach(visit);
  }

  /** One step of the cymbal's life: energy arrives, climbs, is traded and dies; then each band's level is aimed at it. */
  private control(): void {
    const { energy, feed, gain, target, step, decay, voicing, bandCount, riseShare, random } = this;
    let total = 0;
    for (let b = 0; b < bandCount; b++) {
      gain[b] = target[b]; // land exactly where the last glide was aimed
      const arriving = feed[b] * riseShare;
      feed[b] = feed[b] - arriving < ENERGY_FLOOR ? 0 : feed[b] - arriving;
      energy[b] = energy[b] * decay[b] + arriving;
      total += energy[b];
    }
    if (total > 0) {
      if (this.cascadeShare > 0) {
        // from the top down, so energy climbs one band at a step
        const share = this.cascadeShare * Math.min(1, total / this.cascadeLevel);
        for (let b = bandCount - 2; b >= 0; b--) {
          const flow = energy[b] * share * this.climb[b];
          energy[b] -= flow;
          energy[b + 1] += flow;
        }
      }
      for (let b = 0; b < bandCount - 1; b++) {
        const trade = EXCHANGE * random.bipolar() * Math.min(energy[b], energy[b + 1]);
        energy[b] += trade;
        energy[b + 1] -= trade;
      }
    }
    for (let b = 0; b < bandCount; b++) {
      if (energy[b] < ENERGY_FLOOR) energy[b] = 0;
      target[b] = Math.sqrt(energy[b]) * voicing[b];
      step[b] = (target[b] - gain[b]) / CONTROL;
    }
  }
}

/* ------------------------------------------------------------ the cymbals */

/** A stroke's energy from its velocity. */
function strokeEnergy(velocity: number, variation: StrokeVariation): number {
  const amplitude = Math.min(1, Math.max(0, velocity)) ** 1.5 * (1 + 0.08 * variation.level);
  return amplitude * amplitude;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** The stick's own sound on the metal: a short burst between two frequencies. */
export interface StickTick {
  lowHz: number;
  highHz: number;
  seconds: number;
  level: number;
}

/** What makes one cymbal: its partials, how its bands are balanced, how they ring and how energy climbs. */
export interface CymbalCharacter {
  recipe: MetalRecipe;
  /** Each band's level in the sound, and the level of the metal as a whole against the stick's own sound. */
  voicing: readonly number[];
  washLevel: number;
  /** Each band's ring as a share of the Cymbal ring control (for a hi-hat: in seconds, open). */
  ring: readonly number[];
  /** How fast energy climbs a band when the cymbal is loud, per second, and the energy that counts as loud. */
  cascade: number;
  cascadeLevel: number;
  /** How different the two ears are, 0 to 1. */
  width: number;
  /** Where a stroke's energy goes at once, band by band, and what arrives a moment later. */
  strike: readonly number[];
  bloom: readonly number[];
  bloomAmount: number;
  riseSeconds: number;
  /**
   * Decibels between the lowest band and the highest: `toneTilt` is how far
   * the Tone control leans the cymbal's voicing at either end of its travel,
   * `hardTilt` how much brighter a full stroke lands than a soft one.
   */
  toneTilt: number;
  hardTilt: number;
  tick: StickTick;
}

/**
 * The band-by-band shape of one stroke: the cymbal's own shape, tilted by
 * how hard the stroke is, and nudged at random as a stick landing somewhere
 * else would. The stroke's energy as a whole is left as it was: how bright a
 * stroke is must not change how much the cymbal has been given, since that
 * is what decides how far its energy climbs.
 */
function strokeShape(
  out: Float64Array,
  shape: ArrayLike<number>,
  tiltDb: number,
  variation: StrokeVariation,
  amount: number,
  random: Random,
): Float64Array {
  const middle = (out.length - 1) / 2;
  let before = 0;
  let after = 0;
  for (let b = 0; b < out.length; b++) {
    before += shape[b];
    const db = (tiltDb * (b - middle)) / (out.length - 1) + 2.5 * amount * random.bipolar() + 1.5 * variation.position * (b % 2 === 0 ? 1 : -1);
    out[b] = shape[b] * 10 ** (db / 10);
    after += out[b];
  }
  const keep = after > 0 ? before / after : 0;
  for (let b = 0; b < out.length; b++) out[b] *= keep;
  return out;
}

/** What a cymbal with a stick click shares: the metal, the click, and the two-eared render. */
abstract class TableCymbal implements StereoDrumVoice {
  active = false;
  protected readonly metal: BandedMetal;
  protected readonly tick: NoiseBurst;
  protected readonly random: Random;
  protected readonly shape: Float64Array;
  protected readonly character: CymbalCharacter;
  private readonly scratch = new Float64Array(128);
  private readonly foldLeft = new Float64Array(128);
  private readonly foldRight = new Float64Array(128);

  constructor(sampleRate: number, character: CymbalCharacter, random: Random) {
    this.character = character;
    this.metal = new BandedMetal(sampleRate, character.recipe, random);
    this.voiceTone(0.5);
    this.tick = new NoiseBurst(sampleRate, random);
    this.tick.between(character.tick.lowHz, character.tick.highHz);
    this.random = random.fork();
    this.shape = new Float64Array(this.metal.bandCount);
  }

  renderStereo(left: Float64Array, right: Float64Array, count: number): void {
    if (this.metal.active) this.metal.render(left, right, count);
    const { scratch } = this;
    let centred = false;
    scratch.fill(0, 0, count);
    if (this.tick.sounding) {
      this.tick.render(scratch, count);
      centred = true;
    }
    if (this.renderCentre(scratch, count)) centred = true;
    if (centred) {
      for (let i = 0; i < count; i++) {
        left[i] += scratch[i];
        right[i] += scratch[i];
      }
    }
  }

  /** The two ears folded into one, for a caller that has only one. */
  render(out: Float64Array, count: number): void {
    const { foldLeft, foldRight } = this;
    foldLeft.fill(0, 0, count);
    foldRight.fill(0, 0, count);
    this.renderStereo(foldLeft, foldRight, count);
    for (let i = 0; i < count; i++) out[i] += 0.5 * (foldLeft[i] + foldRight[i]);
  }

  settle(): void {
    if (!this.active) return;
    this.metal.settle();
    this.tick.settle();
    if (!this.metal.active && !this.tick.sounding && this.settleCentre()) this.sleep();
  }

  sleep(): void {
    this.metal.sleep();
    this.tick.sleep();
    this.sleepCentre();
    this.scratch.fill(0);
    this.foldLeft.fill(0);
    this.foldRight.fill(0);
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.metal.forEachState(visit);
    this.tick.forEachState(visit);
    this.scratch.forEach(visit);
    this.visitCentre(visit);
  }

  /** The Tone control: it leans the cymbal's voicing towards its top (1) or its bottom (0). */
  protected voiceTone(tone: number): void {
    const { character } = this;
    const last = character.voicing.length - 1;
    const voicing = character.voicing.map((level, b) => level * character.washLevel * 10 ** ((character.toneTilt * (tone - 0.5) * (b - last / 2)) / last / 10));
    this.metal.voice(voicing, character.cascade, character.cascadeLevel, character.width);
  }

  /** Anything else in the middle of the picture (a ride's ping, the clap of a hi-hat's foot). True if it added sound. */
  protected renderCentre(out: Float64Array, count: number): boolean {
    void out;
    void count;
    return false;
  }
  /** True once that has died away. */
  protected settleCentre(): boolean {
    return true;
  }
  protected sleepCentre(): void {}
  protected visitCentre(visit: (value: number) => void): void {
    void visit;
  }

  protected click(energy: number, hard: number): void {
    const { tick } = this.character;
    this.tick.start(Math.sqrt(energy) * tick.level * (0.4 + 0.6 * hard), tick.seconds);
  }
}

/** A hi-hat's character: the cymbal, and how its strokes and its foot differ. */
export interface HatCharacter extends CymbalCharacter {
  /** A stroke on the closed hats with the stick's tip, and with its shoulder (an accent): fuller and longer. */
  shoulder: readonly number[];
  /** A stroke on the open hats, and the foot closing them with no stick. */
  open: readonly number[];
  foot: readonly number[];
  /** Each band's ring with the hats closed, in seconds at Hat length 0.5. */
  closedRing: readonly number[];
  /** The clap of the two cymbals meeting under the foot: its pitch and level. */
  clapHz: number;
  clapLevel: number;
}

export class TableHiHat extends TableCymbal {
  private readonly hat: HatCharacter;
  private readonly clap: NoiseBurst;
  private length = 0.5;

  constructor(sampleRate: number, character: HatCharacter, random: Random) {
    super(sampleRate, character, random);
    this.hat = character;
    this.clap = new NoiseBurst(sampleRate, random);
    this.clap.band(character.clapHz, 1.1);
  }

  configure(tone: number, length: number): void {
    this.voiceTone(tone);
    this.length = length;
  }

  /** The stick on the closed hats. A harder stroke uses the shoulder: fuller, and a little longer. */
  closed(velocity: number, variation: StrokeVariation, amount: number): void {
    const { hat, metal } = this;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const accent = clamp01((hard - 0.55) / 0.35);
    const energy = strokeEnergy(velocity, variation);
    for (let b = 0; b < this.shape.length; b++) this.shape[b] = hat.strike[b] + (hat.shoulder[b] - hat.strike[b]) * accent;
    strokeShape(this.shape, this.shape, this.tilt(hard), variation, amount, this.random);
    metal.ring(hat.closedRing, (0.55 + 0.9 * this.length) * (1 + 0.5 * accent));
    metal.strike(this.shape, energy, null, 0, 0.01);
    this.click(energy, hard);
    this.active = true;
  }

  /** The stick on the open hats: they ring, and sizzle against each other, until something closes them. */
  open(velocity: number, variation: StrokeVariation, amount: number): void {
    const { hat, metal } = this;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const energy = strokeEnergy(velocity, variation);
    strokeShape(this.shape, hat.open, this.tilt(hard), variation, amount, this.random);
    metal.ring(hat.ring, 0.45 + 1.1 * this.length);
    metal.strike(this.shape, energy, hat.bloom, energy * hat.bloomAmount, hat.riseSeconds);
    this.click(energy, hard);
    this.active = true;
  }

  /** The foot alone: the cymbals clap shut. No stick, less treble, and whatever was ringing is choked. */
  foot(velocity: number, variation: StrokeVariation, amount: number): void {
    const { hat, metal } = this;
    const energy = strokeEnergy(velocity, variation) * 0.35;
    strokeShape(this.shape, hat.foot, this.tilt(0.5), variation, amount, this.random);
    metal.ring(hat.closedRing, 0.7 + 0.8 * this.length);
    metal.strike(this.shape, energy, null, 0, 0.01);
    this.clap.start(Math.sqrt(energy) * hat.clapLevel, 0.03);
    this.active = true;
  }

  protected renderCentre(out: Float64Array, count: number): boolean {
    if (!this.clap.sounding) return false;
    this.clap.render(out, count);
    return true;
  }

  protected settleCentre(): boolean {
    this.clap.settle();
    return !this.clap.sounding;
  }

  protected sleepCentre(): void {
    this.clap.sleep();
  }

  protected visitCentre(visit: (value: number) => void): void {
    this.clap.forEachState(visit);
  }

  private tilt(hard: number): number {
    return this.hat.hardTilt * (hard - 0.7);
  }
}

/** A ride's character: the cymbal, and the few clear partials of the stick's ping. */
export interface RideCharacter extends CymbalCharacter {
  ping: readonly { hz: number; level: number; seconds: number }[];
  pingLevel: number;
}

export class TableRide extends TableCymbal {
  private readonly ride: RideCharacter;
  private readonly ping: MembraneModes;

  constructor(sampleRate: number, character: RideCharacter, random: Random) {
    super(sampleRate, character, random);
    this.ride = character;
    this.ping = new MembraneModes(sampleRate, character.ping.length);
    this.configure(0.5, 2.2);
  }

  configure(tone: number, ringSeconds: number): void {
    this.voiceTone(tone);
    this.metal.ring(this.ride.ring, ringSeconds);
    this.ride.ping.forEach((partial, i) => this.ping.tune(i, partial.hz * (0.94 + 0.12 * tone), partial.seconds * (0.5 + ringSeconds / 4.4)));
  }

  /** The stick's tip on the bow: a ping, and a little more wash each time. */
  strike(velocity: number, variation: StrokeVariation, amount: number): void {
    const { ride, metal } = this;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const energy = strokeEnergy(velocity, variation);
    strokeShape(this.shape, ride.strike, ride.hardTilt * (hard - 0.7), variation, amount, this.random);
    metal.strike(this.shape, energy, ride.bloom, energy * ride.bloomAmount, ride.riseSeconds);
    const amplitude = Math.sqrt(energy) * ride.pingLevel;
    ride.ping.forEach((partial, i) => {
      // where the stick lands along the bow changes the balance of the ping
      const wobble = 1 + 0.35 * variation.position * (i % 2 === 0 ? 1 : -1);
      this.ping.push(i, amplitude * partial.level * wobble * (0.5 + 0.5 * hard) ** (i / 3));
    });
    this.click(energy, hard);
    this.active = true;
  }

  protected renderCentre(out: Float64Array, count: number): boolean {
    this.ping.render(out, count);
    return true;
  }

  protected settleCentre(): boolean {
    this.ping.flush();
    return this.ping.level() < VOICE_SLEEP_LEVEL;
  }

  protected sleepCentre(): void {
    this.ping.sleep();
  }

  protected visitCentre(visit: (value: number) => void): void {
    this.ping.forEachState(visit);
  }
}

export class TableCrash extends TableCymbal {
  constructor(sampleRate: number, character: CymbalCharacter, random: Random) {
    super(sampleRate, character, random);
    this.configure(0.5, 2.2);
  }

  configure(tone: number, ringSeconds: number): void {
    this.voiceTone(tone);
    this.metal.ring(this.character.ring, ringSeconds);
  }

  /** The stick's shoulder on the edge: a push into the low and middle bands, which blooms upwards. */
  strike(velocity: number, variation: StrokeVariation, amount: number): void {
    const { character, metal } = this;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const energy = strokeEnergy(velocity, variation);
    strokeShape(this.shape, character.strike, character.hardTilt * (hard - 0.7), variation, amount, this.random);
    metal.strike(this.shape, energy, character.bloom, energy * character.bloomAmount, character.riseSeconds);
    this.click(energy, hard);
    this.active = true;
  }
}
