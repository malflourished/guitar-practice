/**
 * The S2.1 kits: three candidates built after the owner compared the first
 * three and was not won over by any (docs/sound/drums.md, "Why the first
 * kits fell short", and docs/specs/S2-drums.md, "S2.1").
 *
 * All three are one engine with different settings: drums from `shells.ts`,
 * metal from `bandedMetal.ts`, a room from `dsp/drumRoom.ts` and a bus from
 * `drumBus.ts`. Each aims at one of the sounds the owner named:
 *
 * - `rock`: a hard-hit acoustic kit in a big room, compressed. Backbeats are
 *   rimshots; the cymbals wash.
 * - `neon`: the produced drums of 1980s pop and the synthwave made after it.
 *   Tight, punchy drums as the sampling drum machines had them, the big room
 *   on the snare that is cut off after a fifth of a second, toms whose pitch
 *   falls as they sound.
 * - `garage`: the drums of UK garage and the electronic music made after it.
 *   A short kick with a hard start, a snare with a clap on it, a woody rim,
 *   very tight bright hats, almost no room.
 *
 * A kit here is data: a `KitDefinition`. `StudioKit` plays any of them.
 */
import { DrumRoom, type DrumRoomSettings } from '../dsp/drumRoom';
import type { Random } from '../dsp/random';
import { TableCrash, TableHiHat, TableRide, type CymbalCharacter, type HatCharacter, type RideCharacter } from './bandedMetal';
import { GlueBus, type GlueSettings } from './drumBus';
import type { DrumKitId, DrumParams, DrumPiece } from './drumParams';
import { strip, type DrumKit, type KitStrip } from './kits';
import { BrushSweep, strokeVariation } from './membranes';
import { metalTables, type MetalRecipe } from './metalTable';
import {
  ShellKick,
  ShellRim,
  ShellSnare,
  ShellTom,
  type KickCharacter,
  type RimCharacter,
  type SnareCharacter,
  type TomCharacter,
} from './shells';

export type StudioKitId = 'rock' | 'neon' | 'garage';

export function isStudioKitId(id: DrumKitId): id is StudioKitId {
  return id === 'rock' || id === 'neon' || id === 'garage';
}

/** A piece's place in the mix: its level, where it sits between the speakers (-1 left, 1 right), and its send to the room. */
type Place = readonly [level: number, pan: number, send: number];

interface TomSet {
  character: TomCharacter;
  /** Each tom's resting pitch in hertz and its ring in seconds. */
  high: readonly [hz: number, seconds: number];
  mid: readonly [hz: number, seconds: number];
  low: readonly [hz: number, seconds: number];
}

export interface KitDefinition {
  kick: KickCharacter;
  snare: SnareCharacter;
  toms: TomSet;
  rim: RimCharacter;
  hat: HatCharacter;
  ride: RideCharacter;
  crash: CymbalCharacter;
  room: DrumRoomSettings;
  /** The room's level with the Room control at 1. */
  roomLevel: number;
  /** A gated room opens for a snare or tom stroke at least this hard. */
  gateFrom?: number;
  glue: GlueSettings;
  mix: Record<'kick' | 'snare' | 'rim' | 'tomHigh' | 'tomMid' | 'tomLow' | 'hat' | 'ride' | 'crash' | 'sweep', Place>;
}

/** The edges of the metal's six bands, in hertz. */
const BANDS = [300, 800, 1700, 3200, 5600, 9000, 16000];

const metal = (name: string, seed: number, spacingHz: number, seconds: number): MetalRecipe => ({ name, seed, edges: BANDS, spacingHz, seconds });

/* ------------------------------------------------------------------ rock */

