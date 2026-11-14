import { describe, expect, it } from 'vitest';
import { bandLevelDb, measureFrequency } from '../dsp/analysis';
import { DrumRoom } from '../dsp/drumRoom';
import { fft, powerSpectrum } from '../dsp/fft';
import { rms, toDb } from '../dsp/loudness';
import { Random } from '../dsp/random';
import { SmallRoom } from '../dsp/room';
import { DRUM_GROOVES } from '../../drumGrooves';
import { GlueBus } from './drumBus';
import { DEFAULT_DRUM_PARAMS, DRUM_PARAM_SPECS, DRUM_PIECES, type DrumKitId, type DrumParams, type DrumPiece } from './drumParams';
import { REFERENCE_BPM, groovePart, referencePart, renderDrumPart, stereoLevels } from './drumPattern';
import { DrumSynth, KIT_OUTPUT_GAIN } from './drumSynth';
import { createKit } from './kits';
import { buildMetalTables, metalTables, primeMetalTables, type MetalRecipe } from './metalTable';
import { STUDIO_KITS, isStudioKitId, kitMetalRecipes, prepareKitMetal, type StudioKitId } from './studioKits';

const SAMPLE_RATE = 48000;
const NEW_KITS: readonly StudioKitId[] = ['rock', 'neon', 'garage'];
/** Plain, repeatable settings: no room, and no difference from one stroke to the next. */
const PLAIN: Partial<DrumParams> = { room: 0, variation: 0 };

type Stroke = [seconds: number, piece: DrumPiece, velocity: number];

function play(kit: DrumKitId, strokes: Stroke[], seconds: number, params: Partial<DrumParams> = {}, seed = 1) {
  const synth = new DrumSynth(SAMPLE_RATE, kit, params, seed);
  for (const [at, piece, velocity] of strokes) synth.hit(at * SAMPLE_RATE, piece, velocity, 0.3 * SAMPLE_RATE);
  const length = Math.round(seconds * SAMPLE_RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let at = 0; at < length; at += 128) synth.render(left, right, at, at, Math.min(length, at + 128));
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) mono[i] = 0.5 * (left[i] + right[i]);
  return { left, right, mono, synth };
}

const levelDb = (samples: Float32Array, from: number, to: number) => toDb(rms(samples, Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE)));
/** Where the weight of a sound's spectrum lies, in hertz, between two times in seconds. */
function centroid(samples: Float32Array, from: number, to: number): number {
  const power = powerSpectrum(samples, Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE));
  const hzPerBin = SAMPLE_RATE / (power.length * 2);
  let weighted = 0;
  let total = 0;
  for (let k = 1; k < power.length; k++) {
    weighted += k * hzPerBin * power[k];
    total += power[k];
  }
  return weighted / total;
}

/** The share of a band's frequency bins that holds half its power: 19% for noise, a percent or less for a few clean tones. */
function density(samples: ArrayLike<number>, from: number, to: number, lowHz: number, highHz: number): number {
  const power = powerSpectrum(samples, Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE));
  const hzPerBin = SAMPLE_RATE / (power.length * 2);
  const bins: number[] = [];
  for (let k = Math.ceil(lowHz / hzPerBin); k < highHz / hzPerBin; k++) bins.push(power[k]);
  const total = bins.reduce((a, b) => a + b, 0);
  bins.sort((a, b) => b - a);
  let running = 0;
  let count = 0;
  while (running < total / 2) running += bins[count++];
  return count / bins.length;
}

function correlation(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return ab / Math.sqrt(aa * bb);
}

describe('the Fourier transform', () => {
  it('finds a tone in its own bin, and comes back to the samples it started from', () => {
    const size = 1024;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    const original = new Float64Array(size);
    for (let i = 0; i < size; i++) original[i] = Math.cos((2 * Math.PI * 37 * i) / size) + 0.25 * Math.sin((2 * Math.PI * 200 * i) / size);
    re.set(original);
    fft(re, im);
    expect(Math.hypot(re[37], im[37])).toBeCloseTo(size / 2, 6);
    expect(Math.hypot(re[200], im[200])).toBeCloseTo(size / 8, 6);
    expect(Math.hypot(re[38], im[38])).toBeLessThan(1e-9);
    fft(re, im, true);
    for (let i = 0; i < size; i++) expect(re[i] / size).toBeCloseTo(original[i], 10);
    expect(() => fft(new Float64Array(1000), new Float64Array(1000))).toThrow();
  });
});

