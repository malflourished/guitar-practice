import { describe, expect, it } from 'vitest';
import { cents, measureFrequency, measureT60, partialAmplitude } from '../dsp/analysis';
import { Biquad } from '../dsp/biquad';
import { rms, toDb } from '../dsp/loudness';
import { Random } from '../dsp/random';
import { stiffPartial } from '../dsp/stringFilters';
import { REFERENCE_BPM, REFERENCE_LINE, RIFF_LINE, bluesBassLine, renderBassLine } from './bassLine';
import {
  BASS_PARAM_SPECS,
  BASS_PRESETS,
  BASS_STRINGS,
  DEFAULT_BASS_PARAMS,
  fingerBass,
  midiToHz,
  sanitizeBassParams,
  type BassParams,
} from './bassParams';
import { BassSynth } from './bassSynth';

const SAMPLE_RATE = 48000;
/** E1 to G3: the open low E to the 12th fret of the G string. */
const LOW = 28;
const HIGH = 55;
/** Plain, repeatable settings: no pitch bloom, no variation, no finger noise. */
const PLAIN: Partial<BassParams> = { bloomCents: 0, variation: 0, noise: 0 };

function renderNote(
  midi: number,
  velocity: number,
  seconds: number,
  params: Partial<BassParams> = {},
  options: { sampleRate?: number; offSeconds?: number } = {},
): Float32Array {
  const sampleRate = options.sampleRate ?? SAMPLE_RATE;
  const synth = new BassSynth(sampleRate, params);
  synth.noteOn(0, midi, velocity, options.offSeconds === undefined ? undefined : options.offSeconds * sampleRate);
  const out = new Float32Array(Math.round(seconds * sampleRate));
  renderInBlocks(synth, out, 128);
  return out;
}

function renderInBlocks(synth: BassSynth, out: Float32Array, block: number, startFrame = 0): void {
  for (let at = 0; at < out.length; at += block) synth.render(out, startFrame + at, at, Math.min(out.length, at + block));
}

