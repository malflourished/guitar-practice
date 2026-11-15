// The day's practice plan: which box, which key, which three ear intervals,
// and why. A pure function of the day and the saved history. The rules and the
// evidence behind them are in docs/specs/E-adaptive-practice.md.
import type { NoteName } from '../../types/music';
import { ALL_NOTES } from '../colors';
import type { PracticeSessionData } from './session';

export type KeyQuality = 'minor' | 'major';
/**
 * Where the two cycles stand: the lap and the box in it (0 to 4), the finished
 * days already spent on that box, and the ear ladder's stage and window.
 */
export interface Track { lap: number; box: number; streak: number; stage: number; offset: number }
/**
 * What a session practised, and where the cycles stood that day. Saved with
 * the session, so tomorrow's plan needs only the last day practised and does
 * not depend on how much history is kept.
 */
export interface PlanChoice { box: number; quality: KeyQuality; ear: number[]; track: Track }

export const BOX_COUNT = 5;
/** Finished days in a row on one box before it moves on whatever the rating. */
export const BOX_DAY_LIMIT = 3;
/** Days without practice after which the last step is repeated. */
export const AWAY_DAYS = 7;
export const EAR_SET_SIZE = 3;
export const EAR_MIN_ANSWERS = 6;
/** First-answer accuracy that brings in the next interval. */
export const EAR_UP = 0.9;
/** Below this the same set comes back. */
export const EAR_REPEAT = 0.7;
/** The order intervals join, in semitones above the root. The first three are the start. */
export const EAR_LADDER = [3, 7, 10, 4, 6, 5, 9, 2, 11];
export const EAR_NAMES: Record<number, { short: string; name: string }> = {
  2: { short: '2', name: 'Major second' }, 3: { short: '♭3', name: 'Minor third' },
  4: { short: '3', name: 'Major third' }, 5: { short: '4', name: 'Perfect fourth' },
  6: { short: '♭5', name: 'Tritone' }, 7: { short: '5', name: 'Perfect fifth' },
  9: { short: '6', name: 'Major sixth' }, 10: { short: '♭7', name: 'Minor seventh' },
  11: { short: '7', name: 'Major seventh' },
};
const EAR_TOP = EAR_LADDER.length - EAR_SET_SIZE;
/** Roots, Scale and Changes: the blocks played in the day's box. */
const BOX_BLOCKS = [0, 1, 3];
const BLOCK_NAMES = ['Roots', 'Scale', 'Ear', 'Changes'];

const START: Track = { lap: 0, box: 0, streak: 0, stage: 0, offset: 0 };
/** Sessions saved before plans existed: the old fixed drill, box unknown (0), at the start of both cycles. */
const LEGACY_CHOICE: PlanChoice = { box: 0, quality: 'minor', ear: [3, 7, 10], track: START };
export const choiceOf = (session: PracticeSessionData): PlanChoice => session.plan ?? LEGACY_CHOICE;

export function validChoice(value: unknown): value is PlanChoice {
  if (!value || typeof value !== 'object') return false;
  const c = value as PlanChoice;
  return Number.isInteger(c.box) && c.box >= 1 && c.box <= BOX_COUNT
    && (c.quality === 'minor' || c.quality === 'major')
    && Array.isArray(c.ear) && c.ear.length === EAR_SET_SIZE
    && c.ear.every((n) => n in EAR_NAMES) && new Set(c.ear).size === EAR_SET_SIZE
    && validTrack(c.track) && c.track.box === c.box - 1 && sameSet(c.ear, earSet(c.track.stage, c.track.offset));
}
function validTrack(t: Track): boolean {
  return !!t && typeof t === 'object'
    && [t.lap, t.box, t.streak, t.stage, t.offset].every((n) => Number.isInteger(n) && n >= 0)
    && t.box < BOX_COUNT && t.streak < BOX_DAY_LIMIT && t.stage <= EAR_TOP && t.offset < earPool(t.stage).length;
}