const ROCK: KitDefinition = {
  kick: {
    modes: [
      { ratio: 1, level: 1, decay: 1, order: 0 },
      { ratio: 1.9, level: 0.6, decay: 0.5, order: 0.5 },
      { ratio: 2.85, level: 0.4, decay: 0.32, order: 1 },
      { ratio: 4.1, level: 0.16, decay: 0.22, order: 1.5 },
    ],
    dropAtRest: 0.08,
    dropAtPunch: 0.5,
    dropSeconds: 0.02,
    knock: [
      { hz: 1150, level: 0.7, seconds: 0.022, order: 0 },
      { hz: 1720, level: 0.9, seconds: 0.02, order: 0.3 },
      { hz: 2480, level: 1, seconds: 0.018, order: 0.6 },
      { hz: 3350, level: 0.9, seconds: 0.015, order: 0.9 },
      { hz: 4400, level: 0.6, seconds: 0.012, order: 1.3 },
      { hz: 5900, level: 0.4, seconds: 0.01, order: 1.7 },
    ],
    knockLevel: 0.45,
    felt: { hz: 2600, q: 0.8, seconds: 0.012, level: 0.8 },
    warmth: 0.45,
    even: 0.12,
  },
  snare: {
    modes: [
      { ratio: 1, level: 1, seconds: 0.1, order: 0, edge: -0.4 },
      { ratio: 1.59, level: 0.5, seconds: 0.15, order: 0.3, edge: 1 },
      { ratio: 2.14, level: 0.35, seconds: 0.18, order: 0.6, edge: 1 },
      { ratio: 2.3, level: 0.4, seconds: 0.08, order: 0.5, edge: -0.4 },
      { ratio: 2.92, level: 0.25, seconds: 0.09, order: 1, edge: 0.6 },
      { ratio: 3.6, level: 0.2, seconds: 0.07, order: 1.4, edge: -0.3 },
      { ratio: 4.25, level: 0.16, seconds: 0.055, order: 1.8, edge: 0.5 },
    ],
    bend: 0.1,
    bendSeconds: 0.012,
    click: { lowHz: 2800, highHz: 11000, seconds: 0.004, level: 0.9 },
    wires: {
      level: 0.45,
      lowHz: 950,
      highHz: 11500,
      bodyHz: 1900,
      bodyLevel: 1.2,
      presenceHz: 4600,
      presenceLevel: 0.9,
      snapLevel: 1,
      snapSeconds: 0.03,
      denseRate: 11000,
      sparseRate: 900,
      denseLevel: 0.06,
      buzz: 0.55,
    },
    rimshot: {
      from: 0.78,
      level: 0.55,
      modes: [
        { hz: 480, level: 0.6, seconds: 0.16, order: 0 },
        { hz: 865, level: 1, seconds: 0.2, order: 0 },
        { hz: 1410, level: 0.8, seconds: 0.14, order: 0 },
        { hz: 2170, level: 0.5, seconds: 0.09, order: 0 },
      ],
    },
    clap: null,
    warmth: 0.35,
  },
  toms: {
    character: {
      modes: [
        { ratio: 1, level: 1, decay: 1, order: 0 },
        { ratio: 1.52, level: 0.5, decay: 0.65, order: 0.4 },
        { ratio: 1.98, level: 0.3, decay: 0.45, order: 0.9 },
        { ratio: 2.3, level: 0.22, decay: 0.3, order: 1.2 },
        { ratio: 2.9, level: 0.14, decay: 0.22, order: 1.6 },
        { ratio: 3.5, level: 0.1, decay: 0.18, order: 2 },
      ],
      bend: 0.13,
      bendSeconds: 0.045,
      knock: [
        { hz: 1900, level: 0.8, seconds: 0.02, order: 0.3 },
        { hz: 2900, level: 1, seconds: 0.015, order: 0.7 },
        { hz: 4300, level: 0.6, seconds: 0.011, order: 1.2 },
      ],
      knockLevel: 0.2,
      click: { lowHz: 2000, highHz: 9000, seconds: 0.005, level: 0.5 },
      warmth: 0.3,
    },
    high: [172, 0.5],
    mid: [128, 0.62],
    low: [88, 0.8],
  },
  rim: {
    modes: [
      { hz: 215, level: 0.24, seconds: 0.04, order: 0 },
      { hz: 470, level: 0.32, seconds: 0.05, order: 0 },
      { hz: 1010, level: 0.8, seconds: 0.07, order: 0 },
      { hz: 1870, level: 0.56, seconds: 0.05, order: 0 },
      { hz: 2940, level: 0.26, seconds: 0.03, order: 0 },
    ],
    click: { lowHz: 2500, highHz: 12000, seconds: 0.003, level: 0.8 },
  },
  hat: {
    recipe: metal('rock-hat', 11, 14, 1.3),
    voicing: [0.5, 0.7, 0.9, 1, 1, 0.8],
    washLevel: 0.25,
    ring: [0.55, 0.65, 0.8, 0.9, 0.8, 0.6],
    cascade: 25,
    cascadeLevel: 1.5,
    width: 0.5,
    strike: [0.02, 0.06, 0.2, 0.6, 1, 0.7],
    shoulder: [0.06, 0.2, 0.5, 0.9, 1, 0.6],
    open: [0.05, 0.15, 0.4, 0.8, 1, 0.8],
    foot: [0.1, 0.35, 0.6, 0.5, 0.2, 0.05],
    closedRing: [0.035, 0.045, 0.055, 0.065, 0.07, 0.055],
    bloom: [0, 0, 0.1, 0.3, 0.5, 0.4],
    bloomAmount: 0.5,
    riseSeconds: 0.02,
    toneTilt: 10,
    hardTilt: 8,
    tick: { lowHz: 5000, highHz: 14000, seconds: 0.004, level: 0.5 },
    clapHz: 520,
    clapLevel: 0.5,
  },
  ride: {
    recipe: metal('rock-ride', 23, 12, 2.6),
    voicing: [0.45, 0.8, 1, 0.9, 0.7, 0.5],
    washLevel: 0.4,
    ring: [1.7, 1.7, 1.6, 1.4, 1.1, 0.8],
    cascade: 3,
    cascadeLevel: 2,
    width: 0.65,
    strike: [0.1, 0.3, 0.6, 0.8, 0.6, 0.3],
    bloom: [0, 0, 0.1, 0.2, 0.2, 0.1],
    bloomAmount: 0.25,
    riseSeconds: 0.03,
    toneTilt: 10,
    hardTilt: 8,
    tick: { lowHz: 4000, highHz: 12000, seconds: 0.005, level: 0.9 },
    ping: [
      { hz: 412, level: 0.2, seconds: 1.3 },
      { hz: 647, level: 0.3, seconds: 1.2 },
      { hz: 1010, level: 0.5, seconds: 1 },
      { hz: 1480, level: 0.7, seconds: 0.8 },
      { hz: 2210, level: 0.9, seconds: 0.6 },
      { hz: 3190, level: 1, seconds: 0.45 },
      { hz: 4630, level: 0.9, seconds: 0.3 },
    ],
    pingLevel: 0.5,
  },
  crash: {
    recipe: metal('rock-crash', 37, 12, 2.6),
    voicing: [0.5, 0.8, 1, 1, 0.8, 0.5],
    washLevel: 0.5,
    ring: [1.2, 1.15, 1.1, 1, 0.85, 0.6],
    cascade: 110,
    cascadeLevel: 1.2,
    width: 0.8,
    strike: [0.6, 1, 0.75, 0.3, 0.08, 0.02],
    bloom: [0, 0.1, 0.3, 0.3, 0.15, 0.05],
    bloomAmount: 0.7,
    riseSeconds: 0.025,
    toneTilt: 10,
    hardTilt: 10,
    tick: { lowHz: 1500, highHz: 7000, seconds: 0.008, level: 0.6 },
  },
  room: { seconds: 0.85, treble: 0.5, size: 1.25, lowCutHz: 110, early: 0.8 },
  roomLevel: 0.35,
  glue: { threshold: 0.14, attackSeconds: 0.012, releaseSeconds: 0.14, mix: 0.75, makeup: 1.4, sidechainHz: 110, knee: 0.45, ceiling: 0.7 },
  mix: {
    kick: [1, 0, 0.15],
    snare: [0.9, 0.04, 0.8],
    rim: [0.5, 0.04, 0.6],
    tomHigh: [0.75, -0.3, 0.7],
    tomMid: [0.77, 0.1, 0.7],
    tomLow: [0.82, 0.4, 0.7],
    hat: [0.24, -0.36, 0.3],
    ride: [0.16, 0.4, 0.35],
    crash: [0.3, -0.24, 0.45],
    sweep: [0.55, 0.06, 0.4],
  },
};

