import type { ChordQuality, FretPosition, NoteName } from '../../types/music';
import { getChordIntervals } from './chords';
import { getChordToneForNote } from './chordTones';
import { getNoteAt } from './fretboard';
import { noteToSemitone, semitoneToNote } from './notes';
import { FRET_COUNT } from './tuning';

/**
 * Where to land on the next chord (package P3, docs/specs/P3-targets.md).
 *
 * While the jam loop plays, the neck rings the notes worth landing on when the
 * chord changes: the next chord's 3rd and 7th, inside the stretch of neck the
 * hand will be in. Pure functions: which notes, where on the neck, and when
 * they show.
 */

/** A chord, as far as picking targets goes. */
export interface TargetChord {
  root: NoteName;
  quality: ChordQuality;
}

export type TargetRole = 'root' | 'third' | 'fifth' | 'seventh' | 'extension';

/** One note of the next chord that is worth landing on. */
export interface TargetTone {
  /** Pitch class, 0 (C) to 11. */
  pc: number;
  note: NoteName;
  /** Semitones above the next chord's root. */
  interval: number;
  /** What it is in the next chord: 3, ♭3, ♭7, 7, R, 5. */
  label: string;
  role: TargetRole;
  /** The chord sounding now has this note too: stay on it, it only changes its job. */
  held: boolean;
}

/**
 * Which of the next chord's notes are shown. Each prompt of the pass (P4) picks
 * one, so the neck shows what the prompt asks for.
 */
export type TargetFocus =
  /** The 3rd and the 7th; and the note that changes when neither of them is new. */
  | { kind: 'guide' }
  /** The 3rd only. */
  | { kind: 'thirds' }
  /** The 7th only (the 3rd of a chord that has no 7th). */
  | { kind: 'sevenths' }
  /** Every note the chord sounding now does not have. */
  | { kind: 'changes' }
  /** The 3rd and the 7th along one string, anywhere up to fret 15. */
  | { kind: 'string'; string: number }
  /** Nothing: find them by ear. */
  | { kind: 'none' };

export const GUIDE_FOCUS: TargetFocus = { kind: 'guide' };

function roleOf(interval: number): TargetRole {
  if (interval >= 12) return 'extension';
  if (interval === 0) return 'root';
  // a suspended 2nd or 4th stands where the 3rd would
  if (interval >= 2 && interval <= 5) return 'third';
  if (interval >= 6 && interval <= 8) return 'fifth';
  return 'seventh';
}

/** A chord's notes, low interval first, each with its job in the chord. */
export function chordTargetTones(chord: TargetChord): TargetTone[] {
  const rootPc = noteToSemitone(chord.root);
  const seen = new Set<number>();
  const tones: TargetTone[] = [];
  for (const interval of getChordIntervals(chord.quality)) {
    const pc = (rootPc + interval) % 12;
    if (seen.has(pc)) continue;
    seen.add(pc);
    const note = semitoneToNote(pc);
    const tone = getChordToneForNote(chord.root, note, chord.quality);
    const size = tone?.interval ?? interval;
    tones.push({
      pc,
      note,
      interval: size,
      label: tone?.label ?? String(size),
      role: roleOf(size),
      held: false,
    });
  }
  return tones;
}

/**
 * The notes to aim for when `next` arrives while `current` sounds (null at the
 * count-in, when nothing sounds yet).
 *
 * The guide tones, the 3rd and the 7th, are what make a chord sound like
 * itself, so they are the targets. A triad has only its 3rd. When none of them
 * is new, because the chord sounding now already has them (C to A minor: A
 * minor's 3rd is C), landing on one would not let anyone hear the change, so
 * the notes that do change are added (the A).
 */
