/**
 * The drum kits' controls, in a drummer's terms, and the names of the kits
 * and of the pieces a groove can ask for.
 *
 * See docs/specs/S2-drums.md for what each control does to the sound and
 * docs/sound/drums.md for why the kits are built the way they are.
 */

/**
 * `acoustic` aims at a real kit, as far as synthesis gets. `machine` is a
 * drum machine in the early-1980s analogue tradition. `brushes` is the
 * acoustic kit played with wire brushes.
 */
export type DrumKitId = 'acoustic' | 'machine' | 'brushes';

export const DRUM_KIT_IDS: readonly DrumKitId[] = ['acoustic', 'machine', 'brushes'];

export const DRUM_KIT_LABELS: Readonly<Record<DrumKitId, string>> = {
  acoustic: 'Acoustic',
  machine: 'Machine',
  brushes: 'Brushes',
};

/**
 * What a groove can ask a kit to play. Every kit answers every piece: a kit
 * with no brushes plays a `brushTap` as a soft snare stroke, and so on.
 */
export type DrumPiece =
  | 'kick'
  | 'snare'
  /** A cross-stick: the stick laid on the head, striking the rim. */
  | 'rim'
  | 'hatClosed'
  | 'hatOpen'
  /** The hi-hat closed with the foot alone. */
  | 'hatFoot'
  | 'ride'
  | 'crash'
  | 'tomHigh'
  | 'tomMid'
  | 'tomLow'
  /** A brush tapped on the snare head. */
  | 'brushTap'
  /** A brush swept across the snare head, for as long as the hit's duration. */
  | 'brushSweep';

export const DRUM_PIECES: readonly DrumPiece[] = [
  'kick',
  'snare',
  'rim',
  'hatClosed',
  'hatOpen',
  'hatFoot',
  'ride',
  'crash',
  'tomHigh',
  'tomMid',
  'tomLow',
  'brushTap',
  'brushSweep',
];

export function isDrumPiece(value: unknown): value is DrumPiece {
  return typeof value === 'string' && (DRUM_PIECES as readonly string[]).includes(value);
}

export function isDrumKitId(value: unknown): value is DrumKitId {
  return typeof value === 'string' && (DRUM_KIT_IDS as readonly string[]).includes(value);
}

export interface DrumParams {
  /** The kick's resting pitch, in hertz. */
  kickHz: number;
  /** How long the kick rings: the time its body takes to fall by 60 dB, in seconds. */
  kickDecay: number;
  /** The kick's attack: the beater's click and how far the pitch starts above its resting note, 0 to 1. */
  kickPunch: number;
  /** The snare head's lowest pitch, in hertz. */
  snareHz: number;
  /** How much of the snare is wires: 0 is a drum with the snares off, 1 is nearly all rattle. */
  snareWires: number;
  /** How long the wires rattle after a full stroke: the time to fall by 60 dB, in seconds. */
  snareDecay: number;
  /** Hi-hat brightness, 0 (dark, heavy cymbals) to 1 (thin and bright). */
  hatTone: number;
  /** Hi-hat length, 0 (tight) to 1 (loose): how long a closed tick and an open ring last. */
  hatDecay: number;
  /** Ride and crash brightness, 0 to 1. */
  cymbalTone: number;
  /** How long the crash rings: the time to fall by 60 dB, in seconds. The ride follows it. */
  cymbalDecay: number;
  /** The room around the kit, 0 (dry) to 1. On the machine kit it is the gated burst behind the snare and toms. */
  room: number;
  /** How hard the drums are pushed into the bus's soft clipper, 0 to 1. */
  drive: number;
  /** How much one stroke differs from the next, 0 to 1. Pitch and timing never vary. */
  variation: number;
}

export type DrumParamKey = keyof DrumParams;

export interface DrumParamSpec {
  key: DrumParamKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** One line for the sound lab. */
  hint: string;
}