/* ------------------------------------------------------------------ neon */

const NEON: KitDefinition = {
  kick: {
    modes: [
      { ratio: 1, level: 1, decay: 1, order: 0 },
      { ratio: 2, level: 0.3, decay: 0.4, order: 0.6 },
      { ratio: 3.1, level: 0.15, decay: 0.25, order: 1.2 },
    ],
    dropAtRest: 0.3,
    dropAtPunch: 1.4,
    dropSeconds: 0.016,
    knock: [
      { hz: 1400, level: 0.6, seconds: 0.014, order: 0 },
      { hz: 2300, level: 1, seconds: 0.012, order: 0.3 },
      { hz: 3400, level: 0.9, seconds: 0.01, order: 0.6 },
      { hz: 4800, level: 0.6, seconds: 0.008, order: 1 },
    ],
    knockLevel: 0.5,
    felt: { hz: 3200, q: 0.8, seconds: 0.008, level: 0.7 },
    warmth: 0.6,
    even: 0.05,
  },
  snare: {
    modes: [
      { ratio: 1, level: 1, seconds: 0.09, order: 0, edge: -0.4 },
      { ratio: 1.62, level: 0.6, seconds: 0.11, order: 0.3, edge: 1 },
      { ratio: 2.2, level: 0.45, seconds: 0.1, order: 0.7, edge: 0.6 },
      { ratio: 2.95, level: 0.35, seconds: 0.07, order: 1.1, edge: 0.4 },
    ],
    bend: 0.16,
    bendSeconds: 0.014,
    click: { lowHz: 2500, highHz: 12000, seconds: 0.003, level: 1 },
    wires: {
      level: 0.45,
      lowHz: 1300,
      highHz: 13000,
      bodyHz: 2400,
      bodyLevel: 1,
      presenceHz: 6200,
      presenceLevel: 1.3,
      snapLevel: 1.3,
      snapSeconds: 0.035,
      denseRate: 14000,
      sparseRate: 1200,
      denseLevel: 0.05,
      buzz: 0.25,
    },
    rimshot: null,
    clap: null,
    warmth: 0.5,
  },
  toms: {
    character: {
      modes: [
        { ratio: 1, level: 1, decay: 1, order: 0 },
        { ratio: 1.5, level: 0.25, decay: 0.5, order: 0.6 },
      ],
      bend: 0.55,
      bendSeconds: 0.09,
      knock: [
        { hz: 1500, level: 0.7, seconds: 0.012, order: 0.3 },
        { hz: 2600, level: 0.6, seconds: 0.01, order: 0.8 },
      ],
      knockLevel: 0.15,
      click: { lowHz: 1200, highHz: 6000, seconds: 0.02, level: 0.8 },
      warmth: 0.5,
    },
    high: [190, 0.42],
    mid: [140, 0.5],
    low: [98, 0.6],
  },
  rim: {
    modes: [
      { hz: 1730, level: 1, seconds: 0.025, order: 0 },
      { hz: 520, level: 0.4, seconds: 0.03, order: 0 },
    ],
    click: { lowHz: 3000, highHz: 12000, seconds: 0.002, level: 0.6 },
  },
  hat: {
    recipe: metal('neon-hat', 51, 14, 1.3),
    voicing: [0.2, 0.4, 0.7, 1, 1.1, 1],
    washLevel: 0.25,
    ring: [0.35, 0.4, 0.5, 0.55, 0.5, 0.4],
    cascade: 10,
    cascadeLevel: 1.5,
    width: 0.3,
    strike: [0.01, 0.04, 0.15, 0.6, 1, 0.8],
    shoulder: [0.03, 0.1, 0.35, 0.8, 1, 0.75],
    open: [0.02, 0.08, 0.3, 0.8, 1, 0.9],
    foot: [0.05, 0.2, 0.5, 0.6, 0.3, 0.1],
    closedRing: [0.025, 0.03, 0.035, 0.04, 0.045, 0.04],
    bloom: [0, 0, 0.05, 0.2, 0.4, 0.4],
    bloomAmount: 0.3,
    riseSeconds: 0.015,
    toneTilt: 10,
    hardTilt: 4,
    tick: { lowHz: 6000, highHz: 15000, seconds: 0.003, level: 0.45 },
    clapHz: 700,
    clapLevel: 0.3,
  },
  ride: {
    recipe: metal('neon-ride', 61, 13, 2.6),
    voicing: [0.3, 0.6, 0.9, 1, 0.9, 0.7],
    washLevel: 0.2,
    ring: [1.5, 1.5, 1.4, 1.2, 1, 0.75],
    cascade: 2,
    cascadeLevel: 2,
    width: 0.5,
    strike: [0.1, 0.35, 0.7, 0.6, 0.35, 0.15],
    bloom: [0, 0, 0.1, 0.2, 0.2, 0.1],
    bloomAmount: 0.2,
    riseSeconds: 0.03,
    toneTilt: 10,
    hardTilt: 5,
    tick: { lowHz: 5000, highHz: 13000, seconds: 0.004, level: 0.5 },
    ping: [
      { hz: 655, level: 0.4, seconds: 0.9 },
      { hz: 1120, level: 0.7, seconds: 0.8 },
      { hz: 1730, level: 1, seconds: 0.7 },
      { hz: 2540, level: 0.9, seconds: 0.5 },
      { hz: 3660, level: 0.7, seconds: 0.4 },
      { hz: 5120, level: 0.5, seconds: 0.3 },
    ],
    pingLevel: 0.45,
  },
  crash: {
    recipe: metal('neon-crash', 71, 12, 2.6),
    voicing: [0.35, 0.65, 0.95, 1, 1, 0.85],
    washLevel: 0.5,
    ring: [1, 1.05, 1, 0.9, 0.75, 0.55],
    cascade: 70,
    cascadeLevel: 1,
    width: 0.8,
    strike: [0.4, 0.9, 0.8, 0.4, 0.12, 0.04],
    bloom: [0, 0.1, 0.3, 0.35, 0.2, 0.08],
    bloomAmount: 0.45,
    riseSeconds: 0.025,
    toneTilt: 10,
    hardTilt: 8,
    tick: { lowHz: 2000, highHz: 8000, seconds: 0.006, level: 0.5 },
  },
  room: { seconds: 1.6, treble: 0.7, size: 1.4, lowCutHz: 180, early: 0.5, gate: { holdSeconds: 0.16, releaseSeconds: 0.035 } },
  roomLevel: 1.3,
  gateFrom: 0.45,
  glue: { threshold: 0.17, attackSeconds: 0.008, releaseSeconds: 0.11, mix: 0.55, makeup: 1.33, sidechainHz: 110, knee: 0.5, ceiling: 0.8 },
  mix: {
    kick: [1.2, 0, 0.05],
    snare: [0.9, 0, 1],
    rim: [0.5, 0.05, 0.4],
    tomHigh: [0.8, -0.35, 0.9],
    tomMid: [0.82, 0.1, 0.9],
    tomLow: [0.86, 0.45, 0.9],
    hat: [0.28, -0.36, 0.05],
    ride: [0.28, 0.4, 0.1],
    crash: [0.3, -0.24, 0.1],
    sweep: [0.5, 0.06, 0.4],
  },
};

