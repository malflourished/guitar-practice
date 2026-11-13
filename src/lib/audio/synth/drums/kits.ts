/**
 * The three kits: which voices each has, where each sits between the
 * speakers, how much of it goes to the room, and how a groove's request
 * ("closed hi-hat, this hard") becomes a stroke on a voice.
 */
import type { Random } from '../dsp/random';
import { CrashCymbal, HiHat, RideCymbal } from './cymbals';
import type { DrumKitId, DrumParams, DrumPiece } from './drumParams';
import {
  GatedBurst,
  MachineKick,
  MachineRim,
  MachineSnare,
  MachineTom,
  MetalChannel,
  SquareCluster,
  type MetalStroke,
} from './machine';
import {
  AcousticKick,
  AcousticSnare,
  AcousticTom,
  BrushSweep,
  CrossStick,
  strokeVariation,
  type DrumVoice,
} from './membranes';

/** One voice's place in the mix. */
export interface KitStrip {
  voice: DrumVoice;
  /** Its level in each ear, from its level and its place between the speakers. */
  left: number;
  right: number;
  /** How much of it goes to the room. */
  send: number;
  /** Metal goes round the drum bus's soft clipper. */
  metal: boolean;
}

export interface DrumKit {
  readonly id: DrumKitId;
  readonly strips: readonly KitStrip[];
  /** How long the kit's room rings, in seconds, and its level at Room 1. */
  readonly roomSeconds: number;
  readonly roomLevel: number;
  configure(params: DrumParams): void;
  /** Play a piece now. `seconds` is how long a sweep lasts; other pieces ignore it. */
  hit(piece: DrumPiece, velocity: number, seconds: number): void;
  /** Once per stretch, before the strips render: fill anything they share. */
  prepare(count: number): void;
  /** Add stereo sounds that are not a strip (the machine kit's gated burst). */
  extras(left: Float64Array, right: Float64Array, count: number): void;
  settle(): void;
  sleep(): void;
  forEachState(visit: (value: number) => void): void;
}

/** A strip from a level and a pan position: -1 is hard left, 1 hard right, at equal power. */
function strip(voice: DrumVoice, level: number, pan: number, send: number, metal = false): KitStrip {
  const angle = ((pan + 1) * Math.PI) / 4;
  return { voice, left: level * Math.cos(angle) * Math.SQRT2, right: level * Math.sin(angle) * Math.SQRT2, send: level * send, metal };
}

/* The toms' resting pitches, in hertz, and how long each rings, in seconds. */
const TOM_HIGH = { hz: 186, seconds: 0.42 };
const TOM_MID = { hz: 141, seconds: 0.5 };
const TOM_LOW = { hz: 98, seconds: 0.62 };

/**
 * The acoustic kit, and the same kit played with brushes. The layout is the
 * drummer's: hi-hat to the left, ride to the right, toms from left to right
 * as they get lower.
 */
export class AcousticKit implements DrumKit {
  readonly id: DrumKitId;
  readonly strips: readonly KitStrip[];
  readonly roomSeconds: number;
  readonly roomLevel = 0.5;
  private readonly random: Random;
  private readonly brushes: boolean;
  private readonly kick: AcousticKick;
  private readonly snare: AcousticSnare;
  private readonly rim: CrossStick;
  private readonly tomHigh: AcousticTom;
  private readonly tomMid: AcousticTom;
  private readonly tomLow: AcousticTom;
  private readonly hat: HiHat;
  private readonly ride: RideCymbal;
  private readonly crash: CrashCymbal;
  private readonly sweep: BrushSweep;
  private variation = 0.6;

  constructor(sampleRate: number, params: DrumParams, random: Random, brushes = false) {
    this.id = brushes ? 'brushes' : 'acoustic';
    this.brushes = brushes;
    this.roomSeconds = brushes ? 0.5 : 0.42;
    this.random = random;
    this.kick = new AcousticKick(sampleRate, { hz: params.kickHz, decay: params.kickDecay, punch: params.kickPunch }, random);
    this.snare = new AcousticSnare(sampleRate, { hz: params.snareHz, wires: params.snareWires, decay: params.snareDecay }, random);
    this.rim = new CrossStick(sampleRate, random);
    this.tomHigh = new AcousticTom(sampleRate, TOM_HIGH.hz, TOM_HIGH.seconds, random);
    this.tomMid = new AcousticTom(sampleRate, TOM_MID.hz, TOM_MID.seconds, random);
    this.tomLow = new AcousticTom(sampleRate, TOM_LOW.hz, TOM_LOW.seconds, random);
    this.hat = new HiHat(sampleRate, random);
    this.ride = new RideCymbal(sampleRate, random);
    this.crash = new CrashCymbal(sampleRate, random);
    this.sweep = new BrushSweep(sampleRate, random);
    this.strips = [
      strip(this.kick, 1, 0, 0.1),
      strip(this.snare, 0.62, 0.04, 0.5),
      strip(this.rim, 0.5, 0.04, 0.55),
      strip(this.tomHigh, 0.7, -0.3, 0.45),
      strip(this.tomMid, 0.72, 0.1, 0.45),
      strip(this.tomLow, 0.78, 0.4, 0.45),
      strip(this.hat, 0.9, -0.36, 0.14, true),
      strip(this.ride, 1.1, 0.4, 0.2, true),
      strip(this.crash, 1.25, -0.24, 0.25, true),
      strip(this.sweep, 0.55, 0.06, 0.4),
    ];
    this.configure(params);
  }

