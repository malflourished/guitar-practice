/**
 * The jam loop's score, as plain data: what one bar of the backing plays.
 * Pure, so the engine only has to turn these events into sound.
 */

export type JamBacking = 'strum' | 'pad';
export type JamFeel = 'straight' | 'swing';

/** Beats per bar. The jam loop is 4/4. */
export const BEATS_PER_BAR = 4;
/** Where an up-strum sits in a swung beat. */
export const SWING_OFFSET = 2 / 3;
/** The bass plays the octave of its pitch class that starts here (E2 to D♯3). */
export const BASS_LOW = 40;

export type JamEvent =
  | { kind: 'bass'; beat: number; midi: number; duration: number }
  | { kind: 'strum'; beat: number; up: boolean; velocity: number }
  | { kind: 'pad'; beat: number; midis: number[]; duration: number }
  | { kind: 'click'; beat: number; accent: boolean };

/** What a bar needs to know about its chord. */
export interface JamBarStep {
  rootPc: number;
  /** A slash chord's bass (II/I over the key note); the root otherwise. */
  bassPc?: number;
  /** The pad's voicing for this chord (see `leadPadVoicings`). */
  padMidis?: number[];
}

export interface JamBarOptions {
  backing: JamBacking;
  feel: JamFeel;
  click: boolean;
}

/** The pitch class's note in the bass register: MIDI 40 to 51. */
export function bassMidi(pc: number): number {
  return BASS_LOW + ((((pc - BASS_LOW) % 12) + 12) % 12);
}

/** One bar: bass on 1 and 3, then strums or the pad, then the click if it is on. */
export function buildJamBar(step: JamBarStep, options: JamBarOptions): JamEvent[] {
  const events: JamEvent[] = [];
  const bass = bassMidi(step.bassPc ?? step.rootPc);
  for (const beat of [0, 2]) events.push({ kind: 'bass', beat, midi: bass, duration: 1.9 });
  if (options.backing === 'strum') {
    for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
      events.push({ kind: 'strum', beat, up: false, velocity: beat === 0 ? 1 : 0.7 });
      if (options.feel === 'swing') {
        events.push({ kind: 'strum', beat: beat + SWING_OFFSET, up: true, velocity: 0.45 });
      }
    }
  } else if (step.padMidis && step.padMidis.length > 0) {
    events.push({ kind: 'pad', beat: 0, midis: step.padMidis, duration: BEATS_PER_BAR });
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
