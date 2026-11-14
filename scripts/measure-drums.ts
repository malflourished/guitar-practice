/**
 * Measure the drum kits off-line: every piece of every kit, the room and the
 * whole groove, as numbers that can be held against what real drums do.
 * The findings are written up in docs/sound/drums.md ("Why the first kits
 * fell short").
 *
 *   ./node_modules/.bin/vite-node scripts/measure-drums.ts [kit ...]
 *
 * With no kit named it measures them all.
 */
import { powerSpectrum } from '../src/lib/audio/synth/dsp/fft';
import { toDb } from '../src/lib/audio/synth/dsp/loudness';
import { SmallRoom } from '../src/lib/audio/synth/dsp/room';
import { DRUM_KIT_IDS, type DrumKitId, type DrumParams, type DrumPiece } from '../src/lib/audio/synth/drums/drumParams';
import { groovePart, referencePart, renderDrumPart, stereoLevels, REFERENCE_BPM } from '../src/lib/audio/synth/drums/drumPattern';
import { DrumSynth } from '../src/lib/audio/synth/drums/drumSynth';
import type { DrumGroove } from '../src/lib/audio/drumGrooves';
import { Random } from '../src/lib/audio/synth/dsp/random';
import { DEFAULT_DRUM_PARAMS } from '../src/lib/audio/synth/drums/drumParams';
import { createKit } from '../src/lib/audio/synth/drums/kits';
import { buildMetalTables } from '../src/lib/audio/synth/drums/metalTable';
import type { StereoDrumVoice } from '../src/lib/audio/synth/drums/bandedMetal';

const SR = 48000;
const BANDS = [20, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000, 24000];

interface Sound {
  left: Float32Array;
  right: Float32Array;
  mono: Float64Array;
}

function renderHits(kit: DrumKitId, hits: { at: number; piece: DrumPiece; velocity: number; seconds?: number }[], seconds: number, params: Partial<DrumParams> = {}, seed = 1): Sound {
  const synth = new DrumSynth(SR, kit, params, seed);
  for (const hit of hits) synth.hit(Math.round(hit.at * SR), hit.piece, hit.velocity, (hit.seconds ?? 0) * SR);
  const length = Math.round(seconds * SR);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let frame = 0; frame < length; frame += 128) synth.render(left, right, frame, frame, Math.min(length, frame + 128));
  const mono = new Float64Array(length);
  for (let i = 0; i < length; i++) mono[i] = 0.5 * (left[i] + right[i]);
  return { left, right, mono };
}

/** RMS level in 2 ms steps. */
function envelope(x: ArrayLike<number>): Float64Array {
  const hop = Math.round(0.002 * SR);
  const out = new Float64Array(Math.floor(x.length / hop));
  for (let k = 0; k < out.length; k++) {
    let sum = 0;
    for (let i = k * hop; i < (k + 1) * hop; i++) sum += x[i] * x[i];
    out[k] = Math.sqrt(sum / hop);
  }
  return out;
}

/** Milliseconds from the loudest moment until the level stays `db` below it. */
function fall(env: Float64Array, db: number): number {
  let top = 0;
  let at = 0;
  for (let k = 0; k < env.length; k++) {
    if (env[k] > top) {
      top = env[k];
      at = k;
    }
  }
  const mark = top * 10 ** (-db / 20);
  let last = at;
  for (let k = at; k < env.length; k++) if (env[k] > mark) last = k;
  return (last - at) * 2;
}

function bandShares(x: ArrayLike<number>, from: number, to: number): number[] {
  const power = powerSpectrum(x, from, to, false);
  const hzPerBin = SR / (power.length * 2);
  const sums = new Array(BANDS.length - 1).fill(0);
  let total = 0;
  for (let k = 1; k < power.length; k++) {
    const hz = k * hzPerBin;
    for (let b = 0; b < sums.length; b++) if (hz >= BANDS[b] && hz < BANDS[b + 1]) sums[b] += power[k];
    if (hz >= 20) total += power[k];
  }
  return sums.map((sum) => Math.round(10 * Math.log10(sum / total + 1e-12)));
}