  configure(params: DrumParams): void {
    this.variation = params.variation;
    this.kick.configure({ hz: params.kickHz, decay: params.kickDecay, punch: params.kickPunch });
    this.snare.configure({ hz: params.snareHz, wires: params.snareWires, decay: params.snareDecay });
    this.hat.configure(params.hatTone, params.hatDecay);
    this.ride.configure(params.cymbalTone, params.cymbalDecay);
    this.crash.configure(params.cymbalTone, params.cymbalDecay);
  }

  hit(piece: DrumPiece, velocity: number, seconds: number): void {
    const { random, variation, brushes } = this;
    const vary = strokeVariation(random, variation);
    // Brushes on metal: lighter, and the wires land less sharply than a stick's tip.
    const metal = brushes ? velocity * 0.8 : velocity;
    switch (piece) {
      case 'kick':
        this.kick.strike(velocity, vary);
        break;
      case 'snare':
        this.snare.strike(velocity, vary, brushes);
        break;
      case 'brushTap':
        this.snare.strike(velocity, vary, true);
        break;
      case 'brushSweep':
        this.sweep.sweep(velocity, seconds, vary);
        break;
      case 'rim':
        this.rim.strike(velocity, vary);
        break;
      case 'tomHigh':
        this.tomHigh.strike(velocity, vary, brushes);
        break;
      case 'tomMid':
        this.tomMid.strike(velocity, vary, brushes);
        break;
      case 'tomLow':
        this.tomLow.strike(velocity, vary, brushes);
        break;
      case 'hatClosed':
        this.hat.closed(metal, vary, variation);
        break;
      case 'hatOpen':
        this.hat.open(metal, vary, variation);
        break;
      case 'hatFoot':
        this.hat.foot(velocity, vary, variation);
        break;
      case 'ride':
        this.ride.strike(metal, vary, variation);
        break;
      case 'crash':
        this.crash.strike(metal, vary, variation);
        break;
    }
  }

  prepare(): void {
    // nothing shared
  }

  extras(): void {
    // none
  }

  settle(): void {
    for (const { voice } of this.strips) voice.settle();
  }

  sleep(): void {
    for (const { voice } of this.strips) voice.sleep();
  }

  forEachState(visit: (value: number) => void): void {
    for (const { voice } of this.strips) voice.forEachState(visit);
  }
}

/** The machine kit's toms. */
const MACHINE_TOM_HIGH = { hz: 212, seconds: 0.3 };
const MACHINE_TOM_MID = { hz: 152, seconds: 0.36 };
const MACHINE_TOM_LOW = { hz: 104, seconds: 0.44 };

export class MachineKit implements DrumKit {
  readonly id: DrumKitId = 'machine';
  readonly strips: readonly KitStrip[];
  readonly roomSeconds = 0.3;
  readonly roomLevel = 0.2;
  private readonly random: Random;
  private readonly kick: MachineKick;
  private readonly snare: MachineSnare;
  private readonly rim: MachineRim;
  private readonly tomHigh: MachineTom;
  private readonly tomMid: MachineTom;
  private readonly tomLow: MachineTom;
  private readonly cluster: SquareCluster;
  private readonly hat: MetalChannel;
  private readonly ride: MetalChannel;
  private readonly crash: MetalChannel;
  private readonly burst: GatedBurst;
  private params: DrumParams;

  constructor(sampleRate: number, params: DrumParams, random: Random) {
    this.random = random;
    this.params = params;
    this.kick = new MachineKick(sampleRate, { hz: params.kickHz, decay: params.kickDecay, punch: params.kickPunch }, random);
    this.snare = new MachineSnare(sampleRate, { hz: params.snareHz, wires: params.snareWires, decay: params.snareDecay }, random);
    this.rim = new MachineRim(sampleRate, random);
    this.tomHigh = new MachineTom(sampleRate, MACHINE_TOM_HIGH.hz, MACHINE_TOM_HIGH.seconds, random);
    this.tomMid = new MachineTom(sampleRate, MACHINE_TOM_MID.hz, MACHINE_TOM_MID.seconds, random);
    this.tomLow = new MachineTom(sampleRate, MACHINE_TOM_LOW.hz, MACHINE_TOM_LOW.seconds, random);
    this.cluster = new SquareCluster(sampleRate, random);
    this.hat = new MetalChannel(sampleRate, this.cluster, 6200);
    this.ride = new MetalChannel(sampleRate, this.cluster, 2600);
    this.crash = new MetalChannel(sampleRate, this.cluster, 3000);
    this.burst = new GatedBurst(sampleRate, random);
    this.strips = [
      strip(this.kick, 1.5, 0, 0.05),
      strip(this.snare, 0.95, 0, 0.3),
      strip(this.rim, 0.7, 0.05, 0.3),
      strip(this.tomHigh, 1, -0.35, 0.3),
      strip(this.tomMid, 1, 0.1, 0.3),
      strip(this.tomLow, 1.05, 0.45, 0.3),
      strip(this.hat, 1.5, -0.3, 0.1, true),
      strip(this.ride, 1.5, 0.35, 0.12, true),
      strip(this.crash, 1.7, -0.2, 0.15, true),
    ];
    this.configure(params);
  }

