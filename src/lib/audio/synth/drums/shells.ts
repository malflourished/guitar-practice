/**
 * The drums of the S2.1 kits: kick, snare and toms.
 *
 * They are built on the same drumhead model as the first kits
 * (`membranes.ts`), and each answers something the measurements of those
 * kits found wrong (docs/sound/drums.md, "Why the first kits fell short"):
 *
 * - **The kick has a beater.** A cluster of very short modes between 1 and
 *   6 kHz is the knock of the beater on the head, with a breath of felt noise
 *   under it. The drum is then pushed through its own gentle saturation,
 *   which adds harmonics at two and three times its pitch: the part of a
 *   kick that small speakers can carry.
 * - **The snare's wires are collisions, not hiss.** Each wire that slaps the
 *   head is one tiny impulse. Thousands a second at the stroke, which is the
 *   crack; then fewer and fewer as the head calms down, so the tail turns
 *   from a hiss into a rattle, as real wires do. The impulses are coloured by
 *   the resonances of the snare-side head, and timed by the head's own swing.
 * - **A backbeat can be a rimshot**: above a set strength the stick catches
 *   the hoop too, and the shell rings.
 * - **Electronic kits use the same parts**: one mode with a long pitch fall
 *   is a drum machine's kick or tom, and a clap can be layered on the snare.
 *
 * One `...Character` object says what a drum is; the kits (`studioKits.ts`)
 * hold a set of them each.
 */
import { Biquad } from '../dsp/biquad';
import type { Random } from '../dsp/random';
import {
  ENVELOPE_FLOOR,
  MembraneModes,
  NoiseBurst,
  noiseGain,
  VOICE_SLEEP_LEVEL,
  type DrumVoice,
  type KickSettings,
  type SnareSettings,
  type StrokeVariation,
} from './membranes';

/** One mode of a head, as a multiple of the drum's lowest. */
export interface ShellMode {
  ratio: number;
  /** Its share of a stroke. */
  level: number;
  /** Its ring as a share of the drum's own. */
  decay: number;
  /** How much a harder stroke favours it: 0 not at all. */
  order: number;
}

/** One short fixed mode: a beater's knock, a stick's tick, a hoop's ring. */
export interface FixedMode {
  hz: number;
  level: number;
  seconds: number;
  /** How much a harder stroke favours it. */
  order: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** A stroke's loudness from its velocity. */
function strength(velocity: number, exponent: number): number {
  return clamp01(velocity) ** exponent;
}

/** A smooth saturation: straight for small sounds, never past 1. */
function saturate(x: number): number {
  return x / Math.sqrt(1 + x * x);
}

/* ------------------------------------------------------------------ kick */

export interface KickCharacter {
  modes: readonly ShellMode[];
  /** How far a full stroke starts above the resting pitch, at Kick punch 0 and at 1 (0.5 is half as high again). */
  dropAtRest: number;
  dropAtPunch: number;
  /** How long the pitch takes to fall back, in seconds. */
  dropSeconds: number;
  /** The beater on the head: short modes, and their level at Kick punch 0.5. */
  knock: readonly FixedMode[];
  knockLevel: number;
  /** Felt or plastic noise under the knock: its band, length and level. */
  felt: { hz: number; q: number; seconds: number; level: number };
  /** How hard the drum drives its own saturation, 0 (clean) to 1. */
  warmth: number;
  /** The share of even harmonics in that saturation: the "air" of a real drum. */
  even: number;
}

export class ShellKick implements DrumVoice {
  active = false;
  private readonly character: KickCharacter;
  private readonly modes: MembraneModes;
  private readonly knock: MembraneModes;
  private readonly felt: NoiseBurst;
  private readonly buffer = new Float64Array(128);
  private settings: KickSettings;
  private readonly drive: number;

