/**
 * Designing the filters inside a string's delay loop from physical targets:
 * how long partials ring (loss) and how sharp the upper ones are (stiffness).
 *
 * A string model is a loop: a delay line, then these filters, back into the
 * delay line. The wave goes round once per period, so anything a filter does
 * is done once per period. Two consequences run through this file:
 *
 * - A partial at frequency f that meets a loop gain G each round fades with
 *   T60 = 6.91 / (-f0 * ln G) seconds, where f0 is the note's frequency.
 * - The loop's partials sit where its total phase lag is a whole number of
 *   turns. Every filter adds lag, so the delay line is shortened to keep the
 *   fundamental in tune, and filters whose delay falls with frequency push
 *   the upper partials sharp, as a stiff string does.
 *
 * Angles (`w`) are in radians per sample: 2π · frequency / sample rate.
 */

/** ln(1000): a fall of 60 dB as a natural-log ratio. */
const LN_60_DB = Math.log(1000);

/** The gain per round trip that gives a partial this T60 on a note of this frequency. */
export function gainPerRoundTrip(t60Seconds: number, noteFrequency: number): number {
  return Math.exp(-LN_60_DB / (t60Seconds * noteFrequency));
}

/** The T60 that a gain per round trip gives, in seconds. */
export function t60FromGain(gain: number, noteFrequency: number): number {
  return LN_60_DB / (-noteFrequency * Math.log(gain));
}

/**
 * The loss filter: a one-pole low-pass, y[n] = g·(1 − p)·x[n] + p·y[n−1].
 * `g` is its gain at 0 Hz and `p` (0 to 1) sets how soon the treble falls.
 */
export interface LossFilter {
  g: number;
  p: number;
}

/**
 * Design the loss filter from two decay times: the fundamental's T60 and the
 * T60 at a reference frequency higher up. In the spirit of Bank and Välimäki,
 * "Robust loss filter design for digital waveguide synthesis of string tones"
 * (2003), reduced to the one-pole case, which has a closed form.
 */
export function designLossFilter(target: {
  noteFrequency: number;
  fundamentalT60: number;
  referenceFrequency: number;
  referenceT60: number;
  sampleRate: number;
}): LossFilter {
  const { noteFrequency, sampleRate } = target;
  const w1 = (2 * Math.PI * noteFrequency) / sampleRate;
  const wr = (2 * Math.PI * Math.max(target.referenceFrequency, noteFrequency * 2)) / sampleRate;
  const gain1 = gainPerRoundTrip(target.fundamentalT60, noteFrequency);
  const gainR = Math.min(gain1, gainPerRoundTrip(target.referenceT60, noteFrequency));
  // |H(w)|² = g²(1−p)² / (1 − 2p·cos w + p²). The ratio of the two gains fixes p.
  const ratio = (gainR / gain1) ** 2;
  let p = 0;
  if (ratio < 1 - 1e-12) {
    const k = (Math.cos(w1) - ratio * Math.cos(wr)) / (1 - ratio);
    p = k - Math.sqrt(Math.max(0, k * k - 1));
  }
  p = Math.min(0.995, Math.max(0, p));
  // Then g puts the fundamental's gain where it was asked for. It stays under 1, so the loop is stable at 0 Hz.
  const g = Math.min(0.99995, (gain1 * Math.sqrt(1 - 2 * p * Math.cos(w1) + p * p)) / (1 - p));
  return { g, p };
}

/** The loss filter's gain at `w`. */
export function lossGain(filter: LossFilter, w: number): number {
  const { g, p } = filter;
  return (g * (1 - p)) / Math.sqrt(1 - 2 * p * Math.cos(w) + p * p);
}

/** The loss filter's phase lag at `w`, in radians. */
export function lossPhaseLag(p: number, w: number): number {
  return Math.atan2(p * Math.sin(w), 1 - p * Math.cos(w));
}

/**
 * The phase lag of one first-order all-pass section,
 * y[n] = a·x[n] + x[n−1] − a·y[n−1], at `w`. With `a` below zero it delays low
 * frequencies more than high ones, which is what stiffness does to a string
 * (Van Duyne and Smith, 1994).
 */
export function allpassPhaseLag(a: number, w: number): number {
  return 2 * Math.atan(((1 - a) / (1 + a)) * Math.tan(w / 2));
}

/**
 * Where partial `n` of a stiff string sits when its first partial is at
 * `fundamental`: n·f·√((1 + B·n²) / (1 + B)), with B the inharmonicity
 * coefficient (Fletcher, Blackham and Stratton, 1962).
 */
export function stiffPartial(n: number, fundamental: number, inharmonicity: number): number {
  return n * fundamental * Math.sqrt((1 + inharmonicity * n * n) / (1 + inharmonicity));
}

export interface LoopDesign {
  /** The all-pass coefficient shared by every stiffness section. */
  allpass: number;
  /** The delay-line length, in samples, that puts the fundamental exactly in tune. */
  delay: number;
}

/**
 * Tune a string loop and set its stiffness.
 *
 * The loop is: a delay of `delay` samples, the loss filter (pole `lossPole`),
 * and `sections` identical all-pass filters. This finds the all-pass
 * coefficient that puts partial `referencePartial` at `referenceFrequency`
 * while the fundamental stays exactly at `noteFrequency`, by bisection: more
 * negative coefficients always move the reference partial sharper.
 *
 * A chain of first-order sections follows the stiff-string curve closely up
 * to the reference partial and flattens out above it. Designs that hold the
 * curve further (Rauhala and Välimäki 2006; Abel, Välimäki and Smith 2010)
 * are for instruments with more treble than a bass.
 */
export function designLoop(target: {
  noteFrequency: number;
  referencePartial: number;
  referenceFrequency: number;
  sections: number;
  lossPole: number;
  sampleRate: number;
}): LoopDesign {
  const { sections, lossPole, referencePartial } = target;
  const w1 = (2 * Math.PI * target.noteFrequency) / target.sampleRate;
  const wr = (2 * Math.PI * target.referenceFrequency) / target.sampleRate;
  const delayFor = (a: number) =>
    (2 * Math.PI - lossPhaseLag(lossPole, w1) - sections * allpassPhaseLag(a, w1)) / w1;
  // How far the reference partial's total lag is from a whole number of turns.
  const error = (a: number) =>
    wr * delayFor(a) + lossPhaseLag(lossPole, wr) + sections * allpassPhaseLag(a, wr) - 2 * Math.PI * referencePartial;

  let low = -0.97; // stiffest
  let high = 0.6; // the other way: cancels the loss filter's own sharpening
  let a: number;
  if (error(low) >= 0) a = low;
  else if (error(high) <= 0) a = high;
  else {
    for (let i = 0; i < 48; i++) {
      const middle = (low + high) / 2;
      if (error(middle) < 0) low = middle;
      else high = middle;
    }
    a = (low + high) / 2;
  }
  return { allpass: a, delay: delayFor(a) };
}

/**
 * The spectrum of a raised-cosine (Hann) pulse `seconds` wide with unit
 * area, at `frequency`: 1 at 0 Hz, falling to nothing at 2 / seconds.
 * It is the pluck's own low-pass: a wider pulse is a softer, darker pluck.
 */
export function hannPulseGain(frequency: number, seconds: number): number {
  const x = frequency * seconds;
  if (x < 1e-9) return 1;
  if (Math.abs(x - 1) < 1e-6) return 0.5;
  return Math.sin(Math.PI * x) / (Math.PI * x * (1 - x * x));
}