/** The first index at which two buffers differ, or -1 when they are identical. */
function firstDifference(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Math.min(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

function levelDb(samples: Float32Array, fromSeconds: number, toSeconds: number, sampleRate = SAMPLE_RATE): number {
  return toDb(rms(samples, Math.round(fromSeconds * sampleRate), Math.round(toSeconds * sampleRate)));
}

/** The inharmonicity of the string a note is played on, at that fret. */
function inharmonicityOf(midi: number): number {
  const { string, fret } = fingerBass(midi);
  return BASS_STRINGS[string].inharmonicity * 2 ** (fret / 6);
}

describe('where notes are fretted', () => {
  it('uses the open low E, then frets 1 to 5 on each string, then goes up the G string', () => {
    expect(fingerBass(28)).toEqual({ string: 0, fret: 0 });
    expect(fingerBass(27)).toEqual({ string: 0, fret: 0 }); // the jam's lowest pickup note: the E string tuned down
    expect(fingerBass(33)).toEqual({ string: 0, fret: 5 });
    expect(fingerBass(34)).toEqual({ string: 1, fret: 1 });
    expect(fingerBass(38)).toEqual({ string: 1, fret: 5 });
    expect(fingerBass(43)).toEqual({ string: 2, fret: 5 });
    expect(fingerBass(44)).toEqual({ string: 3, fret: 1 });
    expect(fingerBass(55)).toEqual({ string: 3, fret: 12 });
  });

  it('puts a root and its 5th one string apart, two frets up: the box every bassist learns', () => {
    for (let root = 29; root <= 36; root++) {
      const low = fingerBass(root);
      const fifth = fingerBass(root + 7);
      if (low.fret > 3) continue; // the 5th would be past fret 5: it moves across instead
      expect(fifth.string).toBe(low.string + 1);
      expect(fifth.fret).toBe(low.fret + 2);
    }
  });
});

describe('tuning', () => {
  it.each([44100, 48000])('is within 2 cents on every note from E1 to G3 at %i Hz', (sampleRate) => {
    let worst = 0;
    for (let midi = LOW; midi <= HIGH; midi++) {
      const note = renderNote(midi, 0.8, 1.4, PLAIN, { sampleRate });
      const target = midiToHz(midi);
      const error = cents(measureFrequency(note, sampleRate, target, 0.15, 1.35), target);
      worst = Math.max(worst, Math.abs(error));
      expect(Math.abs(error), `MIDI ${midi}`).toBeLessThan(2);
    }
    expect(worst).toBeLessThan(0.5); // in practice far inside the 2 cents asked for
  });

  it('holds its tuning at 96 kHz, with every preset, and at the edges of the range', () => {
    for (const midi of [23, 28, 40, 55, 72]) {
      const target = midiToHz(midi);
      const note = renderNote(midi, 0.8, 1.2, PLAIN, { sampleRate: 96000 });
      expect(Math.abs(cents(measureFrequency(note, 96000, target, 0.15, 1.15), target))).toBeLessThan(2);
    }
    for (const preset of Object.values(BASS_PRESETS)) {
      for (const midi of [28, 33, 45]) {
        const target = midiToHz(midi);
        const note = renderNote(midi, 0.8, 1.2, { ...preset, ...PLAIN });
        expect(Math.abs(cents(measureFrequency(note, SAMPLE_RATE, target, 0.15, 1.15), target))).toBeLessThan(2);
      }
    }
  });

  it('starts a hard pluck a few cents sharp and settles, as a real string does', () => {
    const target = midiToHz(33);
    const hard = renderNote(33, 1, 2.2, { variation: 0 });
    const early = cents(measureFrequency(hard, SAMPLE_RATE, target, 0, 0.25, 4), target);
    const late = cents(measureFrequency(hard, SAMPLE_RATE, target, 1.2, 2.2, 4), target);
    expect(early).toBeGreaterThan(2);
    expect(early).toBeLessThan(DEFAULT_BASS_PARAMS.bloomCents + 0.5);
    expect(Math.abs(late)).toBeLessThan(1);
    // A soft pluck barely moves.
    const soft = renderNote(33, 0.4, 0.6, { variation: 0 });
    expect(Math.abs(cents(measureFrequency(soft, SAMPLE_RATE, target, 0, 0.5, 4), target))).toBeLessThan(1.2);
  });
});

describe('stiffness', () => {
  it('puts the partial near 1 kHz where a stiff string has it, well sharp of a whole multiple', () => {
    for (const midi of [28, 33, 40, 55]) {
      const fundamental = midiToHz(midi);
      const partial = Math.round(1000 / fundamental);
      const target = stiffPartial(partial, fundamental, inharmonicityOf(midi));
      const note = renderNote(midi, 0.8, 1, PLAIN);
      const found = measureFrequency(note, SAMPLE_RATE, target, 0.1, 0.9, partial * 4);
      expect(Math.abs(cents(found, target)), `MIDI ${midi}`).toBeLessThan(2);
    }
    // On the low E it is audibly sharp: more than a quarter tone at the 24th partial.
    expect(cents(stiffPartial(24, midiToHz(28), inharmonicityOf(28)), 24 * midiToHz(28))).toBeGreaterThan(50);
  });

  it('gives exact harmonics with Stiffness at zero', () => {
    for (const midi of [28, 40]) {
      const fundamental = midiToHz(midi);
      for (const partial of [5, Math.round(1000 / fundamental)]) {
        const note = renderNote(midi, 0.8, 1, { ...PLAIN, stiffness: 0 });
        const found = measureFrequency(note, SAMPLE_RATE, partial * fundamental, 0.1, 0.9, partial * 4);
        expect(Math.abs(cents(found, partial * fundamental)), `MIDI ${midi} partial ${partial}`).toBeLessThan(2);
      }
    }
  });
});

describe('decay', () => {
  it('lets a held note ring for several seconds, lower notes longest', () => {
    const times = [28, 33, 40, 45, 55].map((midi) => {
      const note = renderNote(midi, 0.8, 2.2, PLAIN);
      return measureT60(note, SAMPLE_RATE, midiToHz(midi), 0.3, 2.2, 0.4);
    });
    for (const seconds of times) {
      expect(seconds).toBeGreaterThan(4);
      expect(seconds).toBeLessThan(15);
    }
    expect(times[0]).toBeGreaterThan(times[4]);
  });

  it('fades the treble first: the partial near 1 kHz lasts about the String age setting', () => {
    for (const ringSeconds of [1.6, 0.4]) {
      for (const midi of [28, 40, 55]) {
        const fundamental = midiToHz(midi);
        const partial = Math.round(1000 / fundamental);
        const frequency = stiffPartial(partial, fundamental, inharmonicityOf(midi));
        const span = Math.min(1.2, ringSeconds * 0.8);
        const note = renderNote(midi, 0.8, 1.5, { ...PLAIN, ringSeconds });
        const measured = measureT60(note, SAMPLE_RATE, frequency, 0.05, 0.05 + span, span / 4);
        expect(measured, `MIDI ${midi}, ${ringSeconds} s`).toBeGreaterThan(ringSeconds * 0.7);
        expect(measured, `MIDI ${midi}, ${ringSeconds} s`).toBeLessThan(ringSeconds * 1.3);
      }
    }
  });

  it('stops a damped note the way a finger does: 40 dB down within a tenth of a second, then true silence', () => {
    for (const midi of [28, 33, 45]) {
      const synth = new BassSynth(SAMPLE_RATE);
      synth.noteOn(0, midi, 0.9, 0.5 * SAMPLE_RATE);
      const out = new Float32Array(1.5 * SAMPLE_RATE);
      renderInBlocks(synth, out, 128);
      const before = levelDb(out, 0.4, 0.5);
      expect(before).toBeGreaterThan(-40);
      expect(levelDb(out, 0.6, 0.65) - before, `MIDI ${midi}`).toBeLessThan(-40);
      expect(rms(out, 1.3 * SAMPLE_RATE)).toBe(0);
      expect(synth.silent).toBe(true);
    }
  });

  it('silences everything on stop, and forgets notes that were still to come', () => {
    const synth = new BassSynth(SAMPLE_RATE);
    synth.noteOn(0, 33, 0.9);
    synth.noteOn(0.6 * SAMPLE_RATE, 40, 0.9);
    const out = new Float32Array(1.2 * SAMPLE_RATE);
    renderInBlocks(synth, out.subarray(0, 0.3 * SAMPLE_RATE), 128);
    synth.stop();
    renderInBlocks(synth, out.subarray(0.3 * SAMPLE_RATE), 128, 0.3 * SAMPLE_RATE);
    expect(levelDb(out, 0.2, 0.3)).toBeGreaterThan(-30);
    expect(levelDb(out, 0.4, 0.45)).toBeLessThan(-80);
    expect(rms(out, 0.8 * SAMPLE_RATE)).toBe(0); // the second note never sounded
    expect(synth.silent).toBe(true);
  });
});

describe('robustness', () => {
  const allMin = Object.fromEntries(BASS_PARAM_SPECS.map((spec) => [spec.key, spec.min])) as unknown as BassParams;
  const allMax = Object.fromEntries(BASS_PARAM_SPECS.map((spec) => [spec.key, spec.max])) as unknown as BassParams;

  /** Finite, and either exactly zero or comfortably above the denormal range. */
  const sound = (value: number, floor: number) => Number.isFinite(value) && (value === 0 || Math.abs(value) > floor);

  it.each([44100, 48000, 96000])('makes no invalid or denormal numbers under stress at %i Hz', (sampleRate) => {
    const random = new Random(sampleRate);
    for (const params of [DEFAULT_BASS_PARAMS, allMin, allMax, ...Object.values(BASS_PRESETS)]) {
      const synth = new BassSynth(sampleRate, params, 3);
      const seconds = 4;
      let at = 0;
      while (at < seconds * sampleRate) {
        const velocity = [0, 1e-9, 1e-3, 1][Math.floor(random.next() * 12)] ?? random.next();
        const length = random.next() < 0.3 ? 0.004 + random.next() * 0.03 : random.next() * 1.2;
        synth.noteOn(at, 18 + Math.floor(random.next() * 60), velocity, length * sampleRate);
        at += Math.floor(random.next() * random.next() * 0.5 * sampleRate);
      }
      // Four seconds of notes, then three of silence, checked second by second.
      const out = new Float32Array(sampleRate);
      for (let second = 0; second < seconds + 3; second++) {
        renderInBlocks(synth, out, 128, second * sampleRate);
        expect(out.every((value) => sound(value, 1e-30))).toBe(true);
        let stateOk = true;
        synth.forEachState((value) => {
          if (!sound(value, 1e-200)) stateOk = false;
        });
        expect(stateOk).toBe(true);
        expect(synth.activeVoices).toBeLessThanOrEqual(4);
      }
      // At rest: exact zeros everywhere, so nothing is left to decay.
      expect(synth.silent).toBe(true);
      expect(out.subarray(sampleRate / 2).every((value) => value === 0)).toBe(true);
      let allZero = true;
      synth.forEachState((value) => {
        if (value !== 0) allZero = false;
      });
      expect(allZero).toBe(true);
    }
  });

  it('ignores notes that are not numbers and keeps the rest in range', () => {
    const synth = new BassSynth(SAMPLE_RATE);
    expect(synth.noteOn(0, Number.NaN, 0.8)).toBe(0);
    expect(synth.noteOn(Number.POSITIVE_INFINITY, 40, 0.8)).toBe(0);
    expect(synth.noteOn(0, 40, Number.NaN)).toBe(0);
    expect(synth.noteOn(0, 40, 0)).toBe(0); // too soft to hear: not played
    const out = new Float32Array(4800);
    synth.render(out, 0);
    expect(out.every((value) => value === 0)).toBe(true);
    // A note far below the range plays as the lowest the model has (B0), not as garbage.
    expect(synth.noteOn(4800, -40, 5)).toBeGreaterThan(0);
    const low = new Float32Array(SAMPLE_RATE);
    synth.render(low, 4800);
    expect(Math.abs(cents(measureFrequency(low, SAMPLE_RATE, midiToHz(23), 0.2, 0.95), midiToHz(23)))).toBeLessThan(12);
  });

  it('fills in and clamps parameters from anything', () => {
    expect(sanitizeBassParams(undefined)).toEqual(DEFAULT_BASS_PARAMS);
    expect(sanitizeBassParams('nonsense')).toEqual(DEFAULT_BASS_PARAMS);
    const cleaned = sanitizeBassParams({ toneHz: 1e9, drive: -3, pluckCm: Number.NaN, hardness: '1', ringSeconds: 0.5 });
    expect(cleaned.toneHz).toBe(6000);
    expect(cleaned.drive).toBe(0);
    expect(cleaned.pluckCm).toBe(DEFAULT_BASS_PARAMS.pluckCm);
    expect(cleaned.hardness).toBe(DEFAULT_BASS_PARAMS.hardness);
    expect(cleaned.ringSeconds).toBe(0.5);
    for (const spec of BASS_PARAM_SPECS) {
      expect(DEFAULT_BASS_PARAMS[spec.key]).toBeGreaterThanOrEqual(spec.min);
      expect(DEFAULT_BASS_PARAMS[spec.key]).toBeLessThanOrEqual(spec.max);
    }
    for (const preset of Object.values(BASS_PRESETS)) {
      expect(sanitizeBassParams(preset)).toEqual({ ...DEFAULT_BASS_PARAMS, ...preset });
    }
  });
});

describe('playing', () => {
  it('starts a note on the exact sample it was asked for', () => {
    const synth = new BassSynth(SAMPLE_RATE);
    synth.noteOn(1000, 40, 0.9);
    const out = new Float32Array(4800);
    renderInBlocks(synth, out, 128);
    expect(out.subarray(0, 1000).every((value) => value === 0)).toBe(true);
    const first = out.findIndex((value) => value !== 0);
    expect(first).toBeGreaterThanOrEqual(1000);
    expect(first).toBeLessThan(1004);
  });

  it('sounds the same however the caller slices its blocks', () => {
    const whole = renderBassLine(RIFF_LINE, { bpm: 96, sampleRate: SAMPLE_RATE, tailSeconds: 1 });
    for (const block of [1, 64, 100, 480, whole.length]) {
      const synth = new BassSynth(SAMPLE_RATE);
      const framesPerBeat = (60 / 96) * SAMPLE_RATE;
      for (const note of RIFF_LINE.notes) synth.noteOn(note.beat * framesPerBeat, note.midi, note.velocity, note.beats * framesPerBeat);
      const out = new Float32Array(whole.length);
      if (block === 1) {
        // one sample at a time for the first second is enough to prove the point cheaply
        renderInBlocks(synth, out.subarray(0, SAMPLE_RATE), 1);
        renderInBlocks(synth, out.subarray(SAMPLE_RATE), 128, SAMPLE_RATE);
      } else renderInBlocks(synth, out, block);
      expect(firstDifference(out, whole), `blocks of ${block}`).toBe(-1);
    }
  });

  it('repeats exactly for the same seed, and never plays the same pluck twice', () => {
    const options = { bpm: 96, sampleRate: SAMPLE_RATE };
    const seeded = renderBassLine(RIFF_LINE, { ...options, seed: 5 });
    expect(firstDifference(seeded, renderBassLine(RIFF_LINE, { ...options, seed: 5 }))).toBe(-1);
    expect(firstDifference(seeded, renderBassLine(RIFF_LINE, { ...options, seed: 6 }))).toBeGreaterThanOrEqual(0);

    const twice = (params: Partial<BassParams>) => {
      const synth = new BassSynth(SAMPLE_RATE, params);
      const takes: Float32Array[] = [];
      for (let take = 0; take < 2; take++) {
        const start = take * 2 * SAMPLE_RATE;
        synth.noteOn(start, 40, 0.8);
        const out = new Float32Array(SAMPLE_RATE / 2);
        renderInBlocks(synth, out, 128, start);
        synth.stop();
        renderInBlocks(synth, new Float32Array(1.5 * SAMPLE_RATE), 128, start + SAMPLE_RATE / 2);
        takes.push(out);
      }
      let difference = 0;
      for (let i = 0; i < takes[0].length; i++) difference = Math.max(difference, Math.abs(takes[0][i] - takes[1][i]));
      return difference;
    };
    expect(twice({ variation: 0, noise: 0 })).toBe(0);
    expect(twice({})).toBeGreaterThan(1e-3);
  });

  it('is evenly loud across the range', () => {
    const levels: number[] = [];
    for (let midi = LOW; midi <= HIGH; midi++) levels.push(levelDb(renderNote(midi, 0.8, 0.6, PLAIN), 0, 0.6));
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    for (const level of levels) expect(Math.abs(level - mean)).toBeLessThan(1.5);
  });

  it('gets brighter, not only louder, when plucked harder', () => {
    const treble = (samples: Float32Array) => {
      const copy = Float64Array.from(samples);
      new Biquad().setHighpass(700, Math.SQRT1_2, SAMPLE_RATE).processBlock(copy);
      new Biquad().setHighpass(700, Math.SQRT1_2, SAMPLE_RATE).processBlock(copy);
      return toDb(rms(copy));
    };
    const soft = renderNote(33, 0.4, 0.4, { variation: 0 });
    const hard = renderNote(33, 1, 0.4, { variation: 0 });
    const louder = toDb(rms(hard)) - toDb(rms(soft));
    expect(louder).toBeGreaterThan(6);
    expect(louder).toBeLessThan(9); // level follows velocity directly: 20·log10(1 / 0.4) is 8 dB
    expect(treble(hard) - treble(soft)).toBeGreaterThan(louder + 3);
  });

  it('removes every fifth partial when plucked a fifth of the way along, and every third at a third', () => {
    const fundamental = midiToHz(28);
    const params = { ...PLAIN, stiffness: 0 };
    const partial = (samples: Float32Array, n: number) => toDb(partialAmplitude(samples, SAMPLE_RATE, n * fundamental, 0.1, 0.3));
    const fifth = renderNote(28, 0.8, 0.5, { ...params, pluckCm: 86.4 / 5 });
    expect(partial(fifth, 5)).toBeLessThan(partial(fifth, 4) - 20);
    expect(partial(fifth, 10)).toBeLessThan(partial(fifth, 9) - 20);
    const third = renderNote(28, 0.8, 0.5, { ...params, pluckCm: 86.4 / 3 });
    expect(partial(third, 3)).toBeLessThan(partial(third, 2) - 20);
    expect(partial(third, 5)).toBeGreaterThan(partial(third, 3) + 15);
  });

  it('keeps the pickup fixed to the body, so each fretted note gets its own filter', () => {
    // A pickup a quarter of the way along the open E string removes that string's 4th partial.
    const params = { ...PLAIN, stiffness: 0, pickupCm: 86.4 / 4, pluckCm: 12 };
    const level = (samples: Float32Array, midi: number, n: number) =>
      toDb(partialAmplitude(samples, SAMPLE_RATE, n * midiToHz(midi), 0.1, 0.3));
    const open = renderNote(28, 0.8, 0.5, params);
    expect(level(open, 28, 4)).toBeLessThan(level(open, 28, 3) - 20);
    // Fretted at the 5th fret the string is shorter, the same pickup is a third of the way along, and it is the 3rd partial that goes.
    const fretted = renderNote(33, 0.8, 0.5, params);
    expect(level(fretted, 33, 3)).toBeLessThan(level(fretted, 33, 2) - 20);
    expect(level(fretted, 33, 4)).toBeGreaterThan(level(fretted, 33, 3) + 15);
  });

  it('never keeps more than four strings sounding, and puts them all to sleep after the line', () => {
    const synth = new BassSynth(SAMPLE_RATE);
    const framesPerBeat = (60 / 180) * SAMPLE_RATE;
    for (const note of RIFF_LINE.notes) synth.noteOn(note.beat * framesPerBeat, note.midi, note.velocity, note.beats * framesPerBeat);
    const block = new Float32Array(128);
    let most = 0;
    for (let frame = 0; frame < 5 * SAMPLE_RATE; frame += 128) {
      synth.render(block, frame);
      most = Math.max(most, synth.activeVoices);
    }
    expect(most).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(4);
    expect(synth.silent).toBe(true);
  });
});

describe('bass lines', () => {
  it('plays the jam loop\'s own bass part for the reference line and the blues', () => {
    expect(REFERENCE_LINE.beats).toBe(16);
    expect(REFERENCE_LINE.notes).toHaveLength(12); // root, 5th and a swung pickup in each of four bars
    expect(REFERENCE_LINE.notes[0]).toMatchObject({ beat: 0, midi: 33 });
    const blues = bluesBassLine(9);
    expect(blues.beats).toBe(48);
    expect(blues.notes).toHaveLength(36);
    for (const note of [...REFERENCE_LINE.notes, ...blues.notes]) {
      expect(note.midi).toBeGreaterThanOrEqual(27);
      expect(note.midi).toBeLessThanOrEqual(39);
    }
    expect(bluesBassLine(9, 'straight').notes).toHaveLength(24);
    expect(REFERENCE_BPM).toBe(100);
  });
});

describe('cost', () => {
  it('renders ten seconds of a bass line many times faster than real time', () => {
    renderBassLine(RIFF_LINE, { bpm: 96, sampleRate: SAMPLE_RATE }); // warm up the compiler
    const start = performance.now();
    const out = renderBassLine(RIFF_LINE, { bpm: 96, sampleRate: SAMPLE_RATE, loops: 2 });
    const elapsed = performance.now() - start;
    expect(out.length).toBe(10 * SAMPLE_RATE);
    // Ten seconds of sound in well under one second of one core; in practice about 50 ms.
    expect(elapsed).toBeLessThan(1000);
  });
});
