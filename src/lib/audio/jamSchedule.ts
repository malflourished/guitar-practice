/**
 * The jam loop's score, as plain data: what one bar of the backing plays.
 * Pure, so the engine only has to turn these events into sound.
 */

import { buildDrumBar, type DrumBarRequest } from './drumGrooves';
import { BEATS_PER_BAR, SWING_OFFSET } from './jamGrid';
import type { DrumPiece } from './synth/drums/drumParams';

/** How long the guitar holds each chord: a strum a bar, on 1 and 3, or on every beat. */
export type GuitarHold = 'whole' | 'half' | 'quarter';
/**
 * A bar's guitar: one of the holds, or none. The app never asks for none: a
 * Guitar fader at off schedules nothing instead (see the engine's mix).
 */
export type GuitarRhythm = 'off' | GuitarHold;
export type JamFeel = 'straight' | 'swing';

export { BEATS_PER_BAR, SWING_OFFSET };
/** The bass plays the octave of its pitch class that starts here (E1 to D♯2), under the guitar's low E. */
export const BASS_LOW = 28;

export type JamEvent =
  | { kind: 'bass'; beat: number; midi: number; duration: number; velocity: number }
  | { kind: 'strum'; beat: number; up: boolean; velocity: number; duration: number }
  | { kind: 'pad'; beat: number; midis: number[]; duration: number }
  | { kind: 'click'; beat: number; accent: boolean }
  /** A soft cymbal that marks the top of the form. */
  | { kind: 'cymbal'; beat: number }
  /**
   * One stroke of the drum kit. `beat` is on the grid; `offsetMs` is a small
   * humanizing shift from it, in milliseconds. `beats` is how long a brush
   * sweep lasts.
   */
  | { kind: 'drum'; beat: number; piece: DrumPiece; velocity: number; offsetMs: number; beats?: number };

/** What a bar needs to know about its chord. */
export interface JamBarStep {
  rootPc: number;
  /** A slash chord's bass (II/I over the key note); it plays on both bass beats. */
  bassPc?: number;
  /** The chord's own 5th (a diminished chord's ♭5); a perfect 5th when left out. */
  fifthPc?: number;
  /** The next bar's bass pitch class, for the swing pickup; this bar's when left out. */
  nextBassPc?: number;
  /** The pad's voicing for this chord (see `leadPadVoicings`). */
  padMidis?: number[];
}

export interface JamBarOptions {
  guitar: GuitarRhythm;
  pad: boolean;
  feel: JamFeel;
  click: boolean;
  /**
   * A cymbal on beat 1, as a drummer marks the top of the form: the caller
   * asks for it on bar 1 from the second pass on. It has nothing to do with
   * Click, and no fader of its own.
   */
  cymbal?: boolean;
  /**
   * The drum kit's bar (see `drumGrooves.ts`). Like the pad, the caller always
   * asks for it and the Drums fader decides whether it sounds.
   */
  drums?: DrumBarRequest;
}

/** The pitch class's note in the bass register: MIDI 28 to 39. */
export function bassMidi(pc: number): number {
  return BASS_LOW + ((((pc - BASS_LOW) % 12) + 12) % 12);
}

/** The pitch class of a chord's 5th: a ♭5 or ♯5 when that is what it has, else perfect. */
export function chordFifthPc(rootPc: number, intervals: readonly number[]): number {
  const fifth = [7, 6, 8].find((interval) => intervals.includes(interval)) ?? 7;
  return (rootPc + fifth) % 12;
}

/**
 * One bar: the bass (root on 1, 5th on 3, a pickup into the next bar when
 * swung), the guitar's strums, the pad, the cymbal if it is the top of the
 * form, the drum kit's bar if one is asked for, then the click if it is on.
 */