function centroid(x: ArrayLike<number>, fromSeconds: number, toSeconds: number): number {
  const power = powerSpectrum(x, Math.round(fromSeconds * SR), Math.round(toSeconds * SR));
  const hzPerBin = SR / (power.length * 2);
  let weighted = 0;
  let total = 0;
  for (let k = 1; k < power.length; k++) {
    weighted += k * hzPerBin * power[k];
    total += power[k];
  }
  return total > 0 ? Math.round(weighted / total) : 0;
}

/**
 * How much a sustained sound is a few tones and how much a dense crowd, in a
 * band: the share of the band's bins that holds half its power. Noise scores
 * 19%; thirty clean partials score a percent or two.
 */
function density(x: ArrayLike<number>, fromSeconds: number, toSeconds: number, lowHz: number, highHz: number): { half: number; flatDb: number } {
  const power = powerSpectrum(x, Math.round(fromSeconds * SR), Math.round(toSeconds * SR));
  const hzPerBin = SR / (power.length * 2);
  const bins: number[] = [];
  for (let k = Math.ceil(lowHz / hzPerBin); k < highHz / hzPerBin; k++) bins.push(power[k]);
  const total = bins.reduce((a, b) => a + b, 0);
  const sorted = [...bins].sort((a, b) => b - a);
  let running = 0;
  let count = 0;
  while (running < total / 2 && count < sorted.length) running += sorted[count++];
  const logMean = bins.reduce((a, b) => a + Math.log(b + 1e-30), 0) / bins.length;
  return { half: Math.round((1000 * count) / bins.length) / 10, flatDb: Math.round(10 * (logMean / Math.LN10 - Math.log10(total / bins.length)) * 10) / 10 };
}

/** The pitch of a low drum from the gaps between its upward zero crossings, after a low-pass. */
function pitchTrack(x: ArrayLike<number>, lowpassHz: number, atMs: number[]): number[] {
  const a = Math.exp((-2 * Math.PI * lowpassHz) / SR);
  let s1 = 0;
  let s2 = 0;
  const crossings: number[] = [];
  let previous = 0;
  for (let i = 0; i < x.length; i++) {
    s1 = x[i] + a * (s1 - x[i]);
    s2 = s1 + a * (s2 - s1);
    if (previous <= 0 && s2 > 0 && i > 0) crossings.push(i - 1 + -previous / (s2 - previous));
    previous = s2;
  }
  return atMs.map((ms) => {
    const at = (ms / 1000) * SR;
    for (let k = 1; k < crossings.length; k++) if (crossings[k] >= at) return Math.round(SR / (crossings[k] - crossings[k - 1]));
    return 0;
  });
}

function correlation(a: ArrayLike<number>, b: ArrayLike<number>, from: number, to: number): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = from; i < to; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
}

function peakDb(x: ArrayLike<number>): number {
  let top = 0;
  for (let i = 0; i < x.length; i++) top = Math.max(top, Math.abs(x[i]));
  return Math.round(toDb(top) * 10) / 10;
}

function rmsDb(x: ArrayLike<number>, from = 0, to = x.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i] * x[i];
  return Math.round(toDb(Math.sqrt(sum / Math.max(1, to - from))) * 10) / 10;
}

const pad = (value: unknown, width: number) => String(value).padStart(width);

const PIECES: { piece: DrumPiece; seconds: number; sweep?: number }[] = [
  { piece: 'kick', seconds: 1.2 },
  { piece: 'snare', seconds: 1.2 },
  { piece: 'rim', seconds: 0.8 },
  { piece: 'tomLow', seconds: 1.5 },
  { piece: 'hatClosed', seconds: 0.8 },
  { piece: 'hatOpen', seconds: 2.5 },
  { piece: 'hatFoot', seconds: 0.8 },
  { piece: 'ride', seconds: 4 },
  { piece: 'crash', seconds: 5 },
];