  constructor(sampleRate: number, character: KickCharacter, settings: KickSettings, random: Random) {
    this.character = character;
    this.modes = new MembraneModes(sampleRate, character.modes.length);
    this.knock = new MembraneModes(sampleRate, character.knock.length);
    this.felt = new NoiseBurst(sampleRate, random);
    this.felt.band(character.felt.hz, character.felt.q);
    character.knock.forEach((mode, i) => this.knock.tune(i, mode.hz, mode.seconds));
    this.drive = 0.35 + 1.5 * character.warmth;
    this.settings = settings;
    this.configure(settings);
  }

  configure(settings: KickSettings): void {
    this.settings = settings;
    this.character.modes.forEach((mode, i) => this.modes.tune(i, settings.hz * mode.ratio, settings.decay * mode.decay));
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const { character } = this;
    const { punch } = this.settings;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const level = strength(velocity, 1.5) * (1 + 0.06 * variation.level);
    // A harder stroke puts more into the upper modes: the beater leaves the head sooner.
    const brightness = 0.35 + 0.65 * hard;
    character.modes.forEach((mode, i) => {
      const wobble = 1 + 0.18 * variation.position * (i % 2 === 0 ? 1 : -1) * Math.min(1, i);
      this.modes.push(i, level * mode.level * brightness ** mode.order * wobble);
    });
    // The head stretches under the beater, so the pitch starts high and falls.
    this.modes.stretch((character.dropAtRest + (character.dropAtPunch - character.dropAtRest) * punch) * hard * hard, character.dropSeconds);
    // The beater's knock: stronger and brighter for a harder stroke, and never the same twice.
    const knock = level * character.knockLevel * (0.2 + 3.2 * punch * punch) * (0.3 + 0.7 * hard);
    character.knock.forEach((mode, i) => {
      const wobble = 1 + 0.45 * variation.position * (i % 2 === 0 ? -1 : 1) + 0.25 * variation.hardness * (i % 3 === 0 ? 1 : -0.5);
      this.knock.push(i, knock * mode.level * hard ** mode.order * wobble);
    });
    this.felt.start(knock * character.felt.level, character.felt.seconds);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    const { buffer, drive } = this;
    const even = this.character.even;
    buffer.fill(0, 0, count);
    this.modes.render(buffer, count);
    // The head and shell saturate; the knock rides on top, clean.
    const back = 1 / drive;
    for (let i = 0; i < count; i++) {
      const x = buffer[i] * drive;
      buffer[i] = saturate(x + even * x * x) * back;
    }
    this.knock.render(buffer, count);
    if (this.felt.sounding) this.felt.render(buffer, count);
    for (let i = 0; i < count; i++) out[i] += buffer[i];
  }

  settle(): void {
    if (!this.active) return;
    this.felt.settle();
    this.modes.flush();
    this.knock.flush();
    if (this.modes.level() < VOICE_SLEEP_LEVEL && this.knock.level() < VOICE_SLEEP_LEVEL && !this.felt.sounding) this.sleep();
  }

