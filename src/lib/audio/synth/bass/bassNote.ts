/**
 * One note of the modelled bass, worked out before it sounds: where it is
 * fretted, how long its delay loop is, how its partials fade, how stiff the
 * string is, what the pluck looks like and what the pickup hears.
 *
 * Everything is derived from physical quantities (hertz, seconds,
 * centimetres), so the note is the same at any sample rate. The string voice
 * (`bassString.ts`) only runs the numbers this produces.
 */
import { designLoop, designLossFilter, hannPulseGain, stiffPartial } from '../dsp/stringFilters';
import { BASS_STRINGS, SCALE_LENGTH_M, fingerBass, midiToHz, type BassParams } from './bassParams';

/** All-pass sections in the loop for stiffness. */
export const STIFFNESS_SECTIONS = 6;
/** The release of a soft fingertip and of a pick, in seconds: the width of the pluck pulse. */
const SOFT_PLUCK_SECONDS = 2.4e-3;
const PICK_PLUCK_SECONDS = 0.25e-3;
/** The length of string a pickup senses, in metres. */
const PICKUP_APERTURE_M = 0.025;
/** The resonance of the pickup circuit. */
export const TONE_Q = 1.2;
/** Sets the level into the amplifier: a full-strength note peaks near 1 there. */
const LEVEL_REFERENCE = 0.36;
/** Loss and stiffness are both pinned at this frequency. */
const REFERENCE_HZ = 1000;

export interface NoteDesign {
  /** Index into `BASS_STRINGS`. */
  string: number;
  /** The note's frequency in hertz, and its period in samples. */
  frequency: number;
  period: number;
  /** Delay-line length in samples with the string at rest. */
  delay: number;
  /** The stiffness all-pass coefficient. */
  allpass: number;
  /** The loss filter: gain at 0 Hz and pole. */
  lossGain: number;
  lossPole: number;
  /** Pluck pulse width in samples. */
  pulseSamples: number;
  /** The pluck's strength: the height of the velocity step it sends along the string. */
  amplitude: number;
  /** Delay between the pluck pulse and its inverted reflection, in samples. */
  pluckDelay: number;
  /** Delay between the two waves the pickup hears, in samples. */
  pickupDelay: number;
  /** Finger noise, relative to the pluck, and the pole of its low-pass. */
  noiseLevel: number;
  noisePole: number;
  /** How much shorter the delay is at full string energy (the pitch bloom), in samples. */
  bloomSamples: number;
  /** The tracked energy at the pluck, and the factor that makes a full-strength pluck 1. */
  energyStart: number;
  energyScale: number;
  /** Turns the pickup's velocity signal into displacement: 2π · frequency / sample rate. */
  displacementRate: number;
}

/** Small per-note offsets, each from -1 to 1, drawn by the synth for variation. */
export interface NoteVariation {
  position: number;
  hardness: number;
  level: number;
}

export const NO_VARIATION: NoteVariation = { position: 0, hardness: 0, level: 0 };

/**
 * The level the pickup filter puts out for a steady pluck of unit strength:
 * the partials of an ideal pluck (1/n, with the pluck's and the pickup's
 * positions each removing their pattern), shaped by the pluck pulse and the
 * pickup's low-pass. Dividing by it evens out the loudness from note to note,
 * as a compressor would.
 */
export function expectedLevel(
  pluckFraction: number,
  pickupFraction: number,
  frequency: number,
  pulseSeconds: number,
  toneHz: number,
): number {
  let sum = 0;
  for (let n = 1; n <= 96; n++) {
    const f = n * frequency;
    if (f > 6000) break;
    const r = f / toneHz;
    const pickup = 1 / Math.sqrt((1 - r * r) ** 2 + (r / TONE_Q) ** 2);
    const partial =
      ((Math.sin(n * Math.PI * pluckFraction) * Math.sin(n * Math.PI * pickupFraction)) / n) *
      hannPulseGain(f, pulseSeconds) *
      pickup;
    sum += partial * partial;
  }
  return Math.max(0.05, Math.sqrt(sum));
}