describe('a cymbal’s tables of partials', () => {
  const recipe: MetalRecipe = { name: 'test-plate', seed: 9, edges: [300, 800, 1700, 3200, 5600, 9000, 16000], spacingHz: 12, seconds: 1.3 };

  it('holds over a thousand partials, each band in its own range and at the same level', () => {
    const tables = buildMetalTables(recipe, SAMPLE_RATE);
    expect(tables.size).toBe(65536);
    expect(tables.bands).toHaveLength(6);
    let partials = 0;
    tables.bands.forEach((band, b) => {
      expect(rms(band)).toBeCloseTo(1, 3);
      const power = powerSpectrum(band, 0, band.length, false);
      const hzPerBin = SAMPLE_RATE / tables.size;
      let inside = 0;
      let total = 0;
      let largest = 0;
      for (let k = 0; k < power.length; k++) largest = Math.max(largest, power[k]);
      for (let k = 0; k < power.length; k++) {
        const hz = k * hzPerBin;
        total += power[k];
        if (hz > recipe.edges[b] * 0.9 && hz < recipe.edges[b + 1] * 1.1) inside += power[k];
        if (power[k] > largest * 1e-6) partials++;
      }
      expect(inside / total, `band ${b}`).toBeGreaterThan(0.999);
    });
    // a mode every 12 Hz from 300 Hz to 16 kHz
    expect(partials).toBeGreaterThan(1000);
    expect(partials).toBeLessThan(1600);
  });

  it('loops without a seam: every partial fits the table a whole number of times', () => {
    const { bands, size } = buildMetalTables(recipe, SAMPLE_RATE);
    // With no window, a partial that did not fit would smear across the bins; these do not.
    const power = powerSpectrum(bands[2], 0, size, false);
    const sorted = [...power].sort((a, b) => b - a);
    const total = sorted.reduce((a, b) => a + b, 0);
    let held = 0;
    for (let k = 0; k < 400; k++) held += sorted[k];
    expect(held / total).toBeGreaterThan(0.999999);
  });

  it('is the same cymbal at any sample rate, and another seed is another cymbal', () => {
    const strongest = (sampleRate: number, seed: number) => {
      const { bands, size } = buildMetalTables({ ...recipe, seed }, sampleRate);
      const power = powerSpectrum(bands[1], 0, size, false);
      let best = 0;
      for (let k = 1; k < power.length; k++) if (power[k] > power[best]) best = k;
      return (best * sampleRate) / size;
    };
    expect(Math.abs(strongest(44100, 9) - strongest(48000, 9))).toBeLessThan(1);
    expect(Math.abs(strongest(96000, 9) - strongest(48000, 9))).toBeLessThan(1);
    expect(Math.abs(strongest(48000, 10) - strongest(48000, 9))).toBeGreaterThan(1);
  });

  it('takes tables built elsewhere, and ignores ones of the wrong shape', () => {
    const mine: MetalRecipe = { ...recipe, name: 'test-primed' };
    const good = buildMetalTables(mine, SAMPLE_RATE).bands;
    primeMetalTables(mine, SAMPLE_RATE, good);
    expect(metalTables(mine, SAMPLE_RATE).bands[0]).toBe(good[0]);
    const other: MetalRecipe = { ...recipe, name: 'test-refused' };
    primeMetalTables(other, SAMPLE_RATE, [new Float32Array(1000)]);
    expect(metalTables(other, SAMPLE_RATE).bands).toHaveLength(6);
    expect(metalTables(other, SAMPLE_RATE).size).toBe(65536);
  });

  it('each new kit names its three cymbals for the page to build; the first kits need none', () => {
    for (const kit of NEW_KITS) {
      expect(kitMetalRecipes(kit).map((made) => made.name)).toEqual([`${kit}-hat`, `${kit}-ride`, `${kit}-crash`]);
      const prepared = prepareKitMetal(kit, SAMPLE_RATE);
      expect(prepared).toHaveLength(3);
      expect(prepared[0].bands[0]).toBe(metalTables(prepared[0].recipe, SAMPLE_RATE).bands[0]);
    }
    for (const kit of ['acoustic', 'machine', 'brushes'] as const) {
      expect(isStudioKitId(kit)).toBe(false);
      expect(prepareKitMetal(kit, SAMPLE_RATE)).toEqual([]);
    }
  });
});