  sleep(): void {
    this.modes.sleep();
    this.knock.sleep();
    this.felt.sleep();
    this.buffer.fill(0);
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.knock.forEachState(visit);
    this.felt.forEachState(visit);
    this.buffer.forEach(visit);
  }
}

/* ----------------------------------------------------------------- snare */

/** One mode of the snare's batter head. `edge` is how much an off-centre stroke favours it (negative: a centre stroke does). */
export interface SnareMode {
  ratio: number;
  level: number;
  seconds: number;
  order: number;
  edge: number;
}

export interface WireCharacter {
  /** The wires' level against the head. */
  level: number;
  /** The wires' sound lies between these, in hertz; a soft stroke lowers the top. */
  lowHz: number;
  highHz: number;
  /** Two resonances of the snare-side head and the shell that colour them. */
  bodyHz: number;
  bodyLevel: number;
  presenceHz: number;
  presenceLevel: number;
  /** The snap at the stroke: its level against the sizzle that follows, and how long it lasts. */
  snapLevel: number;
  snapSeconds: number;
  /** Collisions a second while the wires are thrown hard, and when they have nearly settled. */
  denseRate: number;
  sparseRate: number;
  /** The wires' level below which the collisions thin out. */
  denseLevel: number;
  /** How deeply the head's swing times the collisions, 0 to 1. */
  buzz: number;
}

export interface SnareCharacter {
  modes: readonly SnareMode[];
  /** How far a full stroke starts sharp, and for how long. */
  bend: number;
  bendSeconds: number;
  /** The stick on the head. */
  click: { lowHz: number; highHz: number; seconds: number; level: number };
  wires: WireCharacter;
  /** From this velocity up the stick catches the hoop too: the shell's ring, and its level. Null for no rimshots. */
  rimshot: { from: number; level: number; modes: readonly FixedMode[] } | null;
  /** A hand clap layered on the snare: its level, band and tail. Null for none. */
  clap: { level: number; hz: number; q: number; tailSeconds: number } | null;
  /** How hard the head drives its own saturation, 0 to 1. */
  warmth: number;
}

/** A clap is three short bursts this far apart, in seconds, and then a tail. */
const CLAP_GAP_SECONDS = 0.0105;
const CLAP_BURST_SECONDS = 0.0045;
const CLAP_BURSTS = 3;
/** The wires' collision rate is worked out this often, in samples. */
const WIRE_CONTROL = 16;

export class ShellSnare implements DrumVoice {
  active = false;
  private readonly sampleRate: number;
  private readonly character: SnareCharacter;
  private readonly modes: MembraneModes;
  private readonly hoop: MembraneModes | null;
  private readonly click: NoiseBurst;
  private readonly random: Random;
  private readonly clapRandom: Random;
  private readonly buffer = new Float64Array(128);
  private settings: SnareSettings;
  private readonly drive: number;
  private readonly noiseScale: number;
  // the wires
  private readonly wireLow = new Biquad();
  private readonly wireHigh = new Biquad();
  private readonly wireBody = new Biquad();
  private readonly wirePresence = new Biquad();
  private wiresOn = false;
  private snap = 0;
  private snapFade = 0;
  private sizzle = 0;
  private sizzleFade = 0;
  /** A soft stroke's wires swell in over a few milliseconds: 1 once they have arrived. */
  private wireGate = 1;
  private wireGateStep = 1;
  private wireChance = 0;
  private wireAmplitude = 0;
  private wireTick = 0;
  private buzzDepth = 0;
  private buzzFade = 0;
  private buzzCos = 1;
  private buzzSin = 0;
  private buzzStepCos = 1;
  private buzzStepSin = 0;
  // the clap
  private readonly clapBand = new Biquad();
  private clapOn = false;
  private clapLevel = 0;
  private clapEnvelope = 0;
  private clapAge = 0;
  private readonly clapGap: number;
  private readonly clapBurstFade: number;
  private readonly clapTailFade: number;

  constructor(sampleRate: number, character: SnareCharacter, settings: SnareSettings, random: Random) {
    this.sampleRate = sampleRate;
    this.character = character;
    this.modes = new MembraneModes(sampleRate, character.modes.length);
    this.hoop = character.rimshot ? new MembraneModes(sampleRate, character.rimshot.modes.length) : null;
    character.rimshot?.modes.forEach((mode, i) => this.hoop!.tune(i, mode.hz, mode.seconds));
    this.click = new NoiseBurst(sampleRate, random);
    this.click.between(character.click.lowHz, character.click.highHz);
    // the wires and the clap each draw at their own pace, so neither depends on how the caller slices its blocks
    this.random = random.fork();
    this.clapRandom = random.fork();
    this.settings = settings;
    this.drive = 0.35 + 1.5 * character.warmth;
    this.noiseScale = noiseGain(sampleRate);
    const { wires, clap } = character;
    this.wireLow.setHighpass(wires.lowHz, 0.8, sampleRate);
    this.wireHigh.setLowpass(wires.highHz, 0.707, sampleRate);
    this.wireBody.setBandpass(wires.bodyHz, 1.4, sampleRate);
    this.wirePresence.setBandpass(wires.presenceHz, 1.2, sampleRate);
    this.buzzFade = Math.exp(-1 / (0.05 * sampleRate));
    this.clapGap = Math.round(CLAP_GAP_SECONDS * sampleRate);
    this.clapBurstFade = Math.exp(-6.907755 / (CLAP_BURST_SECONDS * 3 * sampleRate));
    this.clapTailFade = Math.exp(-6.907755 / (Math.max(0.02, clap?.tailSeconds ?? 0.1) * sampleRate));
    if (clap) this.clapBand.setBandpass(clap.hz, clap.q, sampleRate);
    this.configure(settings);
  }