/** The controls in the order the sound lab shows them, with their ranges. */
export const DRUM_PARAM_SPECS: readonly DrumParamSpec[] = [
  { key: 'kickHz', label: 'Kick tune', min: 36, max: 90, step: 1, unit: 'Hz', hint: 'The kick’s resting pitch' },
  { key: 'kickDecay', label: 'Kick decay', min: 0.1, max: 2, step: 0.01, unit: 's', hint: 'Damped thud to open boom' },
  { key: 'kickPunch', label: 'Kick punch', min: 0, max: 1, step: 0.01, unit: '', hint: 'The beater’s click and the pitch drop' },
  { key: 'snareHz', label: 'Snare tune', min: 130, max: 280, step: 1, unit: 'Hz', hint: 'The head’s lowest pitch' },
  { key: 'snareWires', label: 'Snares', min: 0, max: 1, step: 0.01, unit: '', hint: 'How much of the sound is wires' },
  { key: 'snareDecay', label: 'Snare decay', min: 0.06, max: 0.6, step: 0.01, unit: 's', hint: 'How long the wires rattle' },
  { key: 'hatTone', label: 'Hat tone', min: 0, max: 1, step: 0.01, unit: '', hint: 'Dark and heavy to thin and bright' },
  { key: 'hatDecay', label: 'Hat length', min: 0, max: 1, step: 0.01, unit: '', hint: 'Tight to loose' },
  { key: 'cymbalTone', label: 'Cymbal tone', min: 0, max: 1, step: 0.01, unit: '', hint: 'Ride and crash brightness' },
  { key: 'cymbalDecay', label: 'Cymbal ring', min: 0.4, max: 5, step: 0.05, unit: 's', hint: 'How long the crash rings; the ride follows it' },
  { key: 'room', label: 'Room', min: 0, max: 1, step: 0.01, unit: '', hint: 'The room around the kit; on the machine kit, the gated burst' },
  { key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, unit: '', hint: 'How hard the drums hit the bus’s soft clipper' },
  { key: 'variation', label: 'Variation', min: 0, max: 1, step: 0.01, unit: '', hint: 'Difference from one stroke to the next' },
];

export const DEFAULT_DRUM_PARAMS: Readonly<Record<DrumKitId, DrumParams>> = {
  acoustic: {
    kickHz: 58,
    kickDecay: 0.32,
    kickPunch: 0.5,
    snareHz: 192,
    snareWires: 0.55,
    snareDecay: 0.24,
    hatTone: 0.5,
    hatDecay: 0.5,
    cymbalTone: 0.5,
    cymbalDecay: 2.2,
    room: 0.35,
    drive: 0.3,
    variation: 0.6,
  },
  machine: {
    kickHz: 50,
    kickDecay: 0.5,
    kickPunch: 0.6,
    snareHz: 178,
    snareWires: 0.6,
    snareDecay: 0.2,
    hatTone: 0.55,
    hatDecay: 0.4,
    cymbalTone: 0.5,
    cymbalDecay: 1.4,
    room: 0.5,
    drive: 0.5,
    variation: 0.25,
  },
  brushes: {
    kickHz: 62,
    kickDecay: 0.38,
    kickPunch: 0.25,
    snareHz: 205,
    snareWires: 0.5,
    snareDecay: 0.2,
    hatTone: 0.4,
    hatDecay: 0.5,
    cymbalTone: 0.42,
    cymbalDecay: 2.6,
    room: 0.45,
    drive: 0.15,
    variation: 0.7,
  },
};

/** Whether two sets of controls are the same, dial for dial. */
export function sameDrumParams(a: DrumParams, b: DrumParams): boolean {
  return DRUM_PARAM_SPECS.every((spec) => a[spec.key] === b[spec.key]);
}

/** Complete, in-range parameters from anything: saved settings, a message, a partial change. */
export function sanitizeDrumParams(input: unknown, base: DrumParams): DrumParams {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Partial<Record<DrumParamKey, unknown>>;
  const result = { ...base };
  for (const spec of DRUM_PARAM_SPECS) {
    const value = source[spec.key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[spec.key] = Math.min(spec.max, Math.max(spec.min, value));
    }
  }
  return result;
}
