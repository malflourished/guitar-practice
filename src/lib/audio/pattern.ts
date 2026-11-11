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

export function loopTempo(start: number, cycle: number, ramp: boolean): number {
  return ramp ? Math.min(Math.max(start, 120), start + Math.floor(cycle / 4) * 4) : start;
}