/** Work out one note. `velocity` is 0 to 1. */
export function designNote(
  midi: number,
  velocity: number,
  params: BassParams,
  sampleRate: number,
  variation: NoteVariation = NO_VARIATION,
): NoteDesign {
  const { string, fret } = fingerBass(midi);
  const openString = BASS_STRINGS[string];
  const frequency = midiToHz(midi);
  const period = sampleRate / frequency;
  const spread = params.variation;

  // Where the hand and the pickup are along the sounding length. Both stay put
  // on the body while fretting shortens the string.
  const soundingLength = SCALE_LENGTH_M * 2 ** (-fret / 12);
  const edge = 0.02 * soundingLength;
  const pluckM = clamp(params.pluckCm / 100 + variation.position * spread * 0.012, edge, soundingLength - edge);
  const pickupM = clamp(params.pickupCm / 100, edge, soundingLength - edge);
  const pluckFraction = pluckM / soundingLength;
  const pickupFraction = pickupM / soundingLength;
  // The pickup hears the wave heading for the bridge and then its reflection.
  // With the pluck on the neck side of the pickup (the usual place), the
  // second pluck pulse is the one that went to the nut and back.
  const neckSide = pluckFraction >= pickupFraction;
  const pluckDelay = (neckSide ? 1 - pluckFraction : pluckFraction) * period;
  const pickupDelay = (neckSide ? pickupFraction : 1 - pickupFraction) * period;

  // Loss: how long the fundamental and the brightness last.
  const fundamentalT60 = clamp(params.sustainSeconds * (55 / frequency) ** 0.3 * (fret > 0 ? 0.85 : 1), 0.5, 30);
  const loss = designLossFilter({
    noteFrequency: frequency,
    fundamentalT60,
    referenceFrequency: REFERENCE_HZ,
    referenceT60: Math.min(params.ringSeconds, fundamentalT60),
    sampleRate,
  });

  // Stiffness: the string's own, more as it is fretted shorter.
  const inharmonicity = openString.inharmonicity * 2 ** (Math.max(0, fret) / 6) * params.stiffness;
  const referencePartial = clamp(Math.round(REFERENCE_HZ / frequency), 2, 40);
  const loop = designLoop({
    noteFrequency: frequency,
    referencePartial,
    referenceFrequency: stiffPartial(referencePartial, frequency, inharmonicity),
    sections: STIFFNESS_SECTIONS,
    lossPole: loss.p,
    sampleRate,
  });

  // The pluck: a harder or faster one lets go more quickly. The pickup's width
  // blurs it a little more, most on the slow, heavy strings.
  const hardness = clamp(params.hardness + variation.hardness * spread * 0.06, 0, 1);
  const releaseSeconds =
    SOFT_PLUCK_SECONDS ** (1 - hardness) * PICK_PLUCK_SECONDS ** hardness * (1.6 - 0.9 * velocity);
  const waveSpeed = 2 * SCALE_LENGTH_M * midiToHz(openString.openMidi);
  const apertureSeconds = PICKUP_APERTURE_M / waveSpeed;
  const pulseSeconds = Math.sqrt(releaseSeconds ** 2 + 2.55 * apertureSeconds ** 2);

  const fullAmplitude =
    LEVEL_REFERENCE / expectedLevel(pluckFraction, pickupFraction, frequency, pulseSeconds, params.toneHz);
  const amplitude = velocity * fullAmplitude * 10 ** ((variation.level * spread * 0.8) / 20);

  // The pickup's velocity signal is two offset square-ish waves; this is its mean square per unit strength.
  const pluckDuty = pluckDelay / period;
  const pickupDuty = pickupDelay / period;
  const energyPerUnit = 2 * Math.min(pluckDuty, 1 - pluckDuty, pickupDuty, 1 - pickupDuty);

  return {
    string,
    frequency,
    period,
    delay: loop.delay,
    allpass: loop.allpass,
    lossGain: loss.g,
    lossPole: loss.p,
    pulseSamples: Math.max(3, pulseSeconds * sampleRate),
    amplitude,
    pluckDelay,
    pickupDelay,
    noiseLevel: params.noise * (0.15 + 0.3 * hardness),
    noisePole: Math.exp((-2 * Math.PI * (1200 + 5000 * hardness)) / sampleRate),
    bloomSamples: period * (2 ** (params.bloomCents / 1200) - 1),
    energyStart: amplitude * amplitude * energyPerUnit,
    energyScale: 1 / (fullAmplitude * fullAmplitude * energyPerUnit),
    displacementRate: (2 * Math.PI * frequency) / sampleRate,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
