/**
 * Bass lines as plain data, and a way to render one through the modelled
 * bass without any audio API: for the tests, for measuring loudness, and for
 * the sound lab.
 */
import { BEATS_PER_BAR, buildJamBar, jamBarStep, type JamChord, type JamFeel } from '../../jamSchedule';
import type { BassParams } from './bassParams';
import { BassSynth } from './bassSynth';

export interface LineNote {
  /** When it starts, in beats from the top of the line. */
  beat: number;
  midi: number;
  /** How long it is held, in beats. */
  beats: number;
  /** 0 to 1. */
  velocity: number;
}

export interface BassLine {
  /** The line's length in beats: it loops after this. */
  beats: number;
  notes: LineNote[];
}

/**
 * Two bars in A minor pentatonic, from the low E to the A an octave and a
 * fourth above it: long and short notes, a repeated note, a soft ghost-like
 * note and accents, so one pass shows most of what the instrument does.
 */
export const RIFF_LINE: BassLine = {
  beats: 8,
  notes: [
    { beat: 0, midi: 33, beats: 1.5, velocity: 0.95 },
    { beat: 1.5, midi: 33, beats: 0.5, velocity: 0.7 },
    { beat: 2, midi: 36, beats: 0.5, velocity: 0.8 },
    { beat: 2.5, midi: 38, beats: 0.5, velocity: 0.8 },
    { beat: 3, midi: 40, beats: 0.5, velocity: 0.85 },
    { beat: 3.5, midi: 43, beats: 0.5, velocity: 0.75 },
    { beat: 4, midi: 45, beats: 1, velocity: 0.9 },
    { beat: 5, midi: 43, beats: 0.5, velocity: 0.7 },
    { beat: 5.5, midi: 40, beats: 0.5, velocity: 0.75 },
    { beat: 6, midi: 38, beats: 0.75, velocity: 0.8 },
    { beat: 6.75, midi: 36, beats: 0.25, velocity: 0.55 },
    { beat: 7, midi: 33, beats: 0.5, velocity: 0.85 },
    { beat: 7.5, midi: 28, beats: 0.5, velocity: 0.9 },
  ],
};

/** The chords of a loop as the jam's bass sees them: dominant 7ths on these scale steps of `keyPc`. */
function dominantChords(keyPc: number, steps: readonly number[]): JamChord[] {
  return steps.map((step) => {
    const rootPc = (keyPc + step) % 12;
    return { rootPc, quality: 'dom7', fifthPc: (rootPc + 7) % 12 };
  });
}

/** The bass part the jam loop plays over these chords: `buildJamBar`'s own notes, bar after bar. */
function jamBassLine(chords: readonly JamChord[], feel: JamFeel): BassLine {
  const notes: LineNote[] = [];
  chords.forEach((_, bar) => {
    const events = buildJamBar(jamBarStep(chords, bar), { guitar: 'off', pad: false, feel, click: false });
    for (const event of events) {
      if (event.kind !== 'bass') continue;
      notes.push({ beat: bar * BEATS_PER_BAR + event.beat, midi: event.midi, beats: event.duration, velocity: event.velocity });
    }
  });
  return { beats: chords.length * BEATS_PER_BAR, notes };
}

const BLUES_STEPS = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];

/** The jam's bass part for a 12-bar blues in the key with pitch class `keyPc` (0 is C). */
export function bluesBassLine(keyPc: number, feel: JamFeel = 'swing'): BassLine {
  return jamBassLine(dominantChords(keyPc, BLUES_STEPS), feel);
}

/**
 * The line that loudness is measured on: four bars of the jam's swing bass
 * over I, IV, V and I in A. It covers the bass's working range, both accents
 * and the soft pickup notes.
 */
export const REFERENCE_LINE: BassLine = jamBassLine(dominantChords(9, [0, 5, 7, 0]), 'swing');
export const REFERENCE_BPM = 100;

export interface RenderLineOptions {
  bpm: number;
  sampleRate: number;
  params?: Partial<BassParams>;
  /** Times through the line. */
  loops?: number;
  /** Extra time after the last loop, in seconds. */
  tailSeconds?: number;
  seed?: number;
}

/** Render a line through the modelled bass, in audio-callback-sized blocks as the worklet would. */
export function renderBassLine(line: BassLine, options: RenderLineOptions): Float32Array {
  const { bpm, sampleRate, loops = 1, tailSeconds = 0 } = options;
  const framesPerBeat = (60 / bpm) * sampleRate;
  const synth = new BassSynth(sampleRate, options.params, options.seed);
  for (let loop = 0; loop < loops; loop++) {
    for (const note of line.notes) {
      synth.noteOn((loop * line.beats + note.beat) * framesPerBeat, note.midi, note.velocity, note.beats * framesPerBeat);
    }
  }
  const out = new Float32Array(Math.round(loops * line.beats * framesPerBeat + tailSeconds * sampleRate));
  for (let frame = 0; frame < out.length; frame += 128) {
    synth.render(out, frame, frame, Math.min(out.length, frame + 128));
  }
  return out;
}