  configure(params: DrumParams): void {
    this.params = params;
    this.kick.configure({ hz: params.kickHz, decay: params.kickDecay, punch: params.kickPunch });
    this.snare.configure({ hz: params.snareHz, wires: params.snareWires, decay: params.snareDecay });
  }

  hit(piece: DrumPiece, velocity: number): void {
    const { random, params } = this;
    const vary = strokeVariation(random, params.variation);
    const level = Math.min(1, Math.max(0, velocity)) ** 1.5 * (1 + 0.04 * vary.level);
    // The burst opens further for a harder stroke: soft notes stay dry.
    const gated = params.room * level * velocity;
    switch (piece) {
      case 'kick':
        this.kick.strike(velocity, vary);
        break;
      case 'snare':
        this.snare.strike(velocity, vary);
        this.burst.trigger(gated * 0.4, 0.13);
        break;
      case 'brushTap':
        // a machine has no brushes: the nearest thing is a soft snare
        this.snare.strike(velocity * 0.7, vary);
        break;
      case 'brushSweep':
        break;
      case 'rim':
        this.rim.strike(velocity, vary);
        break;
      case 'tomHigh':
        this.tomHigh.strike(velocity, vary);
        this.burst.trigger(gated * 0.28, 0.15);
        break;
      case 'tomMid':
        this.tomMid.strike(velocity, vary);
        this.burst.trigger(gated * 0.28, 0.15);
        break;
      case 'tomLow':
        this.tomLow.strike(velocity, vary);
        this.burst.trigger(gated * 0.28, 0.16);
        break;
      case 'hatClosed':
        this.hat.strike(this.hatStroke(level, 0.045 + 0.07 * params.hatDecay, 0.035 + 0.05 * params.hatDecay));
        break;
      case 'hatOpen':
        this.hat.strike(this.hatStroke(level, 0.28 + 0.6 * params.hatDecay, 0.2 + 0.45 * params.hatDecay));
        break;
      case 'hatFoot':
        // a machine has no pedal: a soft, very short closed hat, which also chokes an open one
        this.hat.strike(this.hatStroke(level * 0.5, 0.03, 0.02));
        break;
      case 'ride': {
        const tone = params.cymbalTone;
        this.ride.strike({
          low: level * (1.1 - 0.5 * tone),
          lowSeconds: params.cymbalDecay * 0.5,
          high: level * (0.35 + 0.7 * tone),
          highSeconds: params.cymbalDecay * 0.2,
        });
        break;
      }
      case 'crash': {
        const tone = params.cymbalTone;
        this.crash.strike({
          low: level * (1 - 0.4 * tone),
          lowSeconds: params.cymbalDecay,
          high: level * (0.6 + 0.8 * tone),
          highSeconds: params.cymbalDecay * 0.55,
        });
        break;
      }
    }
  }

  prepare(count: number): void {
    if (this.hat.active || this.ride.active || this.crash.active) this.cluster.fill(count);
  }

  extras(left: Float64Array, right: Float64Array, count: number): void {
    if (this.burst.active) this.burst.render(left, right, count);
  }

  settle(): void {
    for (const { voice } of this.strips) voice.settle();
    this.burst.settle();
  }

  sleep(): void {
    for (const { voice } of this.strips) voice.sleep();
    this.burst.sleep();
  }

  forEachState(visit: (value: number) => void): void {
    for (const { voice } of this.strips) voice.forEachState(visit);
    this.cluster.forEachState(visit);
    this.burst.forEachState(visit);
  }

  /** A hi-hat stroke: Tone moves the weight from the lower band to the upper. */
  private hatStroke(level: number, lowSeconds: number, highSeconds: number): MetalStroke {
    const tone = this.params.hatTone;
    return { low: level * (0.7 - 0.5 * tone), lowSeconds, high: level * (0.5 + 0.9 * tone), highSeconds };
  }
}

export function createKit(id: DrumKitId, sampleRate: number, params: DrumParams, random: Random): DrumKit {
  if (id === 'machine') return new MachineKit(sampleRate, params, random);
  return new AcousticKit(sampleRate, params, random, id === 'brushes');
}