describe('the new kits’ metal', () => {
  it('is a dense crowd of partials where the first acoustic kit was a few dozen', () => {
    const crowd = (kit: DrumKitId, piece: DrumPiece) => density(play(kit, [[0.01, piece, 1]], 1.2, PLAIN).mono, 0.1, 0.8, 4000, 12000);
    for (const piece of ['hatOpen', 'crash'] as const) {
      expect(crowd('acoustic', piece), piece).toBeLessThan(0.015);
      for (const kit of NEW_KITS) expect(crowd(kit, piece), `${kit} ${piece}`).toBeGreaterThan(0.022);
    }
  });

  it.each(NEW_KITS)('%s: the crash blooms upwards after the stroke, then loses its top first', (kit) => {
    const { mono } = play(kit, [[0.01, 'crash', 1]], 2.2, PLAIN);
    const atStroke = centroid(mono, 0.01, 0.03);
    const bloomed = centroid(mono, 0.16, 0.41);
    const late = centroid(mono, 1.01, 2.01);
    expect(bloomed).toBeGreaterThan(atStroke * 1.3);
    expect(late).toBeLessThan(bloomed * 0.9);
    // it is still ringing half a second later: it has not died
    expect(levelDb(mono, 0.5, 0.8)).toBeGreaterThan(levelDb(mono, 0.01, 0.1) - 40);
  });

  it.each(NEW_KITS)('%s: a harder crash is a brighter sound, not only a louder one', (kit) => {
    const bright = (velocity: number) => centroid(play(kit, [[0.01, 'crash', velocity]], 0.5, PLAIN).mono, 0.07, 0.41);
    expect(bright(1)).toBeGreaterThan(bright(0.4) * 1.3);
  });

  it.each(NEW_KITS)('%s: ride strokes build a wash, and every stroke is a different sound', (kit) => {
    const one = play(kit, [[0.6, 'ride', 0.7]], 1, PLAIN).mono;
    const strokes: Stroke[] = [0.04, 0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6].map((at) => [at, 'ride', 0.7] as Stroke);
    const many = play(kit, strokes, 1, PLAIN).mono;
    // above the stick's ping, where there is only wash
    const wash = (samples: Float32Array) => bandLevelDb(samples, SAMPLE_RATE, 6000, 12000, 0.8, 1);
    expect(wash(many)).toBeGreaterThan(wash(one) + 2.5);
    // two strokes a second apart with Variation at 0: the metal has moved on, so they still differ
    const twice = play(kit, [[0, 'hatClosed', 0.8], [1, 'hatClosed', 0.8]], 1.1, PLAIN).mono;
    let difference = 0;
    for (let i = 0; i < 0.05 * SAMPLE_RATE; i++) difference = Math.max(difference, Math.abs(twice[i] - twice[i + SAMPLE_RATE]));
    expect(difference).toBeGreaterThan(1e-3);
  });

  it.each(NEW_KITS)('%s: closed is a tick, open rings, and the stick or the foot chokes it', (kit) => {
    const closed = play(kit, [[0, 'hatClosed', 0.9]], 0.5, PLAIN).mono;
    const open = play(kit, [[0, 'hatOpen', 0.9]], 0.5, PLAIN).mono;
    expect(levelDb(open, 0.15, 0.2)).toBeGreaterThan(levelDb(closed, 0.15, 0.2) + 25);
    for (const stop of ['hatClosed', 'hatFoot'] as const) {
      const choked = play(kit, [[0, 'hatOpen', 0.9], [0.1, stop, 0.5]], 0.5, PLAIN).mono;
      expect(levelDb(choked, 0.25, 0.3), stop).toBeLessThan(levelDb(open, 0.25, 0.3) - 25);
    }
    // the foot alone is darker than the stick
    const foot = play(kit, [[0, 'hatFoot', 0.9]], 0.2, PLAIN).mono;
    expect(centroid(foot, 0, 0.05)).toBeLessThan(centroid(closed, 0, 0.05) * 0.9);
  });

  it.each(NEW_KITS)('%s: Hat tone, Hat length, Cymbal tone and Cymbal ring do what they say', (kit) => {
    const hat = (params: Partial<DrumParams>) => play(kit, [[0, 'hatClosed', 0.8]], 0.3, { ...PLAIN, ...params }).mono;
    expect(centroid(hat({ hatTone: 1 }), 0, 0.05)).toBeGreaterThan(centroid(hat({ hatTone: 0 }), 0, 0.05) * 1.1);
    expect(levelDb(hat({ hatDecay: 1 }), 0.06, 0.1)).toBeGreaterThan(levelDb(hat({ hatDecay: 0 }), 0.06, 0.1) + 6);
    const crash = (params: Partial<DrumParams>) => play(kit, [[0, 'crash', 0.9]], 1.6, { ...PLAIN, ...params }).mono;
    expect(centroid(crash({ cymbalTone: 1 }), 0.1, 0.5)).toBeGreaterThan(centroid(crash({ cymbalTone: 0 }), 0.1, 0.5) * 1.1);
    expect(levelDb(crash({ cymbalDecay: 4 }), 1.2, 1.6)).toBeGreaterThan(levelDb(crash({ cymbalDecay: 1 }), 1.2, 1.6) + 12);
  });

  it('is stereo: a cymbal is a different sound in each ear, where the first kits’ were one sound panned', () => {
    const sides = (kit: DrumKitId) => {
      const { left, right } = play(kit, [[0, 'crash', 0.9]], 0.6, PLAIN);
      return correlation(left, right);
    };
    expect(sides('acoustic')).toBeGreaterThan(0.999);
    for (const kit of NEW_KITS) {
      expect(sides(kit), kit).toBeLessThan(0.75);
      expect(sides(kit), kit).toBeGreaterThan(0.1);
    }
  });
});

