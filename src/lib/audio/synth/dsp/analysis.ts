/**
 * Measuring a rendered sound: the exact frequency of a partial, its level,
 * and how fast it fades. The tests use these to hold a modelled instrument to
 * its targets (tuning in cents, decay in seconds); nothing here runs while
 * sound is playing.
 */
import { Biquad } from './biquad';

/**
 * The frequency of the partial nearest `guess`, in hertz.
 *
 * The signal is shifted down by `guess` so the partial sits near 0 Hz, the
 * other partials are averaged away with a raised-cosine window a whole number
 * of periods long, and the slow turning of what is left gives the difference
 * between the true frequency and the guess. Good to a small fraction of a
 * cent when the guess is within a few percent.
 */
export function measureFrequency(
  samples: ArrayLike<number>,
  sampleRate: number,
  guess: number,
  fromSeconds: number,
  toSeconds: number,
  windowPeriods = 6,
): number {
  const w = (2 * Math.PI * guess) / sampleRate;
  const length = Math.round((windowPeriods * sampleRate) / guess);
  const hop = Math.max(1, Math.round(length / 16));
  const start = Math.round(fromSeconds * sampleRate);
  const end = Math.min(samples.length, Math.round(toSeconds * sampleRate)) - length;
  const window = new Float64Array(length);
  for (let k = 0; k < length; k++) window[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (k + 0.5)) / length);

  // Weighted straight-line fit of phase against time.
  let previous = 0;
  let unwrapped = 0;
  let sw = 0;
  let st = 0;
  let sp = 0;
  let stt = 0;
  let stp = 0;
  let first = true;
  for (let at = start; at <= end; at += hop) {
    let re = 0;
    let im = 0;
    for (let k = 0; k < length; k++) {
      const x = samples[at + k] * window[k];
      const angle = w * (at + k);
      re += x * Math.cos(angle);
      im -= x * Math.sin(angle);
    }
    const phase = Math.atan2(im, re);
    if (first) {
      unwrapped = phase;
      first = false;
    } else {
      let step = phase - previous;
      step -= 2 * Math.PI * Math.round(step / (2 * Math.PI));
      unwrapped += step;
    }
    previous = phase;
    const weight = re * re + im * im;
    const time = at / sampleRate;
    sw += weight;
    st += weight * time;
    sp += weight * unwrapped;
    stt += weight * time * time;
    stp += weight * time * unwrapped;
  }
  const slope = (sw * stp - st * sp) / (sw * stt - st * st);
  return guess + slope / (2 * Math.PI);
}

/** The amplitude of the partial at `frequency` in the window starting at `atSeconds`. */
export function partialAmplitude(
  samples: ArrayLike<number>,
  sampleRate: number,
  frequency: number,
  atSeconds: number,
  windowSeconds: number,
): number {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const start = Math.round(atSeconds * sampleRate);
  const length = Math.min(samples.length - start, Math.round(windowSeconds * sampleRate));
  let re = 0;
  let im = 0;
  let sum = 0;
  for (let k = 0; k < length; k++) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * (k + 0.5)) / length);
    const x = samples[start + k] * window;
    re += x * Math.cos(w * k);
    im -= x * Math.sin(w * k);
    sum += window;
  }
  return (2 * Math.hypot(re, im)) / sum;
}

/**
 * The T60 of the partial at `frequency`, in seconds, from a straight-line fit
 * of its level in decibels across windows between `fromSeconds` and `toSeconds`.
 */
export function measureT60(
  samples: ArrayLike<number>,
  sampleRate: number,
  frequency: number,
  fromSeconds: number,
  toSeconds: number,
  windowSeconds: number,
): number {
  const steps = 8;
  let st = 0;
  let sl = 0;
  let stt = 0;
  let stl = 0;
  for (let i = 0; i < steps; i++) {
    const time = fromSeconds + ((toSeconds - windowSeconds - fromSeconds) * i) / (steps - 1);
    const level = 20 * Math.log10(partialAmplitude(samples, sampleRate, frequency, time, windowSeconds));
    st += time;
    sl += level;
    stt += time * time;
    stl += time * level;
  }
  const slope = (steps * stl - st * sl) / (steps * stt - st * st); // dB per second, negative
  return -60 / slope;
}

