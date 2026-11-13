import { describe, expect, it } from 'vitest';
import { bandLevelDb, fallTime, measureFrequency, spectralCentroid } from '../dsp/analysis';
import { rms, toDb } from '../dsp/loudness';
import { Random } from '../dsp/random';
import { DRUM_GROOVES } from '../../drumGrooves';
import {
  DEFAULT_DRUM_PARAMS,
  DRUM_KIT_IDS,
  DRUM_PARAM_SPECS,
  DRUM_PIECES,
  sanitizeDrumParams,
  type DrumKitId,
  type DrumParams,
  type DrumPiece,
} from './drumParams';
import { REFERENCE_BPM, groovePart, measureKit, referencePart, renderDrumPart, stereoLevels } from './drumPattern';
import { DrumSynth } from './drumSynth';
import { MembraneModes } from './membranes';

const SAMPLE_RATE = 48000;
/** Plain, repeatable settings: no room, and no difference from one stroke to the next. */
const PLAIN: Partial<DrumParams> = { room: 0, variation: 0 };
/** The pieces that are struck: everything but the brush sweep, which swells. */
const STRUCK = DRUM_PIECES.filter((piece) => piece !== 'brushSweep');

type Stroke = [seconds: number, piece: DrumPiece, velocity: number, sweepSeconds?: number];

interface Rendered {
  left: Float32Array;
  right: Float32Array;
  /** The two ears averaged. */
  mono: Float32Array;
  synth: DrumSynth;
}

function renderInBlocks(synth: DrumSynth, left: Float32Array, right: Float32Array, block: number, startFrame = 0): void {
  for (let at = 0; at < left.length; at += block) synth.render(left, right, startFrame + at, at, Math.min(left.length, at + block));
}