  configure(settings: SnareSettings): void {
    this.settings = settings;
    this.character.modes.forEach((mode, i) => this.modes.tune(i, settings.hz * mode.ratio, mode.seconds));
    const angle = (2 * Math.PI * settings.hz) / this.sampleRate;
    this.buzzStepCos = Math.cos(angle);
    this.buzzStepSin = Math.sin(angle);
  }

  /**
   * `soft` is a brush or a ghosted tap: the stroke lands over several
   * milliseconds, so there is no stick click and little of the upper modes.
   */
  strike(velocity: number, variation: StrokeVariation, soft = false): void {
    const { character, sampleRate } = this;
    const { wires: amount, decay } = this.settings;
    const { wires, rimshot, clap } = character;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const vary = 1 + 0.06 * variation.level;
    // Head and wires answer velocity differently: a ghost note is mostly wires.
    const head = strength(velocity, 1.8) * vary * (1 - 0.35 * amount) * (soft ? 0.5 : 1);
    const brightness = (soft ? 0.25 : 0.4) + 0.6 * hard;
    character.modes.forEach((mode, i) => {
      // an off-centre stroke rings the edge modes; a centre stroke is drier
      const wobble = Math.max(0.2, 1 + 0.35 * variation.position * mode.edge);
      this.modes.push(i, head * mode.level * brightness ** mode.order * wobble);
    });
    this.modes.stretch(character.bend * hard * hard, character.bendSeconds);
    if (!soft) this.click.start(strength(velocity, 1.5) * vary * character.click.level, character.click.seconds);

    // A rimshot: the stick meets head and hoop together, and the shell answers.
    if (rimshot && this.hoop && !soft && hard > rimshot.from) {
      const share = clamp01((hard - rimshot.from) / (1 - rimshot.from));
      rimshot.modes.forEach((mode, i) => {
        const wobble = 1 + 0.3 * variation.position * (i % 2 === 0 ? 1 : -1);
        this.hoop!.push(i, head * rimshot.level * share * mode.level * wobble);
      });
    }

    // The wires: thrown further, and for longer, by a harder stroke, and brighter.
    const thrown = strength(velocity, 1.15) * vary * amount * 1.5 * wires.level * (soft ? 0.8 : 1);
    if (thrown > 0) {
      if (soft && thrown > this.sizzle + this.snap) {
        this.wireGate = Math.min(this.wireGate, (this.sizzle + this.snap) / thrown);
        this.wireGateStep = 1 / (0.006 * sampleRate);
      }
      this.sizzle = Math.max(this.sizzle, thrown);
      this.snap = Math.max(this.snap, soft ? 0 : thrown * wires.snapLevel * (0.4 + 0.6 * hard));
      this.sizzleFade = Math.exp(-6.907755 / (decay * (0.45 + 0.55 * hard) * sampleRate));
      this.snapFade = Math.exp(-6.907755 / (wires.snapSeconds * sampleRate));
      this.wireHigh.setLowpass(wires.highHz * ((soft ? 0.3 : 0.4) + 0.6 * hard), 0.707, sampleRate);
      // They slap in time with the head while it swings widely: the buzz in a snare.
      this.buzzDepth = wires.buzz;
      this.wireTick = 0;
      this.wiresOn = true;
    }

    if (clap && !soft) {
      this.clapLevel = strength(velocity, 1.4) * vary * clap.level * this.noiseScale;
      this.clapEnvelope = 1;
      this.clapAge = 0;
      this.clapOn = true;
    }
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    const { buffer, drive } = this;
    buffer.fill(0, 0, count);
    this.modes.render(buffer, count);
    const back = 1 / drive;
    for (let i = 0; i < count; i++) buffer[i] = saturate(buffer[i] * drive) * back;
    if (this.hoop) this.hoop.render(buffer, count);
    if (this.click.sounding) this.click.render(buffer, count);
    if (this.wiresOn) this.renderWires(buffer, count);
    if (this.clapOn) this.renderClap(buffer, count);
    for (let i = 0; i < count; i++) out[i] += buffer[i];
  }