describe('the new kits’ drums', () => {
  it.each(NEW_KITS)('%s: the kick rests at the pitch of Kick tune, and starts above it', (kit) => {
    for (const kickHz of [45, 60]) {
      const { mono } = play(kit, [[0, 'kick', 0.9]], 0.6, { ...PLAIN, kickHz, kickDecay: 1.2 });
      const resting = measureFrequency(mono, SAMPLE_RATE, kickHz, 0.25, 0.5);
      expect(Math.abs(resting - kickHz) / kickHz, `${kit} at ${kickHz}`).toBeLessThan(0.03);
    }
  });

  it('the kick has a beater: its first instant carries far more between 1 and 8 kHz than the first acoustic kit’s', () => {
    const knock = (kit: DrumKitId, params: Partial<DrumParams> = {}) => {
      const { mono } = play(kit, [[0.005, 'kick', 1]], 0.1, { ...PLAIN, ...params });
      return bandLevelDb(mono, SAMPLE_RATE, 1000, 8000, 0.005, 0.025) - levelDb(mono, 0.005, 0.025);
    };
    const old = knock('acoustic');
    for (const kit of NEW_KITS) {
      expect(knock(kit), kit).toBeGreaterThan(old + 3);
      // Kick punch is the beater: none at 0, more at 1
      expect(knock(kit, { kickPunch: 1 }), kit).toBeGreaterThan(knock(kit, { kickPunch: 0 }) + 10);
    }
  });

  it.each(NEW_KITS)('%s: Kick decay sets how long the kick rings', (kit) => {
    const tail = (kickDecay: number) => levelDb(play(kit, [[0, 'kick', 0.9]], 0.6, { ...PLAIN, kickDecay }).mono, 0.3, 0.4);
    expect(tail(1)).toBeGreaterThan(tail(0.2) + 20);
  });

  it.each(NEW_KITS)('%s: Snares is the wires, a harder stroke throws them for longer, and a ghost note sits far under a backbeat', (kit) => {
    const wires = (snareWires: number, velocity = 0.9) => {
      const { mono } = play(kit, [[0, 'snare', velocity]], 0.3, { ...PLAIN, snareWires });
      return bandLevelDb(mono, SAMPLE_RATE, 5000, 12000, 0.01, 0.06);
    };
    // (garage's clap is noise too, so its wires stand out less)
    expect(wires(1)).toBeGreaterThan(wires(0) + (kit === 'garage' ? 6 : 15));
    const length = (velocity: number) => {
      const { mono } = play(kit, [[0, 'snare', velocity]], 0.4, PLAIN);
      return bandLevelDb(mono, SAMPLE_RATE, 5000, 12000, 0.1, 0.16) - bandLevelDb(mono, SAMPLE_RATE, 5000, 12000, 0.01, 0.04);
    };
    expect(length(1)).toBeGreaterThan(length(0.3) + 2);
    const ghost = levelDb(play(kit, [[0, 'snare', 0.2]], 0.3, PLAIN).mono, 0, 0.3);
    const backbeat = levelDb(play(kit, [[0, 'snare', 0.9]], 0.3, PLAIN).mono, 0, 0.3);
    expect(backbeat - ghost).toBeGreaterThan(13);
    expect(backbeat - ghost).toBeLessThan(32);
  });

  it('rock: the snare’s middle is filled in, where the first acoustic kit had a hole between 700 Hz and 2 kHz', () => {
    const middle = (kit: DrumKitId) => {
      const { mono } = play(kit, [[0, 'snare', 0.9]], 0.3, PLAIN);
      return bandLevelDb(mono, SAMPLE_RATE, 700, 2000, 0, 0.3) - levelDb(mono, 0, 0.3);
    };
    expect(middle('acoustic')).toBeLessThan(-11);
    expect(middle('rock')).toBeGreaterThan(middle('acoustic') + 4);
  });

  it('rock: a backbeat is a rimshot (the shell rings between 700 Hz and 1 kHz), and a softer stroke is not', () => {
    const ring = (velocity: number) => {
      const { mono } = play('rock', [[0, 'snare', velocity]], 0.3, { ...PLAIN, snareWires: 0 });
      return bandLevelDb(mono, SAMPLE_RATE, 780, 950, 0.03, 0.15) - bandLevelDb(mono, SAMPLE_RATE, 150, 260, 0.03, 0.15);
    };
    expect(ring(1)).toBeGreaterThan(ring(0.7) + 6);
    expect(STUDIO_KITS.neon.snare.rimshot).toBeNull();
  });

  it('garage: the snare has a clap on it, three hands landing a hundredth of a second apart', () => {
    const clapBand = (kit: DrumKitId) => {
      const { mono } = play(kit, [[0, 'snare', 0.9]], 0.2, { ...PLAIN, snareWires: 0 });
      return bandLevelDb(mono, SAMPLE_RATE, 1100, 2000, 0.012, 0.035) - bandLevelDb(mono, SAMPLE_RATE, 150, 300, 0.012, 0.035);
    };
    expect(clapBand('garage')).toBeGreaterThan(clapBand('neon') + 8);
    // the second and third hands: the clap's band is louder just after each lands than just before
    const { mono } = play('garage', [[0, 'snare', 0.9]], 0.2, { ...PLAIN, snareWires: 0 });
    for (const landing of [0.0105, 0.021]) {
      const before = bandLevelDb(mono, SAMPLE_RATE, 1100, 2000, landing - 0.004, landing - 0.0005);
      const after = bandLevelDb(mono, SAMPLE_RATE, 1100, 2000, landing + 0.0005, landing + 0.004);
      expect(after, `hand at ${landing}`).toBeGreaterThan(before + 1.5);
    }
  });

  it('neon: the room behind the snare holds, then shuts; a ghost note does not open it', () => {
    const snare = (velocity: number, room: number) => play('neon', [[0, 'snare', velocity]], 0.6, { variation: 0, room }).mono;
    const wet = snare(0.9, 0.6);
    const dry = snare(0.9, 0);
    // held: at a tenth of a second the room is most of what is heard
    expect(levelDb(wet, 0.1, 0.15)).toBeGreaterThan(levelDb(dry, 0.1, 0.15) + 8);
    // shut: a tenth of a second later it has gone, where an open room of this size would still ring
    expect(levelDb(wet, 0.26, 0.32)).toBeLessThan(levelDb(wet, 0.1, 0.15) - 35);
    const ghostWet = snare(0.3, 0.6);
    const ghostDry = snare(0.3, 0);
    expect(levelDb(ghostWet, 0.1, 0.15)).toBeLessThan(levelDb(ghostDry, 0.1, 0.15) + 1);
  });

  it.each(NEW_KITS)('%s: every piece has its own voice, ten in all, and no stroke needs another', (kit) => {
    const drums = createKit(kit, SAMPLE_RATE, DEFAULT_DRUM_PARAMS[kit], new Random(1));
    expect(drums.strips).toHaveLength(10);
    const used = new Set<number>();
    for (const piece of DRUM_PIECES) {
      const one = createKit(kit, SAMPLE_RATE, DEFAULT_DRUM_PARAMS[kit], new Random(1));
      one.hit(piece, 0.8, 0.2);
      const active = one.strips.map((strip, index) => (strip.voice.active ? index : -1)).filter((index) => index >= 0);
      expect(active, `${kit} ${piece}`).toHaveLength(1);
      used.add(active[0]);
    }
    // the three hi-hat sounds share one pair of cymbals, and a brush tap is the snare
    expect(used.size).toBe(10);
  });

  it('every kit’s default dials are inside the dials’ ranges', () => {
    for (const kit of NEW_KITS) {
      for (const spec of DRUM_PARAM_SPECS) {
        expect(DEFAULT_DRUM_PARAMS[kit][spec.key], `${kit} ${spec.key}`).toBeGreaterThanOrEqual(spec.min);
        expect(DEFAULT_DRUM_PARAMS[kit][spec.key], `${kit} ${spec.key}`).toBeLessThanOrEqual(spec.max);
      }
    }
  });
});