function measurePieces(kit: DrumKitId): void {
  console.log(`\n== ${kit}: one stroke at full strength, default dials (with the kit's room and bus) ==`);
  console.log(`piece       peak   to-20 to-40 to-60ms  cen0-30 cen100-300 | share of energy, dB: ${BANDS.slice(0, -1).map((hz) => pad(hz, 5)).join('')}`);
  for (const { piece, seconds } of PIECES) {
    const sound = renderHits(kit, [{ at: 0.01, piece, velocity: 1 }], seconds);
    const env = envelope(sound.mono);
    const shares = bandShares(sound.mono, 0, sound.mono.length);
    console.log(
      `${piece.padEnd(10)} ${pad(peakDb(sound.mono), 6)} ${pad(fall(env, 20), 6)} ${pad(fall(env, 40), 5)} ${pad(fall(env, 60), 5)}   ${pad(centroid(sound.mono, 0.01, 0.04), 6)} ${pad(centroid(sound.mono, 0.11, 0.31), 8)}   |                     ${shares.map((s) => pad(s, 5)).join('')}`,
    );
  }

  // The kick: where its pitch is as it dies, and how much click it has.
  const kick = renderHits(kit, [{ at: 0.01, piece: 'kick', velocity: 1 }], 1, { room: 0 });
  console.log(`kick pitch at 12/25/50/100/200 ms: ${pitchTrack(kick.mono, 300, [12, 25, 50, 100, 200]).join(' ')} Hz`);
  const kickShares = bandShares(kick.mono, Math.round(0.01 * SR), Math.round(0.03 * SR));
  console.log(`kick first 20 ms band shares: ${kickShares.join(' ')}`);

  // The snare: head against wires.
  const snare = renderHits(kit, [{ at: 0.01, piece: 'snare', velocity: 1 }], 1, { room: 0 });
  const snarePower = powerSpectrum(snare.mono, 0, snare.mono.length, false);
  const hzPerBin = SR / (snarePower.length * 2);
  let low = 0;
  let mid = 0;
  let high = 0;
  for (let k = 1; k < snarePower.length; k++) {
    const hz = k * hzPerBin;
    if (hz < 600) low += snarePower[k];
    else if (hz < 2000) mid += snarePower[k];
    else high += snarePower[k];
  }
  console.log(`snare (dry) energy under 600 Hz / 600-2k / over 2k: ${[low, mid, high].map((v) => Math.round(10 * Math.log10(v / (low + mid + high)))).join(' / ')} dB; wires 2-10 kHz density ${JSON.stringify(density(snare.mono, 0.03, 0.15, 2000, 10000))}`);

  // Metal: a few bells or a dense crowd?
  for (const [piece, from, to] of [['hatOpen', 0.06, 0.4], ['ride', 0.1, 0.8], ['crash', 0.1, 0.8]] as const) {
    const sound = renderHits(kit, [{ at: 0.01, piece, velocity: 1 }], 1.2, { room: 0 });
    console.log(`${piece} density 1-4 kHz ${JSON.stringify(density(sound.mono, from, to, 1000, 4000))}  4-12 kHz ${JSON.stringify(density(sound.mono, from, to, 4000, 12000))}`);
  }

  // Velocity: level and brightness.
  console.log('velocity 0.2 / 0.4 / 0.6 / 0.8 / 1.0: peak dB and centroid Hz');
  for (const piece of ['kick', 'snare', 'hatClosed', 'ride'] as const) {
    const cells = [0.2, 0.4, 0.6, 0.8, 1].map((velocity) => {
      const sound = renderHits(kit, [{ at: 0.01, piece, velocity }], 0.6, { room: 0, variation: 0 });
      return `${peakDb(sound.mono)}/${centroid(sound.mono, 0.01, 0.2)}`;
    });
    console.log(`  ${piece.padEnd(10)} ${cells.join('   ')}`);
  }

  // Round robin: eight strokes at the same velocity, each rendered alone.
  console.log('eight strokes alike (default Variation): level spread dB (max-min), centroid spread %, waveform correlation of first 40 ms (mean of pairs)');
  for (const piece of ['kick', 'snare', 'hatClosed', 'ride'] as const) {
    const takes = Array.from({ length: 8 }, (_, take) => renderHits(kit, [{ at: 0.01, piece, velocity: 0.8 }], 0.4, { room: 0 }, 11 + take * 7));
    const levels = takes.map((take) => rmsDb(take.mono));
    const cents = takes.map((take) => centroid(take.mono, 0.01, 0.2));
    let sum = 0;
    let pairs = 0;
    for (let a = 0; a < takes.length; a++) {
      for (let b = a + 1; b < takes.length; b++) {
        sum += correlation(takes[a].mono, takes[b].mono, Math.round(0.01 * SR), Math.round(0.05 * SR));
        pairs++;
      }
    }
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    console.log(`  ${piece.padEnd(10)} ${spread(levels).toFixed(1)} dB   ${((100 * spread(cents)) / (cents.reduce((a, b) => a + b, 0) / cents.length)).toFixed(0)}%   ${(sum / pairs).toFixed(3)}`);
  }

  // The crash over time: where its weight is, and how loud.
  const crash = renderHits(kit, [{ at: 0.01, piece: 'crash', velocity: 1 }], 2.6, { room: 0 });
  const spans: [number, number][] = [[0.01, 0.03], [0.03, 0.07], [0.07, 0.16], [0.16, 0.41], [0.41, 1.01], [1.01, 2.01]];
  console.log(`crash over time (centroid Hz / level dB): ${spans.map(([from, to]) => `${Math.round((from - 0.01) * 1000)}ms ${centroid(crash.mono, from, to)}/${rmsDb(crash.mono, Math.round(from * SR), Math.round(to * SR))}`).join('  ')}`);
  const softCrash = renderHits(kit, [{ at: 0.01, piece: 'crash', velocity: 0.4 }], 0.5, { room: 0 });
  console.log(`crash at velocity 0.4 against 1.0, centroid 60-400 ms: ${centroid(softCrash.mono, 0.07, 0.41)} against ${centroid(crash.mono, 0.07, 0.41)} Hz`);

  // Dry lengths: the drum itself, with the room off.
  for (const piece of ['kick', 'snare', 'hatClosed'] as const) {
    const dry = renderHits(kit, [{ at: 0.01, piece, velocity: 1 }], 1.2, { room: 0 });
    const env = envelope(dry.mono);
    console.log(`${piece} with Room at 0: to -20/-40/-60 dB in ${fall(env, 20)}/${fall(env, 40)}/${fall(env, 60)} ms, peak ${peakDb(dry.mono)}`);
  }
  const ghost = renderHits(kit, [{ at: 0.01, piece: 'snare', velocity: 0.25 }], 0.6, { room: 0 });
  const back = renderHits(kit, [{ at: 0.01, piece: 'snare', velocity: 0.95 }], 0.6, { room: 0 });
  console.log(`ghost note (0.25) against backbeat (0.95): ${(rmsDb(ghost.mono, 0, 14400) - rmsDb(back.mono, 0, 14400)).toFixed(1)} dB RMS, ${(peakDb(ghost.mono) - peakDb(back.mono)).toFixed(1)} dB peak`);

  // The hi-hat choke: how fast an open hat dies when the foot closes it.
  const choke = renderHits(kit, [{ at: 0.01, piece: 'hatOpen', velocity: 0.9 }, { at: 0.26, piece: 'hatFoot', velocity: 0.7 }], 1, { room: 0 });
  console.log(`open hat, foot at 250 ms: level 50 ms before the foot ${rmsDb(choke.mono, Math.round(0.2 * SR), Math.round(0.25 * SR))} dB, 60-110 ms after ${rmsDb(choke.mono, Math.round(0.32 * SR), Math.round(0.37 * SR))} dB`);
}

