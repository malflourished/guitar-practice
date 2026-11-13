import { describe, expect, it } from 'vitest';
import { cents, measureFrequency, measureT60, partialAmplitude } from './analysis';
import { Biquad, Shelf } from './biquad';
import { DelayLine, lagrangeAfter, lagrangeAt, lagrangeBefore, lagrangeNext } from './delayLine';
import { fromDb, kWeightedLoudness, kWeightingFilters, peak, rms, toDb } from './loudness';
import { Random } from './random';
import {
  allpassPhaseLag,
  designLoop,
  designLossFilter,
  gainPerRoundTrip,
  hannPulseGain,
  lossGain,
  lossPhaseLag,
  stiffPartial,
  t60FromGain,
} from './stringFilters';

const SAMPLE_RATE = 48000;

function sine(frequency: number, seconds: number, amplitude = 1, decayT60 = Infinity): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = amplitude * Math.sin(2 * Math.PI * frequency * t) * 10 ** ((-3 * t) / decayT60);
  }
  return out;
}

describe('delay line', () => {
  it('returns what was written a whole number of samples ago', () => {
    const line = new DelayLine(100);
    for (let i = 1; i <= 50; i++) line.write(i);
    expect(line.read(1)).toBe(50);
    expect(line.read(7)).toBe(44);
    expect(line.readLinear(7)).toBe(44);
    expect(line.readLagrange(7)).toBeCloseTo(44, 12);
  });

  it('interpolates a cubic exactly, and a fractional delay of a ramp', () => {
    const line = new DelayLine(64);
    const cubic = (t: number) => 0.001 * t ** 3 - 0.02 * t * t + 0.3 * t - 1;
    for (let t = 0; t < 40; t++) line.write(cubic(t));
    // read(1) is t = 39, so a delay of d is t = 40 - d.
    for (const delay of [2, 2.25, 5.5, 9.99, 17.3]) {
      expect(line.readLagrange(delay)).toBeCloseTo(cubic(40 - delay), 9);
    }
    expect(line.readLinear(3.5)).toBeCloseTo((cubic(37) + cubic(36)) / 2, 12);
  });

  it('has Lagrange weights that sum to one and never amplify', () => {
    for (let d = 0; d <= 1; d += 0.05) {
      const weights = [lagrangeBefore(d), lagrangeAt(d), lagrangeNext(d), lagrangeAfter(d)];
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      // Gain at every frequency stays at or under 1, so a loop built on it cannot grow.
      for (let w = 0; w <= Math.PI; w += Math.PI / 64) {
        let re = 0;
        let im = 0;
        weights.forEach((weight, k) => {
          re += weight * Math.cos(w * k);
          im -= weight * Math.sin(w * k);
        });
        expect(Math.hypot(re, im)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('filters', () => {
  it('a low-pass and a high-pass are 3 dB down at their corner and pass their own side', () => {
    const low = new Biquad().setLowpass(1000, Math.SQRT1_2, SAMPLE_RATE);
    expect(toDb(low.gainAt(1000, SAMPLE_RATE))).toBeCloseTo(-3.01, 1);
    expect(toDb(low.gainAt(50, SAMPLE_RATE))).toBeCloseTo(0, 2);
    expect(toDb(low.gainAt(8000, SAMPLE_RATE))).toBeLessThan(-30);
    const high = new Biquad().setHighpass(35, Math.SQRT1_2, SAMPLE_RATE);
    expect(toDb(high.gainAt(35, SAMPLE_RATE))).toBeCloseTo(-3.01, 1);
    expect(toDb(high.gainAt(1000, SAMPLE_RATE))).toBeCloseTo(0, 2);
  });

  it('the measured gain of a running filter matches its formula', () => {
    const filter = new Biquad().setLowpass(2200, 1.2, SAMPLE_RATE);
    const input = sine(2200, 0.5);
    const output = Float64Array.from(input);
    filter.processBlock(output);
    const settled = Math.round(0.25 * SAMPLE_RATE);
    expect(rms(output, settled) / rms(input, settled)).toBeCloseTo(filter.gainAt(2200, SAMPLE_RATE), 3);
    expect(filter.gainAt(2200, SAMPLE_RATE)).toBeCloseTo(1.2, 2); // the resonance: gain Q at the corner
  });

  it('a shelf and its swapped twin cancel exactly', () => {
    const up = new Shelf().set(250, 1000, SAMPLE_RATE);
    const down = new Shelf().set(1000, 250, SAMPLE_RATE);
    const random = new Random(7);
    for (let i = 0; i < 2000; i++) {
      const x = random.bipolar();
      expect(down.process(up.process(x))).toBeCloseTo(x, 10);
    }
  });
});

describe('string loop design', () => {
  it('converts between decay time and gain per round trip', () => {
    const gain = gainPerRoundTrip(2, 55);
    expect(gain).toBeLessThan(1);
    expect(t60FromGain(gain, 55)).toBeCloseTo(2, 9);
    // 110 round trips (2 s at 55 Hz) is a fall of 60 dB.
    expect(toDb(gain ** 110)).toBeCloseTo(-60, 6);
  });

  it('designs a loss filter that meets both decay times', () => {
    for (const noteFrequency of [41.2, 82.4, 196]) {
      for (const referenceT60 of [0.2, 1.6, 3]) {
        const filter = designLossFilter({ noteFrequency, fundamentalT60: 9, referenceFrequency: 1000, referenceT60, sampleRate: SAMPLE_RATE });
        const w1 = (2 * Math.PI * noteFrequency) / SAMPLE_RATE;
        const wr = (2 * Math.PI * 1000) / SAMPLE_RATE;
        expect(filter.g).toBeLessThan(1);
        expect(filter.p).toBeGreaterThanOrEqual(0);
        expect(filter.p).toBeLessThan(1);
        expect(t60FromGain(lossGain(filter, wr), noteFrequency)).toBeCloseTo(referenceT60, 2);
        // The fundamental keeps its time. The exception is a very dark filter: one pole that kills
        // 1 kHz in a fifth of a second also takes some of the fundamental, as dead strings do.
        const fundamental = t60FromGain(lossGain(filter, w1), noteFrequency);
        if (referenceT60 >= 1.6) expect(fundamental).toBeCloseTo(9, 2);
        else {
          expect(fundamental).toBeLessThanOrEqual(9.001);
          expect(fundamental).toBeGreaterThan(4);
        }
      }
    }
  });

  it('never asks the loop to amplify, even for a long sustain with dead strings', () => {
    const filter = designLossFilter({ noteFrequency: 30.9, fundamentalT60: 30, referenceFrequency: 1000, referenceT60: 0.15, sampleRate: 96000 });
    for (let w = 0; w <= Math.PI; w += Math.PI / 256) expect(lossGain(filter, w)).toBeLessThan(1);
  });

  it('has phase formulas that match the filters they describe', () => {
    const w = 0.3;
    const p = 0.7;
    // One-pole low-pass: 1 / (1 - p·e^{-jw})
    const lag = Math.atan2(p * Math.sin(w), 1 - p * Math.cos(w));
    expect(lossPhaseLag(p, w)).toBeCloseTo(lag, 12);
    // All-pass (a + z⁻¹) / (1 + a·z⁻¹), evaluated directly.
    for (const a of [-0.9, -0.3, 0, 0.5]) {
      const numerator = [a + Math.cos(w), -Math.sin(w)];
      const denominator = [1 + a * Math.cos(w), -a * Math.sin(w)];
      const direct = -(Math.atan2(numerator[1], numerator[0]) - Math.atan2(denominator[1], denominator[0]));
      expect(allpassPhaseLag(a, w)).toBeCloseTo(direct, 10);
    }
    expect(allpassPhaseLag(0, w)).toBeCloseTo(w, 12); // a plain one-sample delay
  });

  it('solves the loop so the fundamental and the reference partial both land on target', () => {
    const noteFrequency = 41.2;
    const inharmonicity = 1.4e-4;
    const referencePartial = 24;
    const referenceFrequency = stiffPartial(referencePartial, noteFrequency, inharmonicity);
    const lossPole = 0.74;
    const sections = 6;
    const loop = designLoop({ noteFrequency, referencePartial, referenceFrequency, sections, lossPole, sampleRate: SAMPLE_RATE });
    const turns = (frequency: number) => {
      const w = (2 * Math.PI * frequency) / SAMPLE_RATE;
      return (w * loop.delay + lossPhaseLag(lossPole, w) + sections * allpassPhaseLag(loop.allpass, w)) / (2 * Math.PI);
    };
    expect(turns(noteFrequency)).toBeCloseTo(1, 9);
    expect(turns(referenceFrequency)).toBeCloseTo(referencePartial, 6);
    expect(loop.allpass).toBeLessThan(0);
    // A stiff string's 24th partial is well sharp of 24 times the fundamental.
    expect(cents(referenceFrequency, referencePartial * noteFrequency)).toBeGreaterThan(50);
  });

  it('gives a soft pluck less treble than a hard one', () => {
    expect(hannPulseGain(0, 0.001)).toBe(1);
    expect(hannPulseGain(1000, 0.001)).toBeCloseTo(0.5, 5);
    expect(hannPulseGain(2000, 0.001)).toBeCloseTo(0, 9);
    expect(hannPulseGain(1000, 0.0024)).toBeLessThan(hannPulseGain(1000, 0.0005));
  });
});

describe('loudness meters', () => {
  it('measures peak and RMS of a sine', () => {
    const tone = sine(440, 1, 0.5);
    expect(peak(tone)).toBeCloseTo(0.5, 3);
    expect(toDb(rms(tone))).toBeCloseTo(toDb(0.5) - 3.01, 2);
    expect(fromDb(-6.0206)).toBeCloseTo(0.5, 4);
    expect(toDb(0)).toBe(-Infinity);
  });

  it('builds K-weighting that matches the coefficients printed in ITU-R BS.1770', () => {
    const [shelf, highpass] = kWeightingFilters(48000);
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 6);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 6);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 6);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 6);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 6);
    expect(highpass.a1).toBeCloseTo(-1.99004745483398, 6);
    expect(highpass.a2).toBeCloseTo(0.99007225036621, 6);
  });

  it('reads a full-scale 997 Hz sine as -3.01 LKFS, and weighs deep bass down', () => {
    expect(kWeightedLoudness(sine(997, 2), SAMPLE_RATE)).toBeCloseTo(-3.01, 1);
    const low = kWeightedLoudness(sine(41.2, 2), SAMPLE_RATE);
    const mid = kWeightedLoudness(sine(400, 2), SAMPLE_RATE);
    expect(mid - low).toBeGreaterThan(4); // same RMS, but the 41 Hz tone counts as much quieter
    // The same answer at another sample rate.
    const at441 = new Float32Array(88200);
    for (let i = 0; i < at441.length; i++) at441[i] = Math.sin((2 * Math.PI * 997 * i) / 44100);
    expect(kWeightedLoudness(at441, 44100)).toBeCloseTo(-3.01, 1);
  });
});

describe('measuring a sound', () => {
  it('finds a frequency to a hundredth of a cent from a rough guess, with a neighbour present', () => {
    const tone = sine(41.37, 2, 1, 6);
    const neighbour = sine(82.9, 2, 0.8, 4);
    for (let i = 0; i < tone.length; i++) tone[i] += neighbour[i];
    const found = measureFrequency(tone, SAMPLE_RATE, 41.2, 0.2, 1.8);
    expect(Math.abs(cents(found, 41.37))).toBeLessThan(0.01);
  });

  it('measures amplitude and decay time', () => {
    const tone = sine(1000, 2, 0.5, 1.5);
    expect(partialAmplitude(sine(1000, 1, 0.5), SAMPLE_RATE, 1000, 0.2, 0.2)).toBeCloseTo(0.5, 3);
    expect(measureT60(tone, SAMPLE_RATE, 1000, 0.1, 1.5, 0.1)).toBeCloseTo(1.5, 2);
  });
});

describe('random source', () => {
  it('repeats for the same seed and stays in range', () => {
    const a = new Random(42);
    const b = new Random(42);
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const value = a.next();
      expect(value).toBe(b.next());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      sum += value;
    }
    expect(sum / 5000).toBeCloseTo(0.5, 1);
    expect(new Random(1).next()).not.toBe(new Random(2).next());
  });
});