/* ---------------------------------------------------------------- garage */

const GARAGE: KitDefinition = {
  kick: {
    modes: [
      { ratio: 1, level: 1, decay: 1, order: 0 },
      { ratio: 2.02, level: 0.18, decay: 0.35, order: 0.8 },
    ],
    dropAtRest: 0.5,
    dropAtPunch: 2.2,
    dropSeconds: 0.011,
    knock: [
      { hz: 1900, level: 0.8, seconds: 0.012, order: 0 },
      { hz: 3100, level: 1, seconds: 0.01, order: 0.4 },
      { hz: 4700, level: 0.7, seconds: 0.008, order: 0.8 },
    ],
    knockLevel: 0.9,
    felt: { hz: 4000, q: 0.7, seconds: 0.005, level: 0.6 },
    warmth: 0.7,
    even: 0.03,
  },
  snare: {
    modes: [
      { ratio: 1, level: 1, seconds: 0.07, order: 0, edge: -0.4 },
      { ratio: 1.7, level: 0.4, seconds: 0.07, order: 0.4, edge: 1 },
      { ratio: 2.6, level: 0.2, seconds: 0.05, order: 0.9, edge: 0.5 },
    ],
    bend: 0.2,
    bendSeconds: 0.01,
    click: { lowHz: 3500, highHz: 13000, seconds: 0.0025, level: 1 },
    wires: {
      level: 0.45,
      lowHz: 1800,
      highHz: 14000,
      bodyHz: 3000,
      bodyLevel: 0.9,
      presenceHz: 7500,
      presenceLevel: 1.2,
      snapLevel: 1.5,
      snapSeconds: 0.02,
      denseRate: 14000,
      sparseRate: 2500,
      denseLevel: 0.04,
      buzz: 0.15,
    },
    rimshot: null,
    clap: { level: 1.8, hz: 1500, q: 1.1, tailSeconds: 0.11 },
    warmth: 0.4,
  },
  toms: {
    character: {
      modes: [{ ratio: 1, level: 1, decay: 1, order: 0 }],
      bend: 0.35,
      bendSeconds: 0.05,
      knock: [{ hz: 2200, level: 0.7, seconds: 0.008, order: 0.3 }],
      knockLevel: 0.12,
      click: { lowHz: 1500, highHz: 7000, seconds: 0.006, level: 0.4 },
      warmth: 0.4,
    },
    high: [205, 0.28],
    mid: [150, 0.32],
    low: [105, 0.38],
  },
  rim: {
    modes: [
      { hz: 860, level: 1, seconds: 0.045, order: 0 },
      { hz: 1310, level: 0.7, seconds: 0.035, order: 0.2 },
      { hz: 2050, level: 0.4, seconds: 0.02, order: 0.5 },
      { hz: 410, level: 0.3, seconds: 0.03, order: 0 },
    ],
    click: { lowHz: 2500, highHz: 10000, seconds: 0.002, level: 0.7 },
  },
  hat: {
    recipe: metal('garage-hat', 83, 16, 1.3),
    voicing: [0.1, 0.3, 0.6, 1, 1.2, 1.1],
    washLevel: 0.25,
    ring: [0.25, 0.3, 0.36, 0.4, 0.36, 0.3],
    cascade: 8,
    cascadeLevel: 1.5,
    width: 0.6,
    strike: [0.01, 0.03, 0.12, 0.55, 1, 0.9],
    shoulder: [0.02, 0.08, 0.3, 0.75, 1, 0.85],
    open: [0.01, 0.05, 0.25, 0.75, 1, 0.95],
    foot: [0.03, 0.15, 0.45, 0.6, 0.35, 0.15],
    closedRing: [0.025, 0.03, 0.036, 0.042, 0.048, 0.042],
    bloom: [0, 0, 0.05, 0.2, 0.4, 0.4],
    bloomAmount: 0.25,
    riseSeconds: 0.012,
    toneTilt: 10,
    hardTilt: 4,
    tick: { lowHz: 7000, highHz: 16000, seconds: 0.0025, level: 0.45 },
    clapHz: 800,
    clapLevel: 0.25,
  },
  ride: {
    recipe: metal('garage-ride', 91, 14, 2.6),
    voicing: [0.2, 0.45, 0.8, 1, 1, 0.85],
    washLevel: 0.2,
    ring: [1.4, 1.5, 1.5, 1.4, 1.2, 0.9],
    cascade: 2,
    cascadeLevel: 2,
    width: 0.45,
    strike: [0.05, 0.25, 0.6, 0.7, 0.45, 0.2],
    bloom: [0, 0, 0.1, 0.2, 0.2, 0.1],
    bloomAmount: 0.2,
    riseSeconds: 0.02,
    toneTilt: 10,
    hardTilt: 5,
    tick: { lowHz: 6000, highHz: 14000, seconds: 0.003, level: 0.5 },
    ping: [
      { hz: 980, level: 0.5, seconds: 0.6 },
      { hz: 1650, level: 0.8, seconds: 0.5 },
      { hz: 2480, level: 1, seconds: 0.45 },
      { hz: 3600, level: 0.9, seconds: 0.35 },
      { hz: 5200, level: 0.6, seconds: 0.25 },
    ],
    pingLevel: 0.4,
  },
  crash: {
    recipe: metal('garage-crash', 97, 13, 2.6),
    voicing: [0.25, 0.5, 0.85, 1, 1.05, 0.95],
    washLevel: 0.5,
    ring: [0.9, 1, 1, 0.9, 0.75, 0.6],
    cascade: 80,
    cascadeLevel: 0.8,
    width: 0.7,
    strike: [0.25, 0.7, 0.85, 0.5, 0.2, 0.06],
    bloom: [0, 0.05, 0.25, 0.35, 0.25, 0.1],
    bloomAmount: 0.4,
    riseSeconds: 0.02,
    toneTilt: 10,
    hardTilt: 8,
    tick: { lowHz: 2500, highHz: 9000, seconds: 0.005, level: 0.5 },
  },
  room: { seconds: 0.32, treble: 0.8, size: 0.7, lowCutHz: 250, early: 1 },
  roomLevel: 0.8,
  glue: { threshold: 0.12, attackSeconds: 0.02, releaseSeconds: 0.09, mix: 0.65, makeup: 1.4, sidechainHz: 120, knee: 0.5, ceiling: 0.8 },
  mix: {
    kick: [1.3, 0, 0.03],
    snare: [0.85, 0, 0.5],
    rim: [0.6, 0.12, 0.4],
    tomHigh: [0.75, -0.35, 0.3],
    tomMid: [0.77, 0.1, 0.3],
    tomLow: [0.8, 0.45, 0.3],
    hat: [0.28, -0.36, 0.1],
    ride: [0.28, 0.4, 0.1],
    crash: [0.28, -0.24, 0.2],
    sweep: [0.5, 0.06, 0.3],
  },
};