  settle(): void {
    if (!this.active) return;
    this.click.settle();
    this.modes.flush();
    this.hoop?.flush();
    if (this.wiresOn) {
      // keep the buzz's turning point on the unit circle
      const drift = 1.5 - 0.5 * (this.buzzCos * this.buzzCos + this.buzzSin * this.buzzSin);
      this.buzzCos *= drift;
      this.buzzSin *= drift;
      if (this.sizzle < ENVELOPE_FLOOR) this.sizzle = 0;
      if (this.snap < ENVELOPE_FLOOR) this.snap = 0;
      const ringing = this.wireLow.magnitude() + this.wireHigh.magnitude() + this.wireBody.magnitude() + this.wirePresence.magnitude();
      if (this.sizzle === 0 && this.snap === 0 && ringing < VOICE_SLEEP_LEVEL) this.sleepWires();
    }
    if (this.clapOn) {
      if (this.clapAge > CLAP_BURSTS * this.clapGap && this.clapEnvelope * this.clapLevel < ENVELOPE_FLOOR) this.clapEnvelope = 0;
      if (this.clapEnvelope === 0 && this.clapBand.magnitude() < VOICE_SLEEP_LEVEL) this.sleepClap();
    }
    const hoopLevel = this.hoop ? this.hoop.level() : 0;
    if (this.modes.level() < VOICE_SLEEP_LEVEL && hoopLevel < VOICE_SLEEP_LEVEL && !this.wiresOn && !this.clapOn && !this.click.sounding) this.sleep();
  }

  sleep(): void {
    this.modes.sleep();
    this.hoop?.sleep();
    this.click.sleep();
    this.sleepWires();
    this.sleepClap();
    this.buffer.fill(0);
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.hoop?.forEachState(visit);
    this.click.forEachState(visit);
    for (const filter of [this.wireLow, this.wireHigh, this.wireBody, this.wirePresence, this.clapBand]) filter.state().forEach(visit);
    // (the buzz's turning point stays on the unit circle: it is not something that decays)
    [this.sizzle, this.snap, this.buzzDepth, this.wireAmplitude, this.clapEnvelope * this.clapLevel].forEach(visit);
    this.buffer.forEach(visit);
  }

  private renderWires(buffer: Float64Array, count: number): void {
    const { wireLow, wireHigh, wireBody, wirePresence, random, sizzleFade, snapFade, buzzFade, buzzStepCos, buzzStepSin, wireGateStep } = this;
    const { bodyLevel, presenceLevel } = this.character.wires;
    let { sizzle, snap, buzzDepth, buzzCos, buzzSin, wireGate, wireChance, wireAmplitude, wireTick } = this;
    for (let i = 0; i < count; i++) {
      if (wireTick === 0) {
        // How thrown the wires are sets how often one lands. Fewer, larger collisions as they settle: the rattle.
        const { denseRate, sparseRate, denseLevel } = this.character.wires;
        const thrown = Math.min(1, (sizzle + snap) / denseLevel);
        const rate = sparseRate + (denseRate - sparseRate) * thrown * thrown;
        wireChance = Math.min(0.5, rate / this.sampleRate);
        // as loud as plain noise while dense, and falling with the square root of the rate as they thin
        wireAmplitude = (this.noiseScale * Math.sqrt(rate / denseRate) ** 0.5) / Math.sqrt(3 * wireChance);
      }
      wireTick = (wireTick + 1) % WIRE_CONTROL;
      const turned = buzzCos * buzzStepCos - buzzSin * buzzStepSin;
      buzzSin = buzzSin * buzzStepCos + buzzCos * buzzStepSin;
      buzzCos = turned;
      const draw = random.next();
      let x = 0;
      if (draw < wireChance) {
        const level = (sizzle + snap) * (1 + buzzDepth * buzzSin) * wireGate * wireAmplitude;
        x = draw < wireChance * 0.5 ? level : -level;
      }
      buffer[i] += wireHigh.process(wireLow.process(x)) + bodyLevel * wireBody.process(x) + presenceLevel * wirePresence.process(x);
      sizzle *= sizzleFade;
      snap *= snapFade;
      buzzDepth *= buzzFade;
      if (wireGate < 1) wireGate = Math.min(1, wireGate + wireGateStep);
    }
    this.sizzle = sizzle;
    this.snap = snap;
    this.buzzDepth = buzzDepth;
    this.buzzCos = buzzCos;
    this.buzzSin = buzzSin;
    this.wireGate = wireGate;
    this.wireChance = wireChance;
    this.wireAmplitude = wireAmplitude;
    this.wireTick = wireTick;
  }