describe('the drum room', () => {
  const impulse = (room: SmallRoom | DrumRoom, seconds = 1) => {
    const length = Math.round(seconds * SAMPLE_RATE);
    const left = new Float64Array(length);
    const right = new Float64Array(length);
    const input = new Float64Array(128);
    const l = new Float64Array(128);
    const r = new Float64Array(128);
    for (let frame = 0; frame + 128 <= length; frame += 128) {
      input.fill(0);
      if (frame === 0) input[0] = 1;
      l.fill(0);
      r.fill(0);
      room.process(input, l, r, 128, 1);
      left.set(l, frame);
      right.set(r, frame);
    }
    return { left, right };
  };
  const settings = { seconds: 0.85, treble: 0.5, size: 1.25, lowCutHz: 110, early: 0.8 };
  /** How like noise the echoes are in a 20 ms window (Abel and Huang's echo density): 1 is fully dense. */
  const echoDensity = (samples: Float64Array, atSeconds: number) => {
    const window = Math.round(0.02 * SAMPLE_RATE);
    const from = Math.round(atSeconds * SAMPLE_RATE) - window / 2;
    let sum = 0;
    for (let i = from; i < from + window; i++) sum += samples[i] * samples[i];
    const deviation = Math.sqrt(sum / window);
    let outside = 0;
    for (let i = from; i < from + window; i++) if (Math.abs(samples[i]) > deviation) outside++;
    return outside / window / 0.3173;
  };
  /** How uneven the tail's spectrum is, in decibels: about 5.6 for a dense room, more when it rings at a few pitches. */
  const roughness = (samples: Float64Array) => {
    const power = powerSpectrum(samples, Math.round(0.05 * SAMPLE_RATE), Math.round(0.4 * SAMPLE_RATE));
    const hzPerBin = SAMPLE_RATE / (power.length * 2);
    const dbs: number[] = [];
    for (let k = Math.ceil(200 / hzPerBin); k < 4000 / hzPerBin; k++) dbs.push(10 * Math.log10(power[k] + 1e-30));
    const mean = dbs.reduce((a, b) => a + b, 0) / dbs.length;
    return Math.sqrt(dbs.reduce((a, b) => a + (b - mean) ** 2, 0) / dbs.length);
  };

  it('is dense sooner than the first room, and rings more evenly', () => {
    const first = impulse(new SmallRoom(SAMPLE_RATE, 0.42)).left;
    const second = impulse(new DrumRoom(SAMPLE_RATE, settings)).left;
    expect(echoDensity(second, 0.06)).toBeGreaterThan(0.85);
    expect(echoDensity(second, 0.06)).toBeGreaterThan(echoDensity(first, 0.06) + 0.1);
    expect(echoDensity(second, 0.04)).toBeGreaterThan(echoDensity(first, 0.04) + 0.15);
    expect(roughness(second)).toBeLessThan(roughness(first) - 1);
    expect(roughness(second)).toBeLessThan(7);
  });

  it('has no gap between its first echoes and its tail, and dies away in the time asked', () => {
    const { left } = impulse(new DrumRoom(SAMPLE_RATE, settings), 1.5);
    const level = (from: number, to: number) => toDb(rms(left, Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE)));
    for (let at = 0.01; at < 0.11; at += 0.01) expect(Math.abs(level(at, at + 0.01) - level(0.01, 0.11)), `at ${at}`).toBeLessThan(4);
    // 60 dB in 0.85 s: so about 35 dB between half a second apart
    const fall = level(0.2, 0.3) - level(0.7, 0.8);
    expect(fall).toBeGreaterThan(28);
    expect(fall).toBeLessThan(43);
  });

  it('is different in each ear, keeps the lows out, and goes to sleep holding only zeros', () => {
    const room = new DrumRoom(SAMPLE_RATE, settings);
    const { left, right } = impulse(room, 4);
    expect(Math.abs(correlation(left.subarray(0, SAMPLE_RATE), right.subarray(0, SAMPLE_RATE)))).toBeLessThan(0.2);
    expect(bandLevelDb(left, SAMPLE_RATE, 20, 60, 0, 1)).toBeLessThan(bandLevelDb(left, SAMPLE_RATE, 400, 1200, 0, 1) - 10);
    // left to itself it dies away and sleeps
    const silence = new Float64Array(128);
    for (let block = 0; block < (6 * SAMPLE_RATE) / 128; block++) {
      room.process(null, silence, silence, 128, 0);
      room.settle(false);
    }
    expect(room.active).toBe(false);
    let allZero = true;
    room.forEachState((value) => {
      if (value !== 0) allZero = false;
    });
    expect(allZero).toBe(true);
  });

  it('gated: silent until it is opened, heard while it is held, then shut', () => {
    const room = new DrumRoom(SAMPLE_RATE, { ...settings, seconds: 1.6, gate: { holdSeconds: 0.16, releaseSeconds: 0.035 } });
    const closed = impulse(room, 0.3).left;
    expect(closed.every((value) => value === 0)).toBe(true);
    room.sleep();
    room.open();
    const { left } = impulse(room, 0.5);
    const level = (from: number, to: number) => toDb(rms(left, Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE)));
    expect(level(0.05, 0.15)).toBeGreaterThan(-60);
    expect(level(0.3, 0.4)).toBeLessThan(level(0.05, 0.15) - 60);
  });
});