export const STUDIO_KITS: Readonly<Record<StudioKitId, KitDefinition>> = { rock: ROCK, neon: NEON, garage: GARAGE };

/** The cymbals whose tables a kit needs, so that the page can build them before the audio thread asks. */
export function kitMetalRecipes(id: DrumKitId): MetalRecipe[] {
  if (!isStudioKitId(id)) return [];
  const kit = STUDIO_KITS[id];
  return [kit.hat.recipe, kit.ride.recipe, kit.crash.recipe];
}

/** A cymbal's tables with the recipe that made them, in a form that can be sent to the audio thread. */
export interface PreparedMetal {
  recipe: MetalRecipe;
  bands: Float32Array[];
}

/**
 * Build (once) the tables a kit's cymbals need, on the thread that calls
 * this. The page does it and hands the result to the audio thread, which
 * would otherwise stop for a few hundredths of a second to do the same.
 */
export function prepareKitMetal(id: DrumKitId, sampleRate: number): PreparedMetal[] {
  return kitMetalRecipes(id).map((recipe) => ({ recipe, bands: metalTables(recipe, sampleRate).bands }));
}

export class StudioKit implements DrumKit {
  readonly id: StudioKitId;
  readonly strips: readonly KitStrip[];
  readonly roomSeconds: number;
  readonly roomLevel: number;
  readonly room: DrumRoom;
  readonly bus: GlueBus;
  private readonly definition: KitDefinition;
  private readonly random: Random;
  private readonly kick: ShellKick;
  private readonly snare: ShellSnare;
  private readonly rim: ShellRim;
  private readonly tomHigh: ShellTom;
  private readonly tomMid: ShellTom;
  private readonly tomLow: ShellTom;
  private readonly hat: TableHiHat;
  private readonly ride: TableRide;
  private readonly crash: TableCrash;
  private readonly sweep: BrushSweep;
  private variation = 0.5;

