/**
 * The jam loop's score, as plain data: what one bar of the backing plays.
 * Pure, so the engine only has to turn these events into sound.
 */

/** How long the guitar holds each chord: not at all, a strum a bar, on 1 and 3, or every beat. */
export type GuitarRhythm = 'off' | 'whole' | 'half' | 'quarter';
export type JamFeel = 'straight' | 'swing';

/** Beats per bar. The jam loop is 4/4. */
export const BEATS_PER_BAR = 4;
/** Where an up-strum or the bass pickup sits in a swung beat. */
export const SWING_OFFSET = 2 / 3;
/** The bass plays the octave of its pitch class that starts here (E1 to D♯2), under the guitar's low E. */
export const BASS_LOW = 28;

export type JamEvent =
  | { kind: 'bass'; beat: number; midi: number; duration: number; velocity: number }
  | { kind: 'strum'; beat: number; up: boolean; velocity: number; duration: number }
  | { kind: 'pad'; beat: number; midis: number[]; duration: number }
  | { kind: 'click'; beat: number; accent: boolean };

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
 * swung), the guitar's strums, the pad, then the click if it is on.
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