describe('the drum bus', () => {
  const glue = STUDIO_KITS.rock.glue;

  it('leaves a quiet kit alone, turns a loud one down slowly, and never passes its ceiling', () => {
    const bus = new GlueBus(SAMPLE_RATE, glue);
    const tone = (amplitude: number, seconds: number) => {
      const left = new Float64Array(Math.round(seconds * SAMPLE_RATE));
      for (let i = 0; i < left.length; i++) left[i] = amplitude * Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE);
      const right = Float64Array.from(left);
      for (let at = 0; at < left.length; at += 128) {
        const count = Math.min(128, left.length - at);
        bus.process(left.subarray(at, at + count), right.subarray(at, at + count), count);
      }
      return left;
    };
    // under the threshold: only the gain after the compressor
    const quiet = tone(0.05, 0.3);
    expect(rms(quiet, 9600) / (0.05 / Math.SQRT2)).toBeCloseTo(glue.makeup, 2);
    expect(bus.takeReduction()).toBeCloseTo(0, 9);
    bus.reset();
    // over it: the first instant passes, and a fifth of a second later it is held down
    const loud = tone(0.6, 0.3);
    const early = rms(loud, 0, 96);
    const late = rms(loud, 9600);
    expect(late).toBeLessThan(early * 0.8);
    expect(bus.takeReduction()).toBeGreaterThan(6);
    bus.reset();
    // far over it: bent, never past the ceiling
    const huge = tone(20, 0.1);
    expect(Math.max(...huge.map(Math.abs))).toBeLessThanOrEqual(glue.ceiling);
    bus.reset();
    let allZero = true;
    bus.forEachState((value) => {
      if (value !== 0) allZero = false;
    });
    expect(allZero).toBe(true);
  });

  it('holds the kit together: far less from peak to loudness than the first kits, at the same loudness', () => {
    const measure = (kit: DrumKitId) => stereoLevels(renderDrumPart(referencePart(kit), { bpm: REFERENCE_BPM, sampleRate: SAMPLE_RATE, kit }), SAMPLE_RATE);
    const first = measure('acoustic');
    for (const kit of NEW_KITS) {
      const levels = measure(kit);
      expect(Math.abs(levels.loudness - first.loudness), kit).toBeLessThan(0.5);
      expect(levels.peakDb - levels.loudness, kit).toBeLessThan(first.peakDb - first.loudness - 2.5);
      // so its peaks are lower in the jam's mix: at least 3 dB more room than the first acoustic kit
      expect(levels.peakDb, kit).toBeLessThan(first.peakDb - 3);
    }
  });

  it('works on the backbeats, not all the time', () => {
    for (const kit of NEW_KITS) {
      const part = referencePart(kit);
      const synth = new DrumSynth(SAMPLE_RATE, kit);
      const framesPerBeat = (60 / REFERENCE_BPM) * SAMPLE_RATE;
      for (const hit of part.hits) synth.hit(hit.beat * framesPerBeat, hit.piece, hit.velocity);
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      for (let frame = 0; frame < part.beats * framesPerBeat; frame += 128) synth.render(left, right, frame);
      const most = synth.takeGlueReduction();
      expect(most, kit).toBeGreaterThan(2);
      expect(most, kit).toBeLessThan(11);
    }
    expect(new DrumSynth(SAMPLE_RATE, 'acoustic').takeGlueReduction()).toBeCloseTo(0, 9);
  });
});