  constructor(id: StudioKitId, sampleRate: number, params: DrumParams, random: Random) {
    const definition = STUDIO_KITS[id];
    this.id = id;
    this.definition = definition;
    this.random = random;
    this.roomSeconds = definition.room.seconds;
    this.roomLevel = definition.roomLevel;
    this.room = new DrumRoom(sampleRate, definition.room);
    this.bus = new GlueBus(sampleRate, definition.glue);
    const { toms, mix } = definition;
    this.kick = new ShellKick(sampleRate, definition.kick, { hz: params.kickHz, decay: params.kickDecay, punch: params.kickPunch }, random);
    this.snare = new ShellSnare(sampleRate, definition.snare, { hz: params.snareHz, wires: params.snareWires, decay: params.snareDecay }, random);
    this.rim = new ShellRim(sampleRate, definition.rim, random);
    this.tomHigh = new ShellTom(sampleRate, toms.character, toms.high[0], toms.high[1], random);
    this.tomMid = new ShellTom(sampleRate, toms.character, toms.mid[0], toms.mid[1], random);
    this.tomLow = new ShellTom(sampleRate, toms.character, toms.low[0], toms.low[1], random);
    this.hat = new TableHiHat(sampleRate, definition.hat, random);
    this.ride = new TableRide(sampleRate, definition.ride, random);
    this.crash = new TableCrash(sampleRate, definition.crash, random);
    this.sweep = new BrushSweep(sampleRate, random);
    this.strips = [
      strip(this.kick, ...mix.kick),
      strip(this.snare, ...mix.snare),
      strip(this.rim, ...mix.rim),
      strip(this.tomHigh, ...mix.tomHigh),
      strip(this.tomMid, ...mix.tomMid),
      strip(this.tomLow, ...mix.tomLow),
      strip(this.hat, ...mix.hat, true),
      strip(this.ride, ...mix.ride, true),
      strip(this.crash, ...mix.crash, true),
      strip(this.sweep, ...mix.sweep),
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
    const { random, variation } = this;
    const vary = strokeVariation(random, variation);
    const gateFrom = this.definition.gateFrom;
    switch (piece) {
      case 'kick':
        this.kick.strike(velocity, vary);
        break;
      case 'snare':
        this.snare.strike(velocity, vary);
        // a gated room opens for a stroke that means it; a ghost note stays dry
        if (gateFrom !== undefined && velocity >= gateFrom) this.room.open();
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
        this.tomHigh.strike(velocity, vary);
        if (gateFrom !== undefined && velocity >= gateFrom) this.room.open(1.1);
        break;
      case 'tomMid':
        this.tomMid.strike(velocity, vary);
        if (gateFrom !== undefined && velocity >= gateFrom) this.room.open(1.2);
        break;
      case 'tomLow':
        this.tomLow.strike(velocity, vary);
        if (gateFrom !== undefined && velocity >= gateFrom) this.room.open(1.3);
        break;
      case 'hatClosed':
        this.hat.closed(velocity, vary, variation);
        break;
      case 'hatOpen':
        this.hat.open(velocity, vary, variation);
        break;
      case 'hatFoot':
        this.hat.foot(velocity, vary, variation);
        break;
      case 'ride':
        this.ride.strike(velocity, vary, variation);
        break;
      case 'crash':
        this.crash.strike(velocity, vary, variation);
        break;
    }
  }

  get busy(): boolean {
    for (const { voice } of this.strips) if (voice.active) return true;
    return false;
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