  private renderClap(buffer: Float64Array, count: number): void {
    const { clapBand, clapRandom: random, clapGap, clapBurstFade, clapTailFade, clapLevel } = this;
    let { clapEnvelope, clapAge } = this;
    for (let i = 0; i < count; i++) {
      // three hands land one after another, then the room of the clap dies away
      if (clapAge > 0 && clapAge <= (CLAP_BURSTS - 1) * clapGap && clapAge % clapGap === 0) clapEnvelope = 0.85;
      buffer[i] += clapBand.process(clapLevel * clapEnvelope * random.bipolar());
      clapEnvelope *= clapAge < (CLAP_BURSTS - 1) * clapGap ? clapBurstFade : clapTailFade;
      clapAge++;
    }
    this.clapEnvelope = clapEnvelope;
    this.clapAge = clapAge;
  }

  private sleepWires(): void {
    this.wireLow.reset();
    this.wireHigh.reset();
    this.wireBody.reset();
    this.wirePresence.reset();
    this.wiresOn = false;
    this.wireGate = 1;
    this.sizzle = 0;
    this.snap = 0;
    this.buzzDepth = 0;
    this.buzzCos = 1;
    this.buzzSin = 0;
    this.wireAmplitude = 0;
    this.wireChance = 0;
    this.wireTick = 0;
  }

  private sleepClap(): void {
    this.clapBand.reset();
    this.clapOn = false;
    this.clapEnvelope = 0;
    this.clapAge = 0;
  }
}

/* ------------------------------------------------------------------ toms */

export interface TomCharacter {
  modes: readonly ShellMode[];
  /** How far a full stroke starts sharp, and how long the pitch takes to fall back. */
  bend: number;
  bendSeconds: number;
  /** The stick on the head: short modes as multiples of the tom's pitch, and a tick of noise. */
  knock: readonly FixedMode[];
  knockLevel: number;
  click: { lowHz: number; highHz: number; seconds: number; level: number };
  warmth: number;
}

export class ShellTom implements DrumVoice {
  active = false;
  private readonly character: TomCharacter;
  private readonly modes: MembraneModes;
  private readonly knock: MembraneModes;
  private readonly click: NoiseBurst;
  private readonly buffer = new Float64Array(128);
  private readonly drive: number;

  /** `hz` is the tom's resting pitch and `seconds` how long it rings. */
  constructor(sampleRate: number, character: TomCharacter, hz: number, seconds: number, random: Random) {
    this.character = character;
    this.modes = new MembraneModes(sampleRate, character.modes.length);
    this.knock = new MembraneModes(sampleRate, character.knock.length);
    this.click = new NoiseBurst(sampleRate, random);
    this.click.between(character.click.lowHz, character.click.highHz);
    character.modes.forEach((mode, i) => this.modes.tune(i, hz * mode.ratio, seconds * mode.decay));
    // the stick's knock sits higher on a smaller drum
    character.knock.forEach((mode, i) => this.knock.tune(i, mode.hz * (hz / 140) ** 0.3, mode.seconds));
    this.drive = 0.35 + 1.5 * character.warmth;
  }