export function buildJamBar(step: JamBarStep, options: JamBarOptions): JamEvent[] {
  const events: JamEvent[] = [];
  const swing = options.feel === 'swing';
  const slash = step.bassPc !== undefined && step.bassPc !== step.rootPc;
  const low = bassMidi(step.bassPc ?? step.rootPc);
  const fifth = slash ? low : bassMidi(step.fifthPc ?? (step.rootPc + 7) % 12);
  events.push({ kind: 'bass', beat: 0, midi: low, duration: 2, velocity: 0.9 });
  events.push({ kind: 'bass', beat: 2, midi: fifth, duration: swing ? 2 - 1 / 3 : 2, velocity: 0.8 });
  if (swing) {
    // a half step under the next bar's bass note, held until that note starts
    const next = bassMidi(step.nextBassPc ?? step.bassPc ?? step.rootPc);
    events.push({ kind: 'bass', beat: 3 + SWING_OFFSET, midi: next - 1, duration: 1 - SWING_OFFSET, velocity: 0.6 });
  }
  if (options.guitar === 'whole') {
    events.push({ kind: 'strum', beat: 0, up: false, velocity: 1, duration: BEATS_PER_BAR });
  } else if (options.guitar === 'half') {
    events.push({ kind: 'strum', beat: 0, up: false, velocity: 1, duration: 2 });
    events.push({ kind: 'strum', beat: 2, up: false, velocity: 0.8, duration: 2 });
  } else if (options.guitar === 'quarter') {
    for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
      events.push({ kind: 'strum', beat, up: false, velocity: beat === 0 ? 1 : 0.7, duration: 0.8 });
      if (swing) {
        events.push({ kind: 'strum', beat: beat + SWING_OFFSET, up: true, velocity: 0.45, duration: 1 - SWING_OFFSET });
      }
    }
  }
  if (options.pad && step.padMidis && step.padMidis.length > 0) {
    events.push({ kind: 'pad', beat: 0, midis: step.padMidis, duration: BEATS_PER_BAR });
  }
  if (options.cymbal) events.push({ kind: 'cymbal', beat: 0 });
  if (options.drums) {
    for (const hit of buildDrumBar(options.drums)) events.push({ kind: 'drum', ...hit });
  }
  if (options.click) {
    for (let beat = 0; beat < BEATS_PER_BAR; beat++) events.push({ kind: 'click', beat, accent: beat === 0 });
  }
  return events.sort((a, b) => a.beat - b.beat);
}

/** What a step is, for telling one chord from the next. */
export interface JamChord {
  rootPc: number;
  quality: string;
  bassPc?: number;
  fifthPc?: number;
}

export function sameChord(a: JamChord, b: JamChord): boolean {
  return a.rootPc === b.rootPc && a.quality === b.quality && (a.bassPc ?? a.rootPc) === (b.bassPc ?? b.rootPc);
}

/** Where a bar of the loop is: which step, what comes next, how many times round. */
export interface JamPosition {
  stepIndex: number;
  nextStepIndex: number;
  /** The bar before a change of chord (root, quality or bass differ). */
  changeComing: boolean;
  pass: number;
}

/** `bar` counts from 0 at the first bar after the count-in. */
export function jamPosition(bar: number, chords: readonly JamChord[]): JamPosition {
  const length = Math.max(1, chords.length);
  const stepIndex = ((bar % length) + length) % length;
  const nextStepIndex = (stepIndex + 1) % length;
  return {
    stepIndex,
    nextStepIndex,
    changeComing: chords.length > 1 && !sameChord(chords[stepIndex], chords[nextStepIndex]),
    pass: Math.floor(bar / length),
  };
}

/**
 * Whether this bar is the top of the form from the second pass on: bar 1 of
 * every pass but the first, where a drummer would mark it with a cymbal.
 */
export function isTopOfForm({ stepIndex, pass }: JamPosition): boolean {
  return pass >= 1 && stepIndex === 0;
}

/** The next different chord, and how far away it is. */
export interface NextChange {
  /** The step it starts at. */
  stepIndex: number;
  /** Bars until it sounds: 1 is the very next bar. */
  bars: number;
}

/**
 * From the step at `stepIndex`, the next step whose chord differs (root,
 * quality or bass), wrapping round the loop; null when every step is the same
 * chord, so there is no change to wait for. In the 12-bar blues from bar 1 it
 * is F7 in 4 bars, and from bar 12 it is C7 in 1 bar, back round the top.
 */
export function nextChange(stepIndex: number, chords: readonly JamChord[]): NextChange | null {
  const length = chords.length;
  if (length === 0) return null;
  const from = ((stepIndex % length) + length) % length;
  for (let bars = 1; bars < length; bars++) {
    const index = (from + bars) % length;
    if (!sameChord(chords[from], chords[index])) return { stepIndex: index, bars };
  }
  return null;
}

/** The bar's chord for `buildJamBar`: the step at `index`, with the next bar's bass for the pickup. */
export function jamBarStep(
  chords: readonly JamChord[],
  index: number,
  padVoicings: readonly number[][] = [],
): JamBarStep {
  const chord = chords[index];
  const next = chords[(index + 1) % chords.length];
  return {
    rootPc: chord.rootPc,
    bassPc: chord.bassPc,
    fifthPc: chord.fifthPc,
    nextBassPc: next.bassPc ?? next.rootPc,
    padMidis: padVoicings[index],
  };
}
