import type { FretPosition } from '../../types/music';
import {
  orderScalePositions,
  positionToMidi,
  type ScalePlaybackContext,
} from './pitch';
import type { PatternEvent, PracticePattern } from './pattern';
import type { GuitarHold, JamFeel } from './jamSchedule';

/** Which way a run goes. Up and down plays the way up, then back down. */
export type PlayDirection = 'up' | 'down' | 'updown';
/** A chord played all at once, or one note after another. */
export type Articulation = 'strum' | 'arpeggio';
/** How far a scale run goes: the box on the neck, or every box in turn. */
export type PlayReach = 'position' | 'neck';
/** Progressions: keep each chord where it is, or walk the voicings up or down the neck. */
export type PlayLadder = 'off' | 'up' | 'down';

export interface PlayOptions {
  direction: PlayDirection;
  articulation: Articulation;
  loop: boolean;
  reach: PlayReach;
  ladder: PlayLadder;
  /**
   * Progressions: how long the guitar holds each chord. Whether the guitar,
   * bass and pad sound at all is the mix faders' job, not the menu's.
   */
  guitar: GuitarHold;
  /** Progressions: straight, or swung. Starts at the entry's own feel. */
  feel: JamFeel;
  /** Progressions: a click on every beat (the count-in always clicks). */
  click: boolean;
  /** Progressions: round and round (the other modes' Loop starts off). */
  jamLoop: boolean;
}

export const DEFAULT_PLAY_OPTIONS: PlayOptions = {
  direction: 'up',
  articulation: 'strum',
  loop: false,
  reach: 'position',
  ladder: 'off',
  guitar: 'half',
  feel: 'straight',
  click: false,
  jamLoop: true,
};

/** The modes that use the Play control. Theory with the neck counts as scales. */
export type PlayMode = 'notes' | 'scales' | 'chords' | 'progressions';

export type PlayOptionId =
  | 'direction'
  | 'anchor'
  | 'articulation'
  | 'reach'
  | 'ladder'
  | 'loop'
  | 'guitar'
  | 'feel'
  | 'click'
  | 'jamLoop';

export interface PlayMenuContext {
  articulation: Articulation;
  /** More than one position box: a scale run can cross the whole neck. */
  canCrossNeck: boolean;
}

/**
 * The options the Play menu offers, top to bottom, and only those that mean
 * something here: Start on is for scales, Strum or Arpeggio for chords, and
 * Direction for anything that runs through notes one by one (an arpeggio too).
 */
export function playMenuOptions(
  mode: PlayMode,
  { articulation, canCrossNeck }: PlayMenuContext,
): PlayOptionId[] {
  switch (mode) {
    case 'notes':
      return ['direction', 'loop'];
    case 'scales':
      return [
        'direction',
        'anchor',
        ...(canCrossNeck ? (['reach'] as const) : []),
        'loop',
      ];
    case 'chords':
      return [
        'articulation',
        ...(articulation === 'arpeggio' ? (['direction'] as const) : []),
        'loop',
      ];
    case 'progressions':
      return ['guitar', 'feel', 'click', 'jamLoop', 'ladder'];
  }
}

/** Up, then back down without sounding the top note twice. */
export function joinUpAndDown<T extends { midi: number }>(
  up: T[],
  down: T[],
): T[] {
  const skip = up.length && down.length && up.at(-1)!.midi === down[0].midi ? 1 : 0;
  return [...up, ...down.slice(skip)];
}

/** A scale run in the chosen direction, as the notes to play. */
export function orderScaleRun(
  positions: FretPosition[],
  root: Parameters<typeof orderScalePositions>[1],
  direction: PlayDirection,
  context: ScalePlaybackContext,
): FretPosition[] {
  if (direction === 'up') return orderScalePositions(positions, root, 'ascending', context);
  if (direction === 'down') return orderScalePositions(positions, root, 'descending', context);
  const up = orderScalePositions(positions, root, 'ascending', context);
  const down = orderScalePositions(positions, root, 'descending', context);
  return joinUpAndDown(
    up.map((position) => ({ position, midi: positionToMidi(position) })),
    down.map((position) => ({ position, midi: positionToMidi(position) })),
  ).map((entry) => entry.position);
}

/** A chord's notes one at a time: low to high, high to low, or both. */
export function arpeggioNotes(
  positions: FretPosition[],
  direction: PlayDirection,
): FretPosition[] {
  const up = [...positions].sort((a, b) => positionToMidi(a) - positionToMidi(b));
  if (direction === 'up') return up;
  const down = [...up].reverse();
  if (direction === 'down') return down;
  return joinUpAndDown(
    up.map((position) => ({ position, midi: positionToMidi(position) })),
    down.map((position) => ({ position, midi: positionToMidi(position) })),
  ).map((entry) => entry.position);
}

/**
 * Each chord as an arpeggio over its bar: a note every half beat, each left
 * to ring. `index` stays the chord's, so the neck follows the progression.
 */
export function arpeggioProgressionPattern(
  chords: FretPosition[][],
  direction: PlayDirection,
  beatsPerChord = 4,
): PracticePattern {
  const events: PatternEvent[] = [];
  chords.forEach((positions, index) => {
    arpeggioNotes(positions, direction).forEach((position, step) => {
      const beat = index * beatsPerChord + step * 0.5;
      if (beat >= (index + 1) * beatsPerChord) return;
      events.push({
        beat,
        duration: Math.max(0.5, (index + 1) * beatsPerChord - beat) * 0.9,
        positions: [position],
        index,
      });
    });
  });
  return { events, beats: chords.length * beatsPerChord };
}