export function targetTones(
  next: TargetChord,
  current: TargetChord | null,
  focus: TargetFocus = GUIDE_FOCUS,
): TargetTone[] {
  if (focus.kind === 'none') return [];
  const now = current ? new Set(chordTargetTones(current).map((tone) => tone.pc)) : null;
  const tones = chordTargetTones(next).map((tone) => ({ ...tone, held: now?.has(tone.pc) ?? false }));
  const thirds = tones.filter((tone) => tone.role === 'third');
  const sevenths = tones.filter((tone) => tone.role === 'seventh');
  const guide = thirds.length + sevenths.length > 0 ? [...thirds, ...sevenths] : tones;
  const fresh = tones.filter((tone) => !tone.held);

  switch (focus.kind) {
    case 'thirds':
      return thirds.length > 0 ? thirds : guide;
    case 'sevenths':
      return sevenths.length > 0 ? sevenths : guide;
    case 'changes':
      return now && fresh.length > 0 ? fresh : guide;
    case 'guide':
    case 'string':
      if (now && guide.every((tone) => tone.held)) {
        return [...guide, ...fresh.filter((tone) => !guide.includes(tone))];
      }
      return guide;
  }
}

/** A stretch of the neck, both frets included. 0 is the open strings. */
export interface FretWindow {
  lo: number;
  hi: number;
}

/** The strings a line is heard on: e, B, G and D. The bass and the strum own the two below. */
export const MELODY_STRINGS: readonly number[] = [0, 1, 2, 3];
/** A hand reaches one fret either side of the shape it is in. */
export const TARGET_REACH = 1;
/**
 * A window at least this many frets from end to end holds every note on the
 * four melody strings at least once (four frets in a row on each).
 */
export const MIN_WINDOW_SPAN = 3;
/** One string, played along the neck: as far up as the climb goes. */
export const ONE_STRING_TOP_FRET = 15;

/** Where the hand is when a chord is played in a shape: the shape's frets and one more each side. */
export function reachWindow(startFret: number, endFret: number): FretWindow {
  const lo = Math.max(0, Math.min(startFret, endFret) - TARGET_REACH);
  let hi = Math.min(FRET_COUNT, Math.max(startFret, endFret) + TARGET_REACH);
  if (hi - lo < MIN_WINDOW_SPAN) hi = Math.min(FRET_COUNT, lo + MIN_WINDOW_SPAN);
  return { lo: Math.min(lo, hi - MIN_WINDOW_SPAN), hi };
}

/** A target on the neck. */
export interface LandingTarget extends FretPosition {
  label: string;
  role: TargetRole;
  held: boolean;
}

/**
 * Every place the tones sit inside the window, on the strings given. A tone
 * with no place there (a narrow window, or one string) takes the nearest one
 * outside it, the lower fret on a tie, so every tone is always somewhere.
 */
export function placeTargets(
  tones: readonly TargetTone[],
  window: FretWindow,
  strings: readonly number[] = MELODY_STRINGS,
): LandingTarget[] {
  const out: LandingTarget[] = [];
  for (const tone of tones) {
    const cells: { string: number; fret: number; away: number }[] = [];
    for (const string of strings) {
      for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
        if (noteToSemitone(getNoteAt(string, fret)) !== tone.pc) continue;
        const away = fret < window.lo ? window.lo - fret : fret > window.hi ? fret - window.hi : 0;
        cells.push({ string, fret, away });
      }
    }
    const inside = cells.filter((cell) => cell.away === 0);
    const chosen =
      inside.length > 0
        ? inside
        : cells.sort((a, b) => a.away - b.away || a.fret - b.fret || a.string - b.string).slice(0, 1);
    for (const { string, fret } of chosen) {
      out.push({ string, fret, note: getNoteAt(string, fret), label: tone.label, role: tone.role, held: tone.held });
    }
  }
  return out.sort((a, b) => a.string - b.string || a.fret - b.fret);
}

/** The targets for one change: which notes, and where they are in the window. */
export function landingTargets(input: {
  next: TargetChord;
  current: TargetChord | null;
  window: FretWindow;
  focus?: TargetFocus;
}): LandingTarget[] {
  const focus = input.focus ?? GUIDE_FOCUS;
  const tones = targetTones(input.next, input.current, focus);
  if (focus.kind === 'string') {
    return placeTargets(tones, { lo: 0, hi: ONE_STRING_TOP_FRET }, [focus.string]);
  }
  return placeTargets(tones, input.window);
}