/** Each voice of a kit on its own, at its level in the mix, before the clipper, the room and the bus. */
function measureStrips(kit: DrumKitId): void {
  console.log(`-- ${kit}: each voice before the bus, at its mix level (peak / rms over 300 ms), velocity 1.0 then 0.5`);
  const pieces: DrumPiece[] = ['kick', 'snare', 'rim', 'tomLow', 'hatClosed', 'hatOpen', 'ride', 'crash'];
  const cells: string[] = [];
  for (const piece of pieces) {
    const cell: string[] = [];
    for (const velocity of [1, 0.5]) {
      const drums = createKit(kit, SR, { ...DEFAULT_DRUM_PARAMS[kit], variation: 0 }, new Random(1));
      drums.hit(piece, velocity, 0.3);
      const total = new Float64Array(Math.round(0.3 * SR));
      const left = new Float64Array(128);
      const right = new Float64Array(128);
      for (let at = 0; at < total.length; at += 128) {
        const count = Math.min(128, total.length - at);
        drums.prepare(count);
        for (const strip of drums.strips) {
          if (!strip.voice.active) continue;
          left.fill(0);
          right.fill(0);
          const stereo = (strip.voice as Partial<StereoDrumVoice>).renderStereo;
          if (stereo) stereo.call(strip.voice, left, right, count);
          else {
            strip.voice.render(left, count);
            right.set(left);
          }
          for (let i = 0; i < count; i++) total[at + i] += 0.5 * (left[i] * strip.left + right[i] * strip.right);
        }
        drums.settle();
      }
      cell.push(`${peakDb(total)}/${rmsDb(total)}`);
    }
    cells.push(`${piece} ${cell.join(' ')}`);
  }
  console.log(cells.join('   '));
}