function play(
  kit: DrumKitId,
  strokes: Stroke[],
  seconds: number,
  params: Partial<DrumParams> = {},
  options: { sampleRate?: number; seed?: number; block?: number } = {},
): Rendered {
  const sampleRate = options.sampleRate ?? SAMPLE_RATE;
  const synth = new DrumSynth(sampleRate, kit, params, options.seed ?? 1);
  for (const [at, piece, velocity, sweep] of strokes) synth.hit(at * sampleRate, piece, velocity, (sweep ?? 0) * sampleRate);
  const length = Math.round(seconds * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  renderInBlocks(synth, left, right, options.block ?? 128);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) mono[i] = 0.5 * (left[i] + right[i]);
  return { left, right, mono, synth };
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

const centroid = (samples: Float32Array, from: number, to: number) => spectralCentroid(samples, SAMPLE_RATE, from, to, 20000);

/** Finite, and either exactly zero or comfortably above the denormal range. */
const sound = (value: number, floor: number) => Number.isFinite(value) && (value === 0 || Math.abs(value) > floor);

describe('every piece of every kit', () => {
  it.each(DRUM_KIT_IDS)('%s: a stroke starts on the exact sample it was asked for', (kit) => {
    for (const piece of STRUCK) {
      const { left, right } = play(kit, [[1000 / SAMPLE_RATE, piece, 0.9]], 0.05);
      let first = -1;
      for (let i = 0; i < left.length && first < 0; i++) if (left[i] !== 0 || right[i] !== 0) first = i;
      expect(first, `${kit} ${piece}`).toBeGreaterThanOrEqual(1000);
      expect(first, `${kit} ${piece}`).toBeLessThan(1003);
    }
  });

  it.each(DRUM_KIT_IDS)('%s: every piece dies away to exact silence, and the kit goes to sleep', (kit) => {
    for (const piece of DRUM_PIECES) {
      const { left, right, synth } = play(kit, [[0, piece, 1, 0.5]], 14);
      expect(synth.silent, `${kit} ${piece}`).toBe(true);
      expect(synth.activeVoices).toBe(0);
      const tail = SAMPLE_RATE; // the last second
      expect(left.subarray(left.length - tail).every((value) => value === 0)).toBe(true);
      expect(right.subarray(right.length - tail).every((value) => value === 0)).toBe(true);
      let allZero = true;
      synth.forEachState((value) => {
        if (value !== 0) allZero = false;
      });
      expect(allZero, `${kit} ${piece} left something behind`).toBe(true);
    }
  });

  it('every kit answers every piece (a machine has no brush to sweep, and says nothing)', () => {
    for (const kit of DRUM_KIT_IDS) {
      for (const piece of DRUM_PIECES) {
        const { mono } = play(kit, [[0, piece, 0.9, 0.3]], 0.3, PLAIN);
        const heard = levelDb(mono, 0, 0.3) > -70;
        expect(heard, `${kit} ${piece}`).toBe(!(kit === 'machine' && piece === 'brushSweep'));
      }
    }
  });

  it('gets louder with velocity, and a ghost note sits far under a backbeat', () => {
    for (const kit of DRUM_KIT_IDS) {
      for (const piece of STRUCK) {
        const soft = levelDb(play(kit, [[0, piece, 0.3]], 0.3, PLAIN).mono, 0, 0.3);
        const hard = levelDb(play(kit, [[0, piece, 0.9]], 0.3, PLAIN).mono, 0, 0.3);
        expect(hard - soft, `${kit} ${piece}`).toBeGreaterThan(8);
      }
    }
    for (const kit of ['acoustic', 'machine'] as const) {
      const ghost = levelDb(play(kit, [[0, 'snare', 0.2]], 0.3, PLAIN).mono, 0, 0.3);
      const backbeat = levelDb(play(kit, [[0, 'snare', 0.9]], 0.3, PLAIN).mono, 0, 0.3);
      expect(backbeat - ghost).toBeGreaterThan(15);
      expect(backbeat - ghost).toBeLessThan(32);
    }
  });

  it('a harder stroke is a different sound, not the soft one turned up', () => {
    // More of its attack is in the upper part of its spectrum. For each piece: where "upper" starts, in hertz.
    const cases: [DrumKitId, DrumPiece, number][] = [
      ['acoustic', 'kick', 150],
      ['acoustic', 'tomMid', 350],
      ['acoustic', 'hatClosed', 9000],
      ['acoustic', 'ride', 6000],
      ['acoustic', 'crash', 7000],
      ['machine', 'kick', 150],
      ['machine', 'tomMid', 350],
    ];
    for (const [kit, piece, upperHz] of cases) {
      const share = (velocity: number) => {
        const { mono } = play(kit, [[0.005, piece, velocity]], 0.1, PLAIN);
        return bandLevelDb(mono, SAMPLE_RATE, upperHz, 20000, 0, 0.06) - levelDb(mono, 0, 0.06);
      };
      expect(share(1), `${kit} ${piece}`).toBeGreaterThan(share(0.3) + 1);
    }
    // A snare is two things. A soft stroke is more wires than head (see "a ghost note" below),
    // so the fair question is whether the wires themselves get brighter: they do.
    for (const kit of ['acoustic', 'machine'] as const) {
      const wires = (velocity: number) => {
        const { mono } = play(kit, [[0.005, 'snare', velocity]], 0.1, PLAIN);
        return bandLevelDb(mono, SAMPLE_RATE, 8000, 20000, 0, 0.06) - bandLevelDb(mono, SAMPLE_RATE, 2000, 5000, 0, 0.06);
      };
      expect(wires(1), kit).toBeGreaterThan(wires(0.3) + 2);
    }
  });

  it('puts the kick and snare in the middle, the hi-hat to the left and the ride to the right', () => {
    for (const kit of DRUM_KIT_IDS) {
      const side = (piece: DrumPiece) => {
        const { left, right } = play(kit, [[0, piece, 0.9]], 0.3, PLAIN);
        return levelDb(right, 0, 0.3) - levelDb(left, 0, 0.3);
      };
      expect(Math.abs(side('kick')), kit).toBeLessThan(0.3);
      expect(Math.abs(side('snare')), kit).toBeLessThan(1.5);
      expect(side('hatClosed'), kit).toBeLessThan(-3);
      expect(side('ride'), kit).toBeGreaterThan(3);
      expect(side('tomHigh'), kit).toBeLessThan(side('tomLow') - 4);
    }
  });
});

describe('the drumhead model', () => {
  it('rings at the frequency it is tuned to, and falls by 60 dB in the time asked', () => {
    const modes = new MembraneModes(SAMPLE_RATE, 1);
    modes.tune(0, 440, 0.5);
    modes.push(0, 1);
    const out = new Float64Array(SAMPLE_RATE);
    for (let at = 0; at < out.length; at += 128) modes.render(out.subarray(at, Math.min(out.length, at + 128)), Math.min(128, out.length - at));
    expect(measureFrequency(out, SAMPLE_RATE, 440, 0.05, 0.4)).toBeCloseTo(440, 1);
    const early = toDb(rms(out, 0.1 * SAMPLE_RATE, 0.11 * SAMPLE_RATE));
    const late = toDb(rms(out, 0.35 * SAMPLE_RATE, 0.36 * SAMPLE_RATE));
    expect(early - late).toBeCloseTo(30, 0); // a quarter second is half of the 60 dB
  });

  it('starts sharp when the head is stretched, and settles to its resting pitch', () => {
    const modes = new MembraneModes(SAMPLE_RATE, 1);
    modes.tune(0, 1000, 1);
    modes.push(0, 1);
    modes.stretch(0.2, 0.02);
    const out = new Float64Array(SAMPLE_RATE / 2);
    for (let at = 0; at < out.length; at += 128) modes.render(out.subarray(at, at + 128), Math.min(128, out.length - at));
    const early = measureFrequency(out, SAMPLE_RATE, 1150, 0, 0.012, 4);
    const late = measureFrequency(out, SAMPLE_RATE, 1000, 0.2, 0.4);
    expect(early).toBeGreaterThan(1080);
    expect(late).toBeCloseTo(1000, 0);
  });
});

describe('the kick', () => {
  it.each(['acoustic', 'machine'] as const)('%s: rests at the pitch of Kick tune', (kit) => {
    for (const hz of [45, 58, 75]) {
      const { mono } = play(kit, [[0, 'kick', 0.9]], 0.6, { ...PLAIN, kickHz: hz, kickDecay: 0.8, kickPunch: 0.5 });
      const measured = measureFrequency(mono, SAMPLE_RATE, hz, 0.2, 0.55, 5);
      expect(Math.abs(measured - hz) / hz, `${kit} at ${hz} Hz`).toBeLessThan(0.03);
    }
  });

  it.each(['acoustic', 'machine'] as const)('%s: Kick decay sets how long it rings', (kit) => {
    const ring = (seconds: number) => fallTime(play(kit, [[0, 'kick', 0.9]], 3, { ...PLAIN, kickDecay: seconds }).mono, SAMPLE_RATE, 40, 0.02).seconds;
    const short = ring(0.2);
    const long = ring(1);
    expect(short).toBeLessThan(0.25);
    expect(long).toBeGreaterThan(0.45);
    expect(long).toBeLessThan(1);
  });

  it.each(['acoustic', 'machine'] as const)('%s: Kick punch adds the click and the pitch drop, which small speakers can carry', (kit) => {
    const click = (punch: number) => bandLevelDb(play(kit, [[0.005, 'kick', 0.9]], 0.2, { ...PLAIN, kickPunch: punch }).mono, SAMPLE_RATE, 1000, 8000, 0, 0.05);
    expect(click(1)).toBeGreaterThan(click(0) + 8);
    const upper = (punch: number) => bandLevelDb(play(kit, [[0.005, 'kick', 0.9]], 0.2, { ...PLAIN, kickPunch: punch }).mono, SAMPLE_RATE, 150, 6000, 0, 0.05);
    expect(upper(1)).toBeGreaterThan(upper(0) + 1.5);
    // and at the default there is real energy above 150 Hz, within 20 dB of the whole
    const { mono } = play(kit, [[0.005, 'kick', 0.9]], 0.2, PLAIN);
    expect(bandLevelDb(mono, SAMPLE_RATE, 150, 6000, 0, 0.1)).toBeGreaterThan(levelDb(mono, 0, 0.1) - 20);
  });
});

describe('the snare', () => {
  it.each(['acoustic', 'machine'] as const)('%s: Snares is the wires: with them off it is a drum, with them on there is noise above 3 kHz', (kit) => {
    const high = (wires: number) => bandLevelDb(play(kit, [[0.005, 'snare', 0.9]], 0.3, { ...PLAIN, snareWires: wires }).mono, SAMPLE_RATE, 3000, 12000, 0.02, 0.15);
    expect(high(0.8)).toBeGreaterThan(high(0) + 20);
  });

  it.each(['acoustic', 'machine'] as const)('%s: a harder stroke throws the wires for longer', (kit) => {
    const length = (velocity: number) => {
      const { mono } = play(kit, [[0.005, 'snare', velocity]], 0.6, PLAIN);
      return bandLevelDb(mono, SAMPLE_RATE, 3000, 12000, 0.12, 0.2) - bandLevelDb(mono, SAMPLE_RATE, 3000, 12000, 0.01, 0.04);
    };
    // how far the wires have fallen by 0.12 s: less for the hard stroke
    expect(length(1)).toBeGreaterThan(length(0.3) + 3);
  });

  it('acoustic: a ghost note is mostly wires', () => {
    const share = (velocity: number) => {
      const { mono } = play('acoustic', [[0.005, 'snare', velocity]], 0.3, PLAIN);
      return bandLevelDb(mono, SAMPLE_RATE, 3000, 12000, 0, 0.15) - bandLevelDb(mono, SAMPLE_RATE, 120, 500, 0, 0.15);
    };
    expect(share(0.2)).toBeGreaterThan(share(1) + 2);
  });

  it('a cross-stick is a short knock between 400 Hz and 4 kHz, gone in a tenth of a second', () => {
    for (const kit of ['acoustic', 'machine'] as const) {
      const { mono } = play(kit, [[0.005, 'rim', 0.9]], 0.4, PLAIN);
      expect(bandLevelDb(mono, SAMPLE_RATE, 400, 4000, 0, 0.1)).toBeGreaterThan(levelDb(mono, 0, 0.1) - 3);
      expect(fallTime(mono, SAMPLE_RATE, 30).seconds).toBeLessThan(0.1);
    }
  });
});

describe('the hi-hats', () => {
  it.each(['acoustic', 'machine'] as const)('%s: closed is a tick, open rings', (kit) => {
    const closed = play(kit, [[0.005, 'hatClosed', 0.9]], 1.5, PLAIN).mono;
    const open = play(kit, [[0.005, 'hatOpen', 0.9]], 1.5, PLAIN).mono;
    expect(fallTime(closed, SAMPLE_RATE, 30).seconds).toBeLessThan(0.12);
    expect(fallTime(open, SAMPLE_RATE, 30).seconds).toBeGreaterThan(0.25);
    // both are metal: their weight is above 3 kHz
    expect(centroid(closed, 0, 0.05)).toBeGreaterThan(4500);
    expect(centroid(open, 0, 0.3)).toBeGreaterThan(4500);
  });

  it.each(['acoustic', 'machine'] as const)('%s: closing the hats chokes the ring, with the stick or with the foot', (kit) => {
    const free = play(kit, [[0.005, 'hatOpen', 0.9]], 0.6, PLAIN).mono;
    for (const closer of ['hatClosed', 'hatFoot'] as const) {
      const choked = play(kit, [[0.005, 'hatOpen', 0.9], [0.2, closer, 0.4]], 0.6, PLAIN).mono;
      expect(levelDb(choked, 0.4, 0.5), `${kit} ${closer}`).toBeLessThan(levelDb(free, 0.4, 0.5) - 20);
    }
  });

  it('acoustic: the foot alone is darker than the stick, with no click', () => {
    const stick = play('acoustic', [[0.005, 'hatClosed', 0.8]], 0.2, PLAIN).mono;
    const foot = play('acoustic', [[0.005, 'hatFoot', 0.8]], 0.2, PLAIN).mono;
    expect(centroid(foot, 0, 0.06)).toBeLessThan(centroid(stick, 0, 0.06) * 0.8);
  });

  it('Hat tone and Hat length do what they say', () => {
    for (const kit of ['acoustic', 'machine'] as const) {
      const bright = centroid(play(kit, [[0.005, 'hatClosed', 0.9]], 0.2, { ...PLAIN, hatTone: 1 }).mono, 0, 0.05);
      const dark = centroid(play(kit, [[0.005, 'hatClosed', 0.9]], 0.2, { ...PLAIN, hatTone: 0 }).mono, 0, 0.05);
      expect(bright, kit).toBeGreaterThan(dark * 1.08);
      const loose = fallTime(play(kit, [[0.005, 'hatOpen', 0.9]], 3, { ...PLAIN, hatDecay: 1 }).mono, SAMPLE_RATE, 30).seconds;
      const tight = fallTime(play(kit, [[0.005, 'hatOpen', 0.9]], 3, { ...PLAIN, hatDecay: 0 }).mono, SAMPLE_RATE, 30).seconds;
      expect(loose, kit).toBeGreaterThan(tight * 1.4);
    }
  });
});

describe('the cymbals', () => {
  it('acoustic: the crash blooms after the stroke, and starts brighter than it ends', () => {
    const { mono } = play('acoustic', [[0.005, 'crash', 1]], 4, PLAIN);
    const loudest = fallTime(mono, SAMPLE_RATE, 20, 0.004);
    expect(loudest.peakSeconds).toBeGreaterThan(0.012);
    expect(loudest.peakSeconds).toBeLessThan(0.12);
    expect(centroid(mono, 0.02, 0.2)).toBeGreaterThan(centroid(mono, 1.2, 1.6) * 1.3);
    // it lasts: still within 40 dB of its loudest after a second, and gone after six
    expect(levelDb(mono, 1, 1.1)).toBeGreaterThan(levelDb(mono, 0.03, 0.13) - 40);
  });

  it('acoustic: a harder crash blooms more than a soft one, beyond being louder', () => {
    const bloom = (velocity: number) => {
      const { mono } = play('acoustic', [[0.005, 'crash', velocity]], 0.5, PLAIN);
      return levelDb(mono, 0.03, 0.2) - levelDb(mono, 0.005, 0.012);
    };
    expect(bloom(1)).toBeGreaterThan(bloom(0.3));
  });

  it('acoustic: the ride is a ping over a wash, and strokes build the wash', () => {
    const one = play('acoustic', [[0.005, 'ride', 0.8]], 0.5, PLAIN).mono;
    // the ping: the loudest moment is the stroke itself
    expect(fallTime(one, SAMPLE_RATE, 20, 0.004).peakSeconds).toBeLessThan(0.012);
    const strokes: Stroke[] = [];
    for (let i = 0; i < 8; i++) strokes.push([0.005 + i * 0.3, 'ride', 0.8]);
    const many = play('acoustic', strokes, 2.6, PLAIN).mono;
    // just before the second stroke, and just before the eighth
    expect(levelDb(many, 2.05, 2.1)).toBeGreaterThan(levelDb(many, 0.25, 0.3) + 2);
  });

  it('Cymbal decay and Cymbal tone do what they say', () => {
    for (const kit of ['acoustic', 'machine'] as const) {
      const ring = (seconds: number) => fallTime(play(kit, [[0.005, 'crash', 0.9]], 8, { ...PLAIN, cymbalDecay: seconds }).mono, SAMPLE_RATE, 40, 0.02).seconds;
      expect(ring(4), kit).toBeGreaterThan(ring(1) * 1.8);
      const tone = (value: number) => centroid(play(kit, [[0.005, 'crash', 0.9]], 0.4, { ...PLAIN, cymbalTone: value }).mono, 0.02, 0.3);
      expect(tone(1), kit).toBeGreaterThan(tone(0) * 1.1);
    }
  });

  it('machine: all the metal is the six square waves, heard between 2 and 12 kHz', () => {
    for (const piece of ['hatClosed', 'hatOpen', 'ride', 'crash'] as const) {
      const { mono } = play('machine', [[0.005, piece, 0.9]], 0.3, PLAIN);
      expect(bandLevelDb(mono, SAMPLE_RATE, 2000, 12000, 0, 0.2), piece).toBeGreaterThan(levelDb(mono, 0, 0.2) - 1.5);
      expect(bandLevelDb(mono, SAMPLE_RATE, 20, 800, 0, 0.2), piece).toBeLessThan(levelDb(mono, 0, 0.2) - 30);
    }
  });

  it('no cymbal has a note: its strongest partial holds a small share of its sound', () => {
    for (const piece of ['ride', 'crash', 'hatOpen'] as const) {
      const { mono } = play('acoustic', [[0.005, piece, 0.9]], 1.2, PLAIN);
      const whole = levelDb(mono, 0.3, 1);
      let strongest = -Infinity;
      for (let hz = 250; hz < 6000; hz *= 1.03) strongest = Math.max(strongest, bandLevelDb(mono, SAMPLE_RATE, hz, hz * 1.03, 0.3, 1));
      expect(strongest, piece).toBeLessThan(whole - 6);
    }
  });
});

describe('the machine kit’s gated burst and the acoustic kit’s room', () => {
  it('machine: Room opens a burst behind the snare that holds, then shuts', () => {
    const snare = (room: number) => play('machine', [[0.005, 'snare', 1]], 0.6, { variation: 0, room }).mono;
    const dry = snare(0);
    const gated = snare(1);
    expect(bandLevelDb(gated, SAMPLE_RATE, 500, 5000, 0.07, 0.12)).toBeGreaterThan(bandLevelDb(dry, SAMPLE_RATE, 500, 5000, 0.07, 0.12) + 3);
    // shut: a quarter of a second after the stroke the burst has gone
    expect(bandLevelDb(gated, SAMPLE_RATE, 500, 5000, 0.3, 0.4)).toBeLessThan(bandLevelDb(gated, SAMPLE_RATE, 500, 5000, 0.07, 0.12) - 30);
  });

  it('machine: a ghost note does not open the gate', () => {
    const tail = (velocity: number, room: number) => bandLevelDb(play('machine', [[0.005, 'snare', velocity]], 0.3, { variation: 0, room }).mono, SAMPLE_RATE, 500, 5000, 0.08, 0.12);
    expect(tail(0.2, 1) - tail(0.2, 0)).toBeLessThan(tail(1, 1) - tail(1, 0));
  });

  it('acoustic: Room adds a short tail that is different in each ear, and none at 0', () => {
    const dry = play('acoustic', [[0.005, 'rim', 0.9]], 1, { variation: 0, room: 0 });
    const wet = play('acoustic', [[0.005, 'rim', 0.9]], 1, { variation: 0, room: 1 });
    expect(levelDb(wet.mono, 0.15, 0.3)).toBeGreaterThan(levelDb(dry.mono, 0.15, 0.3) + 20);
    expect(levelDb(wet.mono, 0.15, 0.3)).toBeLessThan(levelDb(wet.mono, 0, 0.05) - 15);
    let difference = 0;
    for (let i = Math.round(0.15 * SAMPLE_RATE); i < 0.3 * SAMPLE_RATE; i++) difference = Math.max(difference, Math.abs(wet.left[i] - wet.right[i]));
    expect(difference).toBeGreaterThan(1e-4);
    // and the room is gone within a second and a half
    expect(levelDb(wet.mono, 0.9, 1)).toBeLessThan(-80);
  });
});

describe('brushes', () => {
  it('a sweep swells and dies over its length, with no sharp start', () => {
    const { mono } = play('brushes', [[0.01, 'brushSweep', 0.8, 0.4]], 0.8, PLAIN);
    const middle = levelDb(mono, 0.05, 0.15);
    expect(levelDb(mono, 0.01, 0.014)).toBeLessThan(middle - 10);
    expect(levelDb(mono, 0.5, 0.6)).toBeLessThan(middle - 25);
    // a hiss: its weight is between 1 and 8 kHz
    expect(bandLevelDb(mono, SAMPLE_RATE, 1000, 8000, 0.05, 0.3)).toBeGreaterThan(levelDb(mono, 0.05, 0.3) - 2);
  });

  it('a tap lands softly: quieter than a stick, with no click at its start', () => {
    const stick = play('acoustic', [[0.005, 'snare', 0.8]], 0.3, PLAIN).mono;
    const brush = play('brushes', [[0.005, 'brushTap', 0.8]], 0.3, PLAIN).mono;
    expect(levelDb(brush, 0, 0.1)).toBeLessThan(levelDb(stick, 0, 0.1) - 3);
    // the stick's first millisecond is its loudest; the brush is still arriving, and peaks a few later
    const loudestMs = (samples: Float32Array) => {
      let best = 0;
      for (let ms = 1; ms < 15; ms++) {
        if (levelDb(samples, 0.005 + ms / 1000, 0.006 + ms / 1000) > levelDb(samples, 0.005 + best / 1000, 0.006 + best / 1000)) best = ms;
      }
      return best;
    };
    expect(loudestMs(stick)).toBe(0);
    expect(loudestMs(brush)).toBeGreaterThanOrEqual(2);
  });
});

describe('playing', () => {
  const busy = (kit: DrumKitId) => groovePart('pop16', { bars: 2, steps: 2, startBar: 2, brushes: kit === 'brushes' });

  it.each(DRUM_KIT_IDS)('%s: sounds the same however the caller slices its blocks', (kit) => {
    const part = busy(kit);
    const whole = renderDrumPart(part, { bpm: 110, sampleRate: SAMPLE_RATE, kit, tailSeconds: 0.5 });
    for (const block of [1, 37, 64, 480, whole.left.length]) {
      const framesPerBeat = (60 / 110) * SAMPLE_RATE;
      const synth = new DrumSynth(SAMPLE_RATE, kit);
      for (const hit of part.hits) {
        const frame = hit.beat * framesPerBeat + (hit.offsetMs / 1000) * SAMPLE_RATE;
        synth.hit(Math.max(0, frame), hit.piece, hit.velocity, (hit.beats ?? 0) * framesPerBeat);
      }
      const left = new Float32Array(whole.left.length);
      const right = new Float32Array(whole.left.length);
      if (block === 1) {
        // one sample at a time for the first half second is enough to prove the point cheaply
        const half = SAMPLE_RATE / 2;
        renderInBlocks(synth, left.subarray(0, half), right.subarray(0, half), 1);
        renderInBlocks(synth, left.subarray(half), right.subarray(half), 128, half);
      } else renderInBlocks(synth, left, right, block);
      expect(firstDifference(left, whole.left), `${kit}, blocks of ${block}`).toBe(-1);
      expect(firstDifference(right, whole.right), `${kit}, blocks of ${block}`).toBe(-1);
    }
  });

  it('repeats exactly for the same seed, and never plays the same stroke twice', () => {
    for (const kit of DRUM_KIT_IDS) {
      const options = { bpm: 110, sampleRate: SAMPLE_RATE, kit };
      const seeded = renderDrumPart(busy(kit), { ...options, seed: 5 });
      expect(firstDifference(seeded.left, renderDrumPart(busy(kit), { ...options, seed: 5 }).left)).toBe(-1);
      expect(firstDifference(seeded.left, renderDrumPart(busy(kit), { ...options, seed: 6 }).left)).toBeGreaterThanOrEqual(0);
    }
    // two strokes a second apart: different with Variation up
    const twice = (kit: DrumKitId, piece: DrumPiece, variation: number) => {
      const { mono } = play(kit, [[0, piece, 0.8], [1, piece, 0.8]], 1.2, { room: 0, variation });
      let difference = 0;
      for (let i = 0; i < 0.2 * SAMPLE_RATE; i++) difference = Math.max(difference, Math.abs(mono[i] - mono[i + SAMPLE_RATE]));
      return difference;
    };
    for (const piece of ['kick', 'snare', 'hatClosed', 'tomMid'] as const) {
      expect(twice('acoustic', piece, 0.8), piece).toBeGreaterThan(1e-3);
    }
    // with Variation at 0 the drums' modes are struck identically (their noise still differs, as noise does)
    expect(twice('acoustic', 'tomMid', 0)).toBeLessThan(twice('acoustic', 'tomMid', 0.8));
  });

  it('strokes add to a drum that is still ringing: a roll is louder than its strokes', () => {
    const single = play('acoustic', [[0.2, 'tomLow', 0.6]], 0.6, PLAIN).mono;
    const strokes: Stroke[] = [0, 0.05, 0.1, 0.15, 0.2].map((at) => [at, 'tomLow', 0.6] as Stroke);
    const roll = play('acoustic', strokes, 0.6, PLAIN).mono;
    expect(levelDb(roll, 0.2, 0.4)).toBeGreaterThan(levelDb(single, 0.2, 0.4) + 1);
  });

  it('stop silences everything within a few hundredths of a second, without a click, and forgets what was to come', () => {
    for (const kit of DRUM_KIT_IDS) {
      const synth = new DrumSynth(SAMPLE_RATE, kit);
      synth.hit(0, 'crash', 1);
      synth.hit(0, 'kick', 1);
      synth.hit(0.5 * SAMPLE_RATE, 'snare', 1); // never played
      const left = new Float32Array(SAMPLE_RATE / 4);
      const right = new Float32Array(left.length);
      renderInBlocks(synth, left, right, 128);
      const last = Math.abs(left[left.length - 1]);
      synth.stop();
      const after = new Float32Array(SAMPLE_RATE);
      const afterRight = new Float32Array(after.length);
      renderInBlocks(synth, after, afterRight, 128, left.length);
      // no jump at the join, silence 40 ms later, and for the rest of the second
      expect(Math.abs(Math.abs(after[0]) - last)).toBeLessThan(0.05);
      expect(after.subarray(Math.round(0.04 * SAMPLE_RATE)).every((value) => value === 0)).toBe(true);
      expect(synth.silent).toBe(true);
    }
  });

  it('a change of kit fades the old one out and plays what follows on the new one', () => {
    const synth = new DrumSynth(SAMPLE_RATE, 'acoustic');
    synth.hit(0, 'crash', 1);
    synth.hit(0.5 * SAMPLE_RATE, 'hatClosed', 0.9);
    const left = new Float32Array(SAMPLE_RATE);
    const right = new Float32Array(SAMPLE_RATE);
    renderInBlocks(synth, left.subarray(0, 4800), right.subarray(0, 4800), 128);
    synth.setKit('machine');
    renderInBlocks(synth, left.subarray(4800), right.subarray(4800), 128, 4800);
    expect(synth.getKit()).toBe('machine');
    expect(synth.getParams()).toEqual(DEFAULT_DRUM_PARAMS.machine);
    // the crash has gone 50 ms after the change...
    expect(levelDb(left, 0.16, 0.45)).toBe(-Infinity);
    // ...and the hi-hat that was already scheduled is the machine's: nothing below 1 kHz
    expect(levelDb(left, 0.5, 0.55)).toBeGreaterThan(-60);
    expect(bandLevelDb(left, SAMPLE_RATE, 20, 800, 0.5, 0.55)).toBeLessThan(levelDb(left, 0.5, 0.55) - 30);
    // the same kit again only changes its controls
    synth.setKit('machine', { kickHz: 70 });
    expect(synth.getParams().kickHz).toBe(70);
  });

  it('ignores strokes that are not strokes, and keeps controls in range', () => {
    const synth = new DrumSynth(SAMPLE_RATE);
    expect(synth.hit(Number.NaN, 'kick', 0.8)).toBe(false);
    expect(synth.hit(0, 'kick', Number.NaN)).toBe(false);
    expect(synth.hit(0, 'kick', 0)).toBe(false);
    expect(synth.hit(0, 'cowbell' as DrumPiece, 0.8)).toBe(false);
    expect(synth.silent).toBe(true);
    expect(synth.hit(0, 'kick', 5)).toBe(true); // a velocity over 1 is 1
    synth.setParams({ kickHz: 1e6, room: -3, drive: Number.NaN, variation: 0.4 });
    const params = synth.getParams();
    expect(params.kickHz).toBe(90);
    expect(params.room).toBe(0);
    expect(params.drive).toBe(DEFAULT_DRUM_PARAMS.acoustic.drive);
    expect(params.variation).toBe(0.4);
    expect(new DrumSynth(SAMPLE_RATE, 'nonsense' as DrumKitId).getKit()).toBe('acoustic');
  });

  it('fills in and clamps parameters from anything', () => {
    const base = DEFAULT_DRUM_PARAMS.acoustic;
    expect(sanitizeDrumParams(null, base)).toEqual(base);
    expect(sanitizeDrumParams('loud', base)).toEqual(base);
    expect(sanitizeDrumParams({ snareHz: 5, hatTone: 'bright' }, base)).toEqual({ ...base, snareHz: 130 });
    for (const kit of DRUM_KIT_IDS) {
      for (const spec of DRUM_PARAM_SPECS) {
        expect(DEFAULT_DRUM_PARAMS[kit][spec.key]).toBeGreaterThanOrEqual(spec.min);
        expect(DEFAULT_DRUM_PARAMS[kit][spec.key]).toBeLessThanOrEqual(spec.max);
      }
    }
  });
});

describe('robustness', () => {
  const allMin = Object.fromEntries(DRUM_PARAM_SPECS.map((spec) => [spec.key, spec.min])) as unknown as DrumParams;
  const allMax = Object.fromEntries(DRUM_PARAM_SPECS.map((spec) => [spec.key, spec.max])) as unknown as DrumParams;

  it.each([44100, 48000, 96000])('makes no invalid or denormal numbers under stress at %i Hz', (sampleRate) => {
    const random = new Random(sampleRate);
    for (const kit of DRUM_KIT_IDS) {
      for (const params of [DEFAULT_DRUM_PARAMS[kit], allMin, allMax]) {
        const synth = new DrumSynth(sampleRate, kit, params, 3);
        const seconds = 3;
        let at = 0;
        while (at < seconds * sampleRate) {
          const velocity = [0, 1e-9, 1e-3, 1][Math.floor(random.next() * 12)] ?? random.next();
          const piece = DRUM_PIECES[Math.floor(random.next() * DRUM_PIECES.length)];
          synth.hit(at, piece, velocity, random.next() * 0.6 * sampleRate);
          at += Math.floor(random.next() * random.next() * 0.3 * sampleRate);
        }
        // Three seconds of strokes, then silence until the longest cymbal has died, checked second by second.
        const left = new Float32Array(sampleRate);
        const right = new Float32Array(sampleRate);
        for (let second = 0; second < seconds + 26; second++) {
          renderInBlocks(synth, left, right, 128, second * sampleRate);
          expect(left.every((value) => sound(value, 1e-30)) && right.every((value) => sound(value, 1e-30))).toBe(true);
          let stateOk = true;
          synth.forEachState((value) => {
            if (!sound(value, 1e-200)) stateOk = false;
          });
          expect(stateOk).toBe(true);
          // every stroke lands on one of the kit's own voices: there is no pile of voices to run out of
          expect(synth.activeVoices).toBeLessThanOrEqual(10);
        }
        // At rest: exact zeros everywhere, so nothing is left to decay.
        expect(synth.silent, `${kit} at ${sampleRate}`).toBe(true);
        expect(left.subarray(sampleRate / 2).every((value) => value === 0)).toBe(true);
        let allZero = true;
        synth.forEachState((value) => {
          if (value !== 0) allZero = false;
        });
        expect(allZero).toBe(true);
      }
    }
  });

  it('sounds the same at any sample rate: lengths and brightness hold from 44.1 to 96 kHz', { timeout: 30000 }, () => {
    const cases: [DrumKitId, DrumPiece][] = [
      ['acoustic', 'kick'],
      ['acoustic', 'snare'],
      ['acoustic', 'hatClosed'],
      ['acoustic', 'crash'],
      ['machine', 'kick'],
      ['machine', 'snare'],
      ['machine', 'hatOpen'],
    ];
    for (const [kit, piece] of cases) {
      const measure = (sampleRate: number) => {
        const { mono } = play(kit, [[0.005, piece, 0.9]], 1.5, PLAIN, { sampleRate });
        return {
          // what can be heard: at 96 kHz there is another octave above it
          level: bandLevelDb(mono, sampleRate, 20, 18000, 0, 0.3),
          fall: fallTime(mono, sampleRate, 30, 0.01).seconds,
          centroid: spectralCentroid(mono, sampleRate, 0, 0.2, 16000),
        };
      };
      const reference = measure(48000);
      for (const sampleRate of [44100, 96000]) {
        const other = measure(sampleRate);
        expect(Math.abs(other.level - reference.level), `${kit} ${piece} level at ${sampleRate}`).toBeLessThan(1.5);
        expect(other.fall / reference.fall, `${kit} ${piece} length at ${sampleRate}`).toBeGreaterThan(0.75);
        expect(other.fall / reference.fall, `${kit} ${piece} length at ${sampleRate}`).toBeLessThan(1.3);
        expect(other.centroid / reference.centroid, `${kit} ${piece} brightness at ${sampleRate}`).toBeGreaterThan(0.85);
        expect(other.centroid / reference.centroid, `${kit} ${piece} brightness at ${sampleRate}`).toBeLessThan(1.18);
      }
    }
  });
});

describe('levels', () => {
  it('the three kits are equally loud on the reference part, by K-weighted loudness', () => {
    const levels = DRUM_KIT_IDS.map((kit) => measureKit(kit, undefined, SAMPLE_RATE));
    for (const level of levels) expect(Math.abs(level.loudness - levels[0].loudness)).toBeLessThan(0.5);
    expect(REFERENCE_BPM).toBe(100);
    // the reference has the crash at its top and a fill at its end
    const part = referencePart('acoustic');
    expect(part.beats).toBe(16);
    expect(part.hits.some((hit) => hit.piece === 'crash' && hit.beat === 0)).toBe(true);
    expect(part.hits.some((hit) => hit.beat >= 14 && hit.piece.startsWith('tom'))).toBe(true);
    expect(part.hits.every((hit) => hit.offsetMs === 0)).toBe(true);
    expect(referencePart('brushes').hits.some((hit) => hit.piece === 'brushSweep')).toBe(true);
  });

  it('the bus holds the peaks: every piece at full strength at once stays under full scale, at any Drive', () => {
    for (const kit of DRUM_KIT_IDS) {
      for (const drive of [0, 0.5, 1]) {
        const strokes: Stroke[] = STRUCK.map((piece) => [0.01, piece, 1] as Stroke);
        const { left, right } = play(kit, strokes, 0.5, { drive });
        const levels = stereoLevels({ left, right }, SAMPLE_RATE);
        expect(levels.peakDb, `${kit} at Drive ${drive}`).toBeLessThan(0);
      }
    }
  });

  it('Drive trades peak for body: the same loudness needs less peak', () => {
    const crest = (drive: number) => {
      const sound = renderDrumPart(referencePart('acoustic'), { bpm: REFERENCE_BPM, sampleRate: SAMPLE_RATE, kit: 'acoustic', params: { drive } });
      const levels = stereoLevels(sound, SAMPLE_RATE);
      return levels.peakDb - levels.loudness;
    };
    expect(crest(1)).toBeLessThan(crest(0) - 1.5);
  });
});

describe('cost', () => {
  it('renders ten seconds of the busiest groove many times faster than real time, on every kit', () => {
    for (const kit of DRUM_KIT_IDS) {
      // sixteenths at 125 BPM, with a crash and a fill, is the most the jam asks of a kit
      const part = groovePart('pop16', { bars: 5, steps: 4, startBar: 4, brushes: kit === 'brushes' });
      const options = { bpm: 125, sampleRate: SAMPLE_RATE, kit };
      renderDrumPart(part, options); // warm up the compiler
      const start = performance.now();
      const out = renderDrumPart(part, { ...options, tailSeconds: 0.4 });
      const elapsed = performance.now() - start;
      expect(out.left.length).toBe(10 * SAMPLE_RATE);
      // Ten seconds of sound in well under one second of one core; in practice about a tenth of that.
      expect(elapsed, kit).toBeLessThan(1000);
    }
  });

  it('costs nothing at rest', () => {
    const synth = new DrumSynth(SAMPLE_RATE);
    const left = new Float32Array(SAMPLE_RATE * 10);
    const right = new Float32Array(left.length);
    const start = performance.now();
    renderInBlocks(synth, left, right, 128);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('every groove can be rendered on every kit', () => {
    for (const kit of DRUM_KIT_IDS) {
      for (const groove of DRUM_GROOVES) {
        const part = groovePart(groove.id, { bars: 2, steps: 2, startBar: 2, brushes: kit === 'brushes' });
        const levels = stereoLevels(renderDrumPart(part, { bpm: 100, sampleRate: SAMPLE_RATE, kit }), SAMPLE_RATE);
        expect(levels.loudness, `${kit} ${groove.id}`).toBeGreaterThan(-45);
        expect(levels.peakDb, `${kit} ${groove.id}`).toBeLessThan(0);
      }
    }
  });
});
