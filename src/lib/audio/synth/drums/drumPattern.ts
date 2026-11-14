/**
 * Drum parts as plain data, and a way to render one through a kit without
 * any audio API: for the tests, for measuring loudness, and for the sound lab.
 */
import { BEATS_PER_BAR } from '../../jamGrid';
import { buildDrumBar, drumPhrase, type DrumGroove } from '../../drumGrooves';
import { kWeightingFilters, toDb } from '../dsp/loudness';
import type { DrumKitId, DrumParams, DrumPiece } from './drumParams';
import { DrumSynth } from './drumSynth';

/** One stroke of a part. */
export interface PatternHit {
  /** When it is played, in beats from the top of the part. */
  beat: number;
  piece: DrumPiece;
  velocity: number;
  /** Its humanizing shift from that beat, in milliseconds. */
  offsetMs: number;
  /** A brush sweep's length, in beats. */
  beats?: number;
}

export interface DrumPart {
  /** The part's length in beats: it loops after this. */
  beats: number;
  hits: PatternHit[];
}

export interface GroovePartOptions {
  /** How many bars. */
  bars: number;
  /** The form's length in bars, for the fills and the crash: the part's own length when left out. */
  steps?: number;
  /** The first bar's number since the count-in: `steps` or more starts on a later pass, with the crash at its top. */
  startBar?: number;
  humanize?: number;
  brushes?: boolean;
  /** False plays the groove with no fill at the end. */
  looping?: boolean;
}

/** The bars the jam loop's drummer would play: `buildDrumBar`'s own strokes, bar after bar. */
export function groovePart(groove: DrumGroove, options: GroovePartOptions): DrumPart {
  const { bars, humanize, brushes, looping = true } = options;
  const steps = options.steps ?? bars;
  const startBar = options.startBar ?? 0;
  const hits: PatternHit[] = [];
  for (let index = 0; index < bars; index++) {
    const bar = startBar + index;
    const position = { stepIndex: bar % steps, pass: Math.floor(bar / steps) };
    const strokes = buildDrumBar({ groove, bar, ...position, steps, ...drumPhrase(position, steps, looping), humanize, brushes });
    for (const stroke of strokes) hits.push({ ...stroke, beat: index * BEATS_PER_BAR + stroke.beat });
  }
  return { beats: bars * BEATS_PER_BAR, hits };
}

/**
 * The part that loudness is measured on: four bars of straight eighths as
 * the second pass of a four-bar form plays them, so it has the crash at the
 * top and a fill at the end, with no humanizing. It uses every drum and
 * cymbal a kit has except the ride. A brushes kit plays it with brushes.
 */
export const REFERENCE_BPM = 100;
export function referencePart(kit: DrumKitId): DrumPart {
  return groovePart('rock8', { bars: 4, steps: 4, startBar: 4, humanize: 0, brushes: kit === 'brushes' });
}

export interface RenderPartOptions {
  bpm: number;
  sampleRate: number;
  kit?: DrumKitId;
  params?: Partial<DrumParams>;
  /** Times through the part. */
  loops?: number;
  /** Extra time after the last loop, in seconds. */
  tailSeconds?: number;
  seed?: number;
}

export interface StereoSound {
  left: Float32Array;
  right: Float32Array;
}

/** Render a part through a kit, in audio-callback-sized blocks as the worklet would. */
export function renderDrumPart(part: DrumPart, options: RenderPartOptions): StereoSound {
  const { bpm, sampleRate, loops = 1, tailSeconds = 0 } = options;
  const framesPerBeat = (60 / bpm) * sampleRate;
  const synth = new DrumSynth(sampleRate, options.kit, options.params, options.seed);
  for (let loop = 0; loop < loops; loop++) {
    for (const hit of part.hits) {
      const frame = (loop * part.beats + hit.beat) * framesPerBeat + (hit.offsetMs / 1000) * sampleRate;
      synth.hit(Math.max(0, frame), hit.piece, hit.velocity, (hit.beats ?? 0) * framesPerBeat);
    }
  }
  const length = Math.round(loops * part.beats * framesPerBeat + tailSeconds * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let frame = 0; frame < length; frame += 128) synth.render(left, right, frame, frame, Math.min(length, frame + 128));
  return { left, right };
}

export interface StereoLevels {
  /** The largest sample in either ear, in dBFS. */
  peakDb: number;
  /** The RMS level of the two ears together, in dBFS. */
  rmsDb: number;
  /** K-weighted loudness, in LKFS (ITU-R BS.1770, both ears summed, no gating). */
  loudness: number;
}

/** Peak, RMS and K-weighted loudness of a stereo sound. */
export function stereoLevels({ left, right }: StereoSound, sampleRate: number): StereoLevels {
  let peak = 0;
  let square = 0;
  let weighted = 0;
  for (const channel of [left, right]) {
    const [shelf, highpass] = kWeightingFilters(sampleRate);
    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i];
      const magnitude = sample < 0 ? -sample : sample;
      if (magnitude > peak) peak = magnitude;
      square += sample * sample;
      const k = highpass.process(shelf.process(sample));
      weighted += k * k;
    }
  }
  const length = Math.max(1, left.length);
  return {
    peakDb: toDb(peak),
    rmsDb: toDb(Math.sqrt(square / (2 * length))),
    loudness: weighted > 0 ? -0.691 + 10 * Math.log10(weighted / length) : -Infinity,
  };
}

/** A kit's levels on the reference part, before any trim. */
export function measureKit(kit: DrumKitId, params: Partial<DrumParams> | undefined, sampleRate: number): StereoLevels {
  return stereoLevels(renderDrumPart(referencePart(kit), { bpm: REFERENCE_BPM, sampleRate, kit, params }), sampleRate);
}