  /** `soft` is a brush: no stick, and less of the upper modes. */
  strike(velocity: number, variation: StrokeVariation, soft = false): void {
    const { character } = this;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const level = strength(velocity, 1.6) * (1 + 0.06 * variation.level) * (soft ? 0.6 : 1);
    const brightness = (soft ? 0.2 : 0.35) + 0.65 * hard;
    character.modes.forEach((mode, i) => {
      const wobble = 1 + 0.25 * variation.position * (i % 2 === 0 ? -0.3 : 1);
      this.modes.push(i, level * mode.level * brightness ** mode.order * wobble);
    });
    this.modes.stretch(character.bend * hard * hard, character.bendSeconds);
    if (!soft) {
      const knock = level * character.knockLevel * (0.3 + 0.7 * hard);
      character.knock.forEach((mode, i) => {
        const wobble = 1 + 0.4 * variation.position * (i % 2 === 0 ? 1 : -1);
        this.knock.push(i, knock * mode.level * hard ** mode.order * wobble);
      });
      this.click.start(level * character.click.level * (0.3 + 0.7 * hard), character.click.seconds);
    }
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    const { buffer, drive } = this;
    buffer.fill(0, 0, count);
    this.modes.render(buffer, count);
    const back = 1 / drive;
    for (let i = 0; i < count; i++) buffer[i] = saturate(buffer[i] * drive) * back;
    this.knock.render(buffer, count);
    if (this.click.sounding) this.click.render(buffer, count);
    for (let i = 0; i < count; i++) out[i] += buffer[i];
  }

  settle(): void {
    if (!this.active) return;
    this.click.settle();
    this.modes.flush();
    this.knock.flush();
    if (this.modes.level() < VOICE_SLEEP_LEVEL && this.knock.level() < VOICE_SLEEP_LEVEL && !this.click.sounding) this.sleep();
  }

  sleep(): void {
    this.modes.sleep();
    this.knock.sleep();
    this.click.sleep();
    this.buffer.fill(0);
    this.active = false;
  }

  forEachState(visit: (value: number) => void): void {
    this.modes.forEachState(visit);
    this.knock.forEachState(visit);
    this.click.forEachState(visit);
    this.buffer.forEach(visit);
  }
}

/* ------------------------------------------------------------------- rim */

/** A rim sound made of a few fixed modes and a tick: a cross-stick, or a drum machine's rimshot. */
export interface RimCharacter {
  modes: readonly FixedMode[];
  click: { lowHz: number; highHz: number; seconds: number; level: number };
}

export class ShellRim implements DrumVoice {
  active = false;
  private readonly character: RimCharacter;
  private readonly modes: MembraneModes;
  private readonly click: NoiseBurst;

  constructor(sampleRate: number, character: RimCharacter, random: Random) {
    this.character = character;
    this.modes = new MembraneModes(sampleRate, character.modes.length);
    this.click = new NoiseBurst(sampleRate, random);
    character.modes.forEach((mode, i) => this.modes.tune(i, mode.hz, mode.seconds));
    this.click.between(character.click.lowHz, character.click.highHz);
  }

  strike(velocity: number, variation: StrokeVariation): void {
    const { character } = this;
    const hard = clamp01(velocity * (1 + 0.15 * variation.hardness));
    const level = strength(velocity, 1.4) * (1 + 0.06 * variation.level);
    character.modes.forEach((mode, i) => {
      // where along the stick it meets the rim changes the balance of its modes
      const wobble = 1 + 0.3 * variation.position * (i % 2 === 0 ? 1 : -1);
      this.modes.push(i, level * mode.level * hard ** mode.order * wobble);
    });
    this.click.start(level * character.click.level, character.click.seconds);
    this.active = true;
  }

  render(out: Float64Array, count: number): void {
    this.modes.render(out, count);
    if (this.click.sounding) this.click.render(out, count);
  }

  settle(): void {
    if (!this.active) return;
    this.click.settle();
    this.modes.flush();
    if (this.modes.level() < VOICE_SLEEP_LEVEL && !this.click.sounding) this.sleep();
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
