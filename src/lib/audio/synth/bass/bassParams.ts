/**
 * The modelled bass's controls, in a player's terms, and the instrument's
 * fixed facts: its strings and where a note is fretted.
 *
 * See docs/specs/S1-modelled-bass.md for what each control does to the sound
 * and docs/sound/research.md for why it is there.
 */

export interface BassParams {
  /** The pluck: 0 is a soft fingertip, 1 is a pick. Sets how quickly the string is let go. */
  hardness: number;
  /** Where the string is plucked, in centimetres from the bridge. */
  pluckCm: number;
  /** Where the pickup sits, in centimetres from the bridge. */
  pickupCm: number;
  /** The pickup and tone control: a resonant low-pass, in hertz. */
  toneHz: number;
  /** String age: the T60 at 1 kHz, in seconds. New roundwound strings ring for 2 s or more, dead ones 0.2 s. */
  ringSeconds: number;
  /** How long a held note lasts: the fundamental's T60 on the open A string, in seconds. */
  sustainSeconds: number;
  /** Stiffness, as a multiple of each string's estimated value. 0 gives exact harmonics. */
  stiffness: number;
  /** Amplifier drive, 0 to 1. */
  drive: number;
  /** How sharp a full-strength pluck starts, in cents. The pitch settles as the note fades. */
  bloomCents: number;
  /** How long a damped note takes to stop, in seconds. */
  releaseSeconds: number;
  /** How much one pluck differs from the next, 0 to 1. Pitch and timing never vary. */
  variation: number;
  /** Finger noise in the pluck, 0 to 1. */
  noise: number;
}

export type BassParamKey = keyof BassParams;

export interface BassParamSpec {
  key: BassParamKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** One line for the sound lab. */
  hint: string;
}

export const DEFAULT_BASS_PARAMS: BassParams = {
  hardness: 0.35,
  pluckCm: 16,
  pickupCm: 14,
  toneHz: 2200,
  ringSeconds: 1.6,
  sustainSeconds: 9,
  stiffness: 1,
  drive: 0.25,
  bloomCents: 6,
  releaseSeconds: 0.08,
  variation: 0.5,
  noise: 0.5,
};

/** The controls in the order the sound lab shows them, with their ranges. */
export const BASS_PARAM_SPECS: readonly BassParamSpec[] = [
  { key: 'hardness', label: 'Pluck', min: 0, max: 1, step: 0.01, unit: '', hint: 'Soft fingertip to pick' },
  { key: 'pluckCm', label: 'Pluck at', min: 4, max: 30, step: 0.5, unit: 'cm', hint: 'From the bridge: near is thin, far is round' },
  { key: 'pickupCm', label: 'Pickup at', min: 4, max: 24, step: 0.5, unit: 'cm', hint: 'From the bridge: 14 is a P-style, 6 a J bridge pickup' },
  { key: 'toneHz', label: 'Tone', min: 300, max: 6000, step: 50, unit: 'Hz', hint: 'The tone knob' },
  { key: 'ringSeconds', label: 'String age', min: 0.15, max: 4, step: 0.05, unit: 's', hint: 'How long the brightness rings: new strings high, dead strings low' },
  { key: 'sustainSeconds', label: 'Sustain', min: 1, max: 20, step: 0.5, unit: 's', hint: 'How long a held note lasts' },
  { key: 'stiffness', label: 'Stiffness', min: 0, max: 2, step: 0.05, unit: '×', hint: '0 is a perfectly harmonic string' },
  { key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.01, unit: '', hint: 'Amplifier saturation' },
  { key: 'bloomCents', label: 'Pitch bloom', min: 0, max: 30, step: 1, unit: 'c', hint: 'How sharp a hard pluck starts' },
  { key: 'releaseSeconds', label: 'Release', min: 0.02, max: 0.4, step: 0.01, unit: 's', hint: 'How fast a damped note stops' },
  { key: 'variation', label: 'Variation', min: 0, max: 1, step: 0.01, unit: '', hint: 'Difference from one pluck to the next' },
  { key: 'noise', label: 'Finger noise', min: 0, max: 1, step: 0.01, unit: '', hint: 'Skin on the windings' },
];

/** Starting points for the sound lab. Each lists only what differs from the default. */
export const BASS_PRESETS: Readonly<Record<string, Partial<BassParams>>> = {
  round: {},
  motown: { hardness: 0.2, pluckCm: 18, toneHz: 900, ringSeconds: 0.3, sustainSeconds: 4, drive: 0.5, releaseSeconds: 0.1 },
  bright: { hardness: 0.5, pluckCm: 9, pickupCm: 6.5, toneHz: 4200, ringSeconds: 2.8, sustainSeconds: 11, drive: 0.4 },
  pick: { hardness: 0.9, pluckCm: 12, toneHz: 3200, ringSeconds: 1.8, drive: 0.4, noise: 0.7 },
};

/** Complete, in-range parameters from anything: saved settings, a message, a partial change. */
export function sanitizeBassParams(input: unknown, base: BassParams = DEFAULT_BASS_PARAMS): BassParams {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Partial<Record<BassParamKey, unknown>>;
  const result = { ...base };
  for (const spec of BASS_PARAM_SPECS) {
    const value = source[spec.key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[spec.key] = Math.min(spec.max, Math.max(spec.min, value));
    }
  }
  return result;
}

/** A long-scale (34 inch) bass. */
export const SCALE_LENGTH_M = 0.864;

/** The lowest and highest notes the model accepts: B0 (a five-string's low B) to C5. */
export const BASS_MIN_MIDI = 23;
export const BASS_MAX_MIDI = 72;

export interface BassString {
  name: string;
  openMidi: number;
  /**
   * The open string's inharmonicity coefficient B. Estimated from the stiff-string
   * formula B = π³·E·d⁴ / (64·T·L²) with a steel core (E = 200 GPa), core
   * diameters of 0.66, 0.56, 0.50 and 0.43 mm and tensions of 179, 215, 228
   * and 190 N for a 105-85-65-45 set. An estimate, not a measurement: the
   * Stiffness control scales it.
   */
  inharmonicity: number;
}

export const BASS_STRINGS: readonly BassString[] = [
  { name: 'E', openMidi: 28, inharmonicity: 1.4e-4 },
  { name: 'A', openMidi: 33, inharmonicity: 5.9e-5 },
  { name: 'D', openMidi: 38, inharmonicity: 3.6e-5 },
  { name: 'G', openMidi: 43, inharmonicity: 2.3e-5 },
];

export interface Fingering {
  /** Index into `BASS_STRINGS`. */
  string: number;
  /** 0 is the open string. Below the open E the string is treated as tuned down. */
  fret: number;
}

/**
 * Where a bassist would play this note in the low positions: fretted at
 * frets 1 to 5 where there is a choice, so a root and its 5th sit one string
 * apart in the same hand position and the tone stays even. Only the low E is
 * an open string. Notes above the D string's 5th fret go up the G string.
 */
export function fingerBass(midi: number): Fingering {
  const note = Math.round(midi);
  if (note <= BASS_STRINGS[0].openMidi) return { string: 0, fret: 0 };
  for (let string = 0; string < BASS_STRINGS.length - 1; string++) {
    if (note <= BASS_STRINGS[string].openMidi + 5) return { string, fret: note - BASS_STRINGS[string].openMidi };
  }
  const top = BASS_STRINGS.length - 1;
  return { string: top, fret: note - BASS_STRINGS[top].openMidi };
}

/** MIDI note number to hertz (A4 = 440). */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