/** The targets are on the neck at least this long before the change. */
export const TARGET_LEAD_SECONDS = 2;

/**
 * How many beats before a change its targets appear: the whole bar before it,
 * and at fast tempos as many beats as make two seconds, up to two bars. (At
 * 120 and slower a bar is two seconds or more.)
 */
export function targetLeadBeats(bpm: number, beatsPerBar = 4): number {
  const beats = Math.ceil((TARGET_LEAD_SECONDS * Math.max(1, bpm)) / 60);
  return Math.min(2 * beatsPerBar, Math.max(beatsPerBar, beats));
}

export type TargetPhase = 'hidden' | 'coming' | 'arriving';

/**
 * `beatsToChange` counts the beat sounding now: 1 is the last beat before the
 * change. That beat is the arrival; before it the targets are only coming.
 */
export function targetPhase(beatsToChange: number, bpm: number, beatsPerBar = 4): TargetPhase {
  if (beatsToChange < 1 || beatsToChange > targetLeadBeats(bpm, beatsPerBar)) return 'hidden';
  return beatsToChange === 1 ? 'arriving' : 'coming';
}

/** Where the loop is, as far as the targets need to know (see `JamLoopState`). */
export interface CueClock {
  playing: boolean;
  countIn: boolean;
  stepIndex: number;
  beat: number;
  pass: number;
  /** The next step whose chord differs, and how many bars away it is. */
  next: { stepIndex: number; bars: number } | null;
}

/** What the neck shows now: the targets, and whether this is the beat to land after. */
export interface LandingCue {
  targets: LandingTarget[];
  phase: Exclude<TargetPhase, 'hidden'>;
  /** The step being aimed at, and the pass it sounds in. */
  stepIndex: number;
  pass: number;
}

/**
 * The cue for this beat of the loop, or null when no change is near enough.
 *
 * - During the count-in the first chord is the target: start on it.
 * - A chord that only repeats is not a change (the clock's `next` skips it).
 * - The change from the last bar to the first belongs to the next pass, so its
 *   window and its focus are the next pass's. With Loop off there is no such
 *   change: the music stops.
 * - The window is where the hand will be when the next chord sounds
 *   (`windowAt`); the focus is the prompt of the pass it sounds in (`focusAt`).
 */
export function landingCue(input: {
  clock: CueClock;
  chords: readonly TargetChord[];
  loop: boolean;
  bpm: number;
  beatsPerBar?: number;
  windowAt: (pass: number, stepIndex: number) => FretWindow | null;
  focusAt?: (pass: number) => TargetFocus;
}): LandingCue | null {
  const { clock, chords, loop, bpm, windowAt, focusAt } = input;
  const beatsPerBar = input.beatsPerBar ?? 4;
  if (!clock.playing || chords.length === 0) return null;

  let stepIndex: number;
  let pass: number;
  let current: TargetChord | null;
  let beatsToChange: number;
  if (clock.countIn) {
    stepIndex = 0;
    pass = 0;
    current = null;
    beatsToChange = beatsPerBar - clock.beat;
  } else {
    if (!clock.next) return null;
    const wraps = clock.next.stepIndex <= clock.stepIndex;
    if (wraps && !loop) return null;
    stepIndex = clock.next.stepIndex;
    pass = clock.pass + (wraps ? 1 : 0);
    current = chords[clock.stepIndex] ?? null;
    beatsToChange = (clock.next.bars - 1) * beatsPerBar + (beatsPerBar - clock.beat);
  }

  const phase = targetPhase(beatsToChange, bpm, beatsPerBar);
  const next = chords[stepIndex];
  const window = windowAt(pass, stepIndex);
  if (phase === 'hidden' || !next || !window) return null;
  const targets = landingTargets({ next, current, window, focus: focusAt?.(pass) });
  return targets.length > 0 ? { targets, phase, stepIndex, pass } : null;
}