// ---- Days ----
const pad = (n: number) => String(n).padStart(2, '0');
/** The local calendar day of a moment, as YYYY-MM-DD. */
export function localDay(moment: Date | string): string {
  const d = typeof moment === 'string' ? new Date(moment) : moment;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
export function addDays(day: string, days: number): string {
  const d = new Date((dayNumber(day) + days) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ---- Keys ----
/** Lap 0 is A minor, lap 1 its relative major; each pair of laps moves up a fourth. */
export function lapKey(lap: number): { root: NoteName; quality: KeyQuality } {
  const minorPc = (9 + 5 * (Math.floor(lap / 2) % 12)) % 12;
  return lap % 2 === 0
    ? { root: ALL_NOTES[minorPc], quality: 'minor' }
    : { root: ALL_NOTES[(minorPc + 3) % 12], quality: 'major' };
}

// ---- Ear ----
export function earPool(stage: number): number[] {
  return EAR_LADDER.slice(0, EAR_SET_SIZE + stage).sort((a, b) => a - b);
}
/** Three neighbours from the unlocked intervals, starting at `offset`, wrapping round. */
export function earSet(stage: number, offset: number): number[] {
  const pool = earPool(stage);
  return Array.from({ length: EAR_SET_SIZE }, (_, k) => pool[(offset + k) % pool.length]).sort((a, b) => a - b);
}
function sameSet(a: number[], b: number[]): boolean { return a.length === b.length && a.every((n) => b.includes(n)); }

// ---- The two tracks ----
export type BoxNote =
  | { kind: 'first' | 'unfinished' }
  | { kind: 'next' | 'limit'; from: number }
  | { kind: 'again'; blocks: number[] }
  | { kind: 'away'; days: number };
export type EarNote =
  | { kind: 'first' | 'rotate' | 'away' }
  | { kind: 'joins'; interval: number; correct: number; total: number }
  | { kind: 'same'; why: 'few' | 'rating' | 'score' | 'zone'; correct: number; total: number };
interface State extends Track { boxNote: BoxNote; earNote: EarNote }

const track = ({ lap, box, streak, stage, offset }: Track): Track => ({ lap, box, streak, stage, offset });

function boxStep(state: State, sessions: PracticeSessionData[]): Pick<State, 'lap' | 'box' | 'streak' | 'boxNote'> {
  const same = { lap: state.lap, box: state.box, streak: state.streak, boxNote: state.boxNote };
  const onBox = sessions.filter((s) => choiceOf(s).box === state.box + 1);
  if (onBox.length === 0) return same;
  const finished = onBox.filter((s) => s.completed);
  if (finished.length === 0) return { ...same, boxNote: { kind: 'unfinished' } };
  const last = finished[finished.length - 1];
  const hard = BOX_BLOCKS.filter((block) => last.ratings[block] === 'revisit');
  const streak = state.streak + 1;
  if (hard.length > 0 && streak < BOX_DAY_LIMIT) return { ...same, streak, boxNote: { kind: 'again', blocks: hard } };
  const wrap = state.box === BOX_COUNT - 1;
  return { lap: state.lap + Number(wrap), box: wrap ? 0 : state.box + 1, streak: 0,
    boxNote: { kind: hard.length > 0 ? 'limit' : 'next', from: state.box + 1 } };
}

function earStep(state: State, sessions: PracticeSessionData[]): Pick<State, 'stage' | 'offset' | 'earNote'> {
  const same = { stage: state.stage, offset: state.offset, earNote: state.earNote };
  const set = earSet(state.stage, state.offset);
  const onSet = sessions.filter((s) => sameSet(choiceOf(s).ear, set));
  if (onSet.length === 0) return same;
  const attempts = onSet.flatMap((s) => s.attempts);
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const rating = [...onSet].reverse().find((s) => s.ratings[2])?.ratings[2];
  const stay = (why: 'few' | 'rating' | 'score' | 'zone') => ({ ...same, earNote: { kind: 'same' as const, why, correct, total } });
  if (total < EAR_MIN_ANSWERS) return stay('few');
  if (correct / total < EAR_REPEAT) return stay('score');
  if (rating === 'revisit') return stay('rating');
  if (correct / total >= EAR_UP && state.stage < EAR_TOP) {
    const stage = state.stage + 1;
    const pool = earPool(stage);
    const interval = EAR_LADDER[EAR_SET_SIZE + stage - 1];
    // The new interval arrives between its two neighbours.
    const offset = Math.min(Math.max(pool.indexOf(interval) - 1, 0), pool.length - EAR_SET_SIZE);
    return { stage, offset, earNote: { kind: 'joins', interval, correct, total } };
  }
  const pool = earPool(state.stage);
  // With only three intervals unlocked there is nothing to rotate to.
  if (pool.length === EAR_SET_SIZE) return stay('zone');
  return { stage: state.stage, offset: (state.offset + 1) % pool.length, earNote: { kind: 'rotate' } };
}

// ---- Words ----
/** Spells a key's root the way the player reads it (B♭ major, not A# major). */
export type KeyNamer = (root: NoteName, quality: KeyQuality) => string;
const list = (items: string[], last: string) => items.length < 2 ? items.join('')
  : `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1]}`;
export const earShorts = (set: number[], last = 'and') => list(set.map((n) => EAR_NAMES[n].short), last);

function boxWhy(state: State, name: KeyNamer): string {
  const box = state.box + 1;
  const key = lapKey(state.lap);
  const keyName = `${name(key.root, key.quality)} ${key.quality}`;
  const newLap = () => key.quality === 'major'
    ? `New lap: ${keyName} is the same five shapes as ${name(lapKey(state.lap - 1).root, 'minor')} minor, heard from ${name(key.root, 'major')}. Box 1.`
    : `New lap, new key: ${keyName}, a fourth up from ${name(lapKey(state.lap - 2).root, 'minor')} minor. Box 1.`;
  const note = state.boxNote;
  switch (note.kind) {
    case 'first': return `Box 1 opens a lap of the five boxes in ${keyName}.`;
    case 'next': return state.box === 0 ? newLap() : `Box ${box}: you finished box ${note.from} last time.`;
    case 'limit': return `Three days on box ${note.from} is enough for now; it returns next lap. ${state.box === 0 ? newLap() : `Box ${box} today.`}`;
    case 'again': return `Box ${box} again: you marked ${list(note.blocks.map((b) => BLOCK_NAMES[b]), 'and')} “Revisit this”.`;
    case 'unfinished': return `Box ${box} again: the last session stopped early.`;
    case 'away': return `${note.days} days away: box ${box} again to warm back in.`;
  }
}

function earWhy(state: State): string {
  const note = state.earNote;
  switch (note.kind) {
    case 'first': return `Ear: ${earShorts(earSet(state.stage, state.offset))}, the minor 7th chord.`;
    case 'joins': return `Ear: the ${EAR_NAMES[note.interval].name.toLowerCase()} joins, after ${note.correct} of ${note.total}.`;
    case 'rotate': return `Ear: ${earShorts(earSet(state.stage, state.offset))}, next in the rotation.`;
    case 'away': return 'Ear: the last set again.';
    case 'same': {
      const score = `after ${note.correct} of ${note.total}`;
      if (note.why === 'few') return 'Ear: the same three; fewer than six answers last time.';
      if (note.why === 'rating') return 'Ear: the same three, marked “Revisit this”.';
      if (note.why === 'score') return `Ear: the same three, ${score}; 9 in 10 moves on.`;
      return `Ear: the same three, ${score}; 9 in 10 brings in the major third.`;
    }
  }
}

/** What the finished screen says about the next session, so a rating is seen to do something. */
function preview(state: State, name: KeyNamer): string {
  const box = state.box + 1;
  const key = lapKey(state.lap);
  const b = state.boxNote;
  const moved = b.kind === 'next' || b.kind === 'limit';
  const boxPart = b.kind === 'again' ? `box ${box} again, because you marked ${list(b.blocks.map((n) => BLOCK_NAMES[n]), 'and')} “Revisit this”`
    : b.kind === 'unfinished' ? `box ${box} again, to play it through`
    : moved && state.box === 0 ? `a new lap, box 1 in ${name(key.root, key.quality)} ${key.quality}`
    : `box ${box}`;
  const e = state.earNote;
  const earPart = e.kind === 'joins' ? `The ${EAR_NAMES[e.interval].name.toLowerCase()} joins the ear set.`
    : e.kind === 'rotate' ? `The ear set moves to ${earShorts(earSet(state.stage, state.offset))}.`
    : 'The same three intervals by ear.';
  return `Next time: ${boxPart}. ${earPart}`;
}

export interface DayPlan extends PlanChoice {
  day: string;
  lap: number;
  root: NoteName;
  boxNote: BoxNote;
  earNote: EarNote;
  /** Why this box and why these intervals, in one line. */
  line: string;
  /** The same plan in the words of the finished screen: "Next time: …". */
  preview: string;
}

/**
 * The plan for `day`, from the last day practised before it: where the cycles
 * stood that day (saved with its sessions) and how its sessions went.
 * Sessions from `day` itself are ignored, so the plan is the same all day.
 */
export function planFor(day: string, history: PracticeSessionData[], name: KeyNamer = (n) => n): DayPlan {
  const past = history.filter((s) => s.finishedAt && localDay(s.startedAt) < day);
  let state: State = { ...START, boxNote: { kind: 'first' }, earNote: { kind: 'first' } };
  if (past.length > 0) {
    const lastDay = past.map((s) => localDay(s.startedAt)).sort().pop()!;
    const sessions = past.filter((s) => localDay(s.startedAt) === lastDay).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const before: State = { ...state, ...track(choiceOf([...sessions].reverse().find((s) => s.plan) ?? sessions[0]).track) };
    const days = dayNumber(day) - dayNumber(lastDay);
    // A week away undoes the last step, so the player warms back in on known ground.
    state = days >= AWAY_DAYS
      ? { ...before, boxNote: { kind: 'away', days }, earNote: { kind: 'away' } }
      : { ...before, ...boxStep(before, sessions), ...earStep(before, sessions) };
  }
  const key = lapKey(state.lap);
  return { day, lap: state.lap, root: key.root, quality: key.quality, box: state.box + 1,
    ear: earSet(state.stage, state.offset), track: track(state), boxNote: state.boxNote, earNote: state.earNote,
    line: `${boxWhy(state, name)} ${earWhy(state)}`, preview: preview(state, name) };
}
