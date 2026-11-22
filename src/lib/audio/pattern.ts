import type { FretPosition } from '../../types/music';

export interface PatternEvent {
  beat: number;
  duration: number;
  positions: FretPosition[];
  index: number;
}

export interface PracticePattern {
  events: PatternEvent[];
  beats: number;
}

export interface PlaybackOptions {
  bpm: number;
  loop?: boolean;
  countIn?: number;
  metronome?: boolean;
  /** Increase 4 BPM every four completed loops, up to 120 BPM. */
  ramp?: boolean;
  /** Loops already played before this start: the loop count and the ramp carry on from here. */
  startCycle?: number;
  /**
   * How many times round the notes sound, counted from this start. After that
   * the count, the click and the ramp go on without them. Left out: every time.
   */
  voicedPasses?: number;
  onBeat?: (beat: number, countIn: boolean, cycle: number, bpm: number) => void;
  onEvent?: (event: PatternEvent) => void;
  onEnd?: () => void;
}

export function sequencePattern(positions: FretPosition[], noteBeats = 1): PracticePattern {
  return {
    events: positions.map((position, index) => ({
      beat: index * noteBeats, duration: noteBeats * 0.9, positions: [position], index,
    })),
    beats: positions.length * noteBeats,
  };
}

export function chordPattern(chords: FretPosition[][], beatsPerChord = 4): PracticePattern {
  return {
    events: chords.map((positions, index) => ({
      beat: index * beatsPerChord, duration: beatsPerChord * 0.9, positions, index,
    })),
    beats: chords.length * beatsPerChord,
  };
}

/**
 * A loop of chords that each last a whole number of bars. A chord is struck
 * again on every bar, so a long one does not die away, and every strike
 * carries the chord's own `index`.
 */
/** A chord's length in whole bars: at least one. */
function barCount(bars: number | undefined): number {
  const wanted = Math.round(bars ?? 1);
  return wanted >= 1 ? wanted : 1; // also catches NaN
}

export function barsPattern(chords: FretPosition[][], bars: number[], beatsPerBar = 4): PracticePattern {
  const events: PatternEvent[] = [];
  let beat = 0;
  chords.forEach((positions, index) => {
    const count = barCount(bars[index]);
    for (let bar = 0; bar < count; bar += 1) {
      events.push({ beat, duration: beatsPerBar * 0.9, positions, index });
      beat += beatsPerBar;
    }
  });
  return { events, beats: beat };
}

/**
 * Where a beat of a bars loop falls once the chords' lengths change from
 * `from` to `to`: in the same chord, the same bar of it (its last bar, if the
 * chord is now shorter than that) and the same beat of the bar. So a change
 * to a chord that is not playing moves nothing that is heard, and a change to
 * the one that is playing is taken up at the next bar line.
 */
export function barsBeat(beat: number, from: number[], to: number[], beatsPerBar = 4): number {
  const chords = Math.max(from.length, to.length);
  let start = 0;
  let moved = 0;
  for (let index = 0; index < chords; index += 1) {
    const length = barCount(from[index]) * beatsPerBar;
    if (beat < start + length) {
      const into = beat - start;
      const bar = Math.min(Math.floor(into / beatsPerBar), barCount(to[index]) - 1);
      return moved + bar * beatsPerBar + (into % beatsPerBar);
    }
    start += length;
    moved += barCount(to[index]) * beatsPerBar;
  }
  return 0;
}

export function loopTempo(start: number, cycle: number, ramp: boolean): number {
  return ramp ? Math.min(Math.max(start, 120), start + Math.floor(cycle / 4) * 4) : start;
}