/** The spectral centroid in hertz: the "centre of gravity" of the spectrum, a plain measure of brightness. */
export function spectralCentroid(
  samples: ArrayLike<number>,
  sampleRate: number,
  fromSeconds: number,
  toSeconds: number,
  maxFrequency = 8000,
): number {
  const start = Math.round(fromSeconds * sampleRate);
  const length = Math.round((toSeconds - fromSeconds) * sampleRate);
  const step = sampleRate / length;
  let weighted = 0;
  let total = 0;
  for (let frequency = step; frequency <= maxFrequency; frequency += step * 4) {
    const w = (2 * Math.PI * frequency) / sampleRate;
    let re = 0;
    let im = 0;
    for (let k = 0; k < length; k++) {
      const x = samples[start + k] * (0.5 - 0.5 * Math.cos((2 * Math.PI * (k + 0.5)) / length));
      re += x * Math.cos(w * k);
      im -= x * Math.sin(w * k);
    }
    const power = re * re + im * im;
    weighted += frequency * power;
    total += power;
  }
  return total > 0 ? weighted / total : 0;
}

/**
 * The level of the part of a sound between two frequencies, in decibels
 * (RMS, full scale is 0), over a stretch of time. The band's edges fall at
 * 24 dB an octave. For checks such as "the wires add noise above 3 kHz".
 */
export function bandLevelDb(
  samples: ArrayLike<number>,
  sampleRate: number,
  lowHz: number,
  highHz: number,
  fromSeconds = 0,
  toSeconds = samples.length / sampleRate,
): number {
  const filters = [new Biquad(), new Biquad(), new Biquad(), new Biquad()];
  filters[0].setHighpass(lowHz, 0.54, sampleRate);
  filters[1].setHighpass(lowHz, 1.31, sampleRate);
  filters[2].setLowpass(highHz, 0.54, sampleRate);
  filters[3].setLowpass(highHz, 1.31, sampleRate);
  const from = Math.max(0, Math.round(fromSeconds * sampleRate));
  const to = Math.min(samples.length, Math.round(toSeconds * sampleRate));
  let sum = 0;
  // run the filters from the start, so the stretch is not coloured by their settling
  for (let i = 0; i < to; i++) {
    let value = samples[i];
    for (const filter of filters) value = filter.process(value);
    if (i >= from) sum += value * value;
  }
  return to > from && sum > 0 ? 10 * Math.log10(sum / (to - from)) : -Infinity;
}

/**
 * How long a sound takes to fall `db` decibels below its loudest moment, in
 * seconds, and when that moment was: both from its level in short windows.
 */
export function fallTime(
  samples: ArrayLike<number>,
  sampleRate: number,
  db: number,
  windowSeconds = 0.005,
): { peakSeconds: number; seconds: number } {
  const size = Math.max(1, Math.round(windowSeconds * sampleRate));
  let loudest = 0;
  let at = 0;
  const levels: number[] = [];
  for (let start = 0; start + size <= samples.length; start += size) {
    let sum = 0;
    for (let k = 0; k < size; k++) sum += samples[start + k] * samples[start + k];
    const level = Math.sqrt(sum / size);
    if (level > loudest) {
      loudest = level;
      at = levels.length;
    }
    levels.push(level);
  }
  const target = loudest * 10 ** (-db / 20);
  let last = at;
  for (let i = at; i < levels.length; i++) if (levels[i] > target) last = i;
  return { peakSeconds: at * windowSeconds, seconds: (last - at + 1) * windowSeconds };
}

/** Cents between two frequencies: positive when `frequency` is sharp of `reference`. */
export function cents(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}