describe('the new kits in the jam', () => {
  it('no groove, at full strength on every piece, comes near full scale: 6 dB or more to spare', () => {
    for (const kit of NEW_KITS) {
      for (const groove of DRUM_GROOVES) {
        const part = groovePart(groove.id, { bars: 2, steps: 2, startBar: 2, humanize: 0 });
        for (const hit of part.hits) hit.velocity = 1;
        const levels = stereoLevels(renderDrumPart(part, { bpm: 120, sampleRate: SAMPLE_RATE, kit }), SAMPLE_RATE);
        expect(levels.peakDb, `${kit} ${groove.id}`).toBeLessThan(-6);
      }
      // the kit's own ceiling: its clipper's top, times its output gain
      const ceilingDb = toDb(STUDIO_KITS[kit].glue.ceiling * KIT_OUTPUT_GAIN[kit]);
      const everything = play(kit, DRUM_PIECES.filter((piece) => piece !== 'brushSweep').map((piece) => [0.01, piece, 1] as Stroke), 0.5, { drive: 1 });
      expect(stereoLevels(everything, SAMPLE_RATE).peakDb, kit).toBeLessThanOrEqual(ceilingDb + 0.01);
    }
  });

  it('each voice alone costs a small part of real time', () => {
    for (const kit of NEW_KITS) {
      for (const piece of ['kick', 'snare', 'tomLow', 'hatClosed', 'ride', 'crash'] as const) {
        const strokes: Stroke[] = Array.from({ length: 20 }, (_, i) => [i * 0.25, piece, 0.8] as Stroke);
        play(kit, strokes, 1, { room: 0 }); // warm up the compiler
        const start = performance.now();
        play(kit, strokes, 5, { room: 0 });
        // five seconds of one voice in well under a twentieth of that time; in practice a few thousandths
        expect(performance.now() - start, `${kit} ${piece}`).toBeLessThan(250);
      }
    }
  });
});