/** What the density measure reads for a plate with a mode every `spacing` hertz, all ringing evenly: the mark to aim at. */
function measurePlate(spacing: number): void {
  const tables = buildMetalTables({ name: 'plate', seed: 5, edges: [300, 1000, 4000, 12000, 16000], spacingHz: spacing, seconds: 2.6 }, SR);
  const sum = new Float64Array(SR);
  for (const band of tables.bands) for (let i = 0; i < sum.length; i++) sum[i] += band[i];
  console.log(`a plate with a mode every ${spacing} Hz: density 1-4 kHz ${JSON.stringify(density(sum, 0.1, 0.8, 1000, 4000))}  4-12 kHz ${JSON.stringify(density(sum, 0.1, 0.8, 4000, 12000))}`);
}

function measureGrooves(kit: DrumKitId): void {
  console.log(`\n== ${kit}: the grooves, default dials ==`);
  console.log('part        peak    rms   LKFS  crest(peak-rms)  peak-to-loudness  L/R correlation');
  const parts: [string, ReturnType<typeof referencePart>][] = [['reference', referencePart(kit)]];
  for (const groove of ['rock8', 'shuffle', 'swing', 'pop16'] as DrumGroove[]) {
    parts.push([groove, groovePart(groove, { bars: 4, steps: 4, startBar: 4, humanize: 0.5, brushes: kit === 'brushes' })]);
  }
  for (const [name, part] of parts) {
    const sound = renderDrumPart(part, { bpm: REFERENCE_BPM, sampleRate: SR, kit });
    const levels = stereoLevels(sound, SR);
    console.log(
      `${name.padEnd(10)} ${pad(levels.peakDb.toFixed(1), 6)} ${pad(levels.rmsDb.toFixed(1), 6)} ${pad(levels.loudness.toFixed(1), 6)} ${pad((levels.peakDb - levels.rmsDb).toFixed(1), 8)} ${pad((levels.peakDb - levels.loudness).toFixed(1), 16)} ${pad(correlation(sound.left, sound.right, 0, sound.left.length).toFixed(2), 14)}`,
    );
  }
  // How hard the compressor works on the reference part.
  {
    const part = referencePart(kit);
    const synth = new DrumSynth(SR, kit);
    const framesPerBeat = (60 / REFERENCE_BPM) * SR;
    for (const hit of part.hits) synth.hit(hit.beat * framesPerBeat, hit.piece, hit.velocity, (hit.beats ?? 0) * framesPerBeat);
    const block = new Float32Array(128);
    const other = new Float32Array(128);
    const deepest: number[] = [];
    for (let frame = 0; frame < part.beats * framesPerBeat; frame += 128) {
      synth.render(block, other, frame);
      if (frame % (128 * 94) === 0) deepest.push(synth.takeGlueReduction());
    }
    deepest.sort((a, b) => b - a);
    console.log(`compressor: most ${deepest[0].toFixed(1)} dB, middle quarter-second ${deepest[Math.floor(deepest.length / 2)].toFixed(1)} dB`);
  }
  // Cost: eight bars of the busiest groove.
  for (const groove of ['pop16', 'swing'] as DrumGroove[]) {
    const part = groovePart(groove, { bars: 8, steps: 8, startBar: 8, humanize: 0.5, brushes: kit === 'brushes' });
    let best = Infinity;
    let samples = 0;
    for (let run = 0; run < 5; run++) {
      const started = performance.now();
      samples = renderDrumPart(part, { bpm: 110, sampleRate: SR, kit }).left.length;
      best = Math.min(best, performance.now() - started);
    }
    console.log(`cost, ${groove}: ${((best * 1e6) / samples).toFixed(0)} ns a sample, ${((100 * best) / 1000 / (samples / SR)).toFixed(2)}% of one core`);
  }
}

/** The room on its own: an impulse in, and how soon its echoes are as dense as noise. */
function measureRoom(seconds: number): void {
  const room = new SmallRoom(SR, seconds);
  const length = SR;
  const input = new Float64Array(128);
  const left = new Float64Array(length);
  const right = new Float64Array(length);
  for (let frame = 0; frame < length; frame += 128) {
    input.fill(0);
    if (frame === 0) input[0] = 1;
    const l = new Float64Array(128);
    const r = new Float64Array(128);
    room.process(input, l, r, 128, 1);
    left.set(l.subarray(0, Math.min(128, length - frame)), frame);
    right.set(r.subarray(0, Math.min(128, length - frame)), frame);
  }
  // Echo density (Abel and Huang): the share of samples outside one standard deviation in a 20 ms window, against a bell curve's 31.7%.
  const window = Math.round(0.02 * SR);
  const report: string[] = [];
  for (const ms of [20, 40, 60, 100, 150, 250]) {
    const from = Math.round((ms / 1000) * SR) - window / 2;
    let sum = 0;
    for (let i = from; i < from + window; i++) sum += left[i] * left[i];
    const sd = Math.sqrt(sum / window);
    let outside = 0;
    for (let i = from; i < from + window; i++) if (Math.abs(left[i]) > sd) outside++;
    report.push(`${ms}ms ${(outside / window / 0.3173).toFixed(2)}`);
  }
  // Schroeder decay.
  let total = 0;
  for (let i = 0; i < length; i++) total += left[i] * left[i];
  let running = total;
  let t20 = 0;
  let t5 = 0;
  for (let i = 0; i < length; i++) {
    running -= left[i] * left[i];
    const db = 10 * Math.log10(running / total + 1e-20);
    if (!t5 && db < -5) t5 = i;
    if (!t20 && db < -25) t20 = i;
  }
  // How even the tail's spectrum is: a dense room is about 5.6 dB; more is ringing.
  const power = powerSpectrum(left, Math.round(0.05 * SR), Math.round(0.4 * SR));
  const hzPerBin = SR / (power.length * 2);
  const dbs: number[] = [];
  for (let k = Math.ceil(200 / hzPerBin); k < 4000 / hzPerBin; k++) dbs.push(10 * Math.log10(power[k] + 1e-30));
  const mean = dbs.reduce((a, b) => a + b, 0) / dbs.length;
  const sd = Math.sqrt(dbs.reduce((a, b) => a + (b - mean) ** 2, 0) / dbs.length);
  console.log(`\n== the room (${seconds} s) ==`);
  console.log(`echo density against noise (1 is fully dense): ${report.join(', ')}`);
  console.log(`decay time from the -5 to -25 dB slope: ${(((t20 - t5) / SR) * 3).toFixed(2)} s; tail spectrum roughness ${sd.toFixed(1)} dB (noise-like is about 5.6); L/R correlation ${correlation(left, right, 0, length).toFixed(2)}`);
}

const wanted = process.argv.slice(2).filter((name): name is DrumKitId => (DRUM_KIT_IDS as readonly string[]).includes(name));
const kits = wanted.length > 0 ? wanted : [...DRUM_KIT_IDS];
for (const kit of kits) {
  measurePieces(kit);
  measureStrips(kit);
  measureGrooves(kit);
}
if (wanted.length === 0) {
  measureRoom(0.42);
  measurePlate(12);
}
