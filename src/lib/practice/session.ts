import type { NoteName } from '../../types/music';
import { ALL_NOTES } from '../colors';
import { validChoice, type PlanChoice } from './plan';

export const PRACTICE_BLOCKS = [
  { id: 'roots', title: 'Root and fifth', short: 'Roots', seconds: 120,
    does: 'Find the root and the 5th in one window of the neck.',
    why: 'They are the anchors every other note is heard against.' },
  { id: 'scale', title: 'Scale practice', short: 'Scale', seconds: 180,
    does: 'Run the minor pentatonic box up and down in eighth notes, in time.',
    why: 'Even, relaxed time is what turns a shape into playing.' },
  { id: 'ear', title: 'Interval training', short: 'Intervals', seconds: 120,
    does: 'Ten questions: hear an interval above the root and name it.',
    why: 'Each interval has a sound; know it and you can find notes by ear.' },
  { id: 'changes', title: 'Solo over the chords', short: 'Solo', seconds: 180,
    does: 'Improvise over i–iv–V while the app plays it, landing on each new chord.',
    why: 'Aiming at the change is the step from scale to music.' },
] as const;
export const SESSION_SECONDS = PRACTICE_BLOCKS.reduce((sum, block) => sum + block.seconds, 0);
/** The Ear block: a round of questions, not a length of time. */
export const EAR_BLOCK = 2;
/** Questions in a round. Ten is the fewest where 9 in 10, the score that brings in an interval, means something. */
export const EAR_ROUND = 10;
/** The lengths a block on the clock can be given, and what each starts at. */
export const BLOCK_LENGTH_CHOICES = [60, 120, 180, 300];
export const DEFAULT_SECONDS: number[] = PRACTICE_BLOCKS.map((block) => block.seconds);
/** No block is logged for longer than this, however long it is played on. */
export const MAX_BLOCK_SECONDS = 900;
export type Rating = 'clean' | 'working' | 'revisit';
export interface EarAttempt { interval: number; answer: number; correct: boolean }
export interface PracticeSessionData {
  version: 1;
  id: string;
  startedAt: string;
  root: NoteName;
  /** The day's box, key quality and ear set. Absent in sessions saved before plans. */
  plan?: PlanChoice;
  bpm: number;
  /**
   * The length the player gave each block, in seconds. Absent in sessions
   * saved before lengths could be set: those use the defaults.
   */
  seconds?: number[];
  /**
   * Questions in the Ear block's round. Absent in sessions saved while the
   * Ear block ran on the clock.
   */
  earGoal?: number;
  block: number;
  elapsed: number[];
  ratings: Partial<Record<number, Rating>>;
  attempts: EarAttempt[];
  finishedAt?: string;
  completed: boolean;
}
export const DRAFT_KEY = 'vibrato:practice-draft-v1';
export const HISTORY_KEY = 'vibrato:practice-history-v1';

/** What the player set before Start: each block's length, and the Ear round. */
export interface SessionLengths { seconds: number[]; earGoal: number }

export function newSession(root: NoteName, bpm: number, id: string, now = new Date().toISOString(), plan?: PlanChoice, lengths?: SessionLengths): PracticeSessionData {
  return { version: 1, id, startedAt: now, root, ...(plan ? { plan } : {}), bpm,
    ...(lengths ? { seconds: [...lengths.seconds], earGoal: lengths.earGoal } : {}), block: 0,
    elapsed: [0, 0, 0, 0], ratings: {}, attempts: [], completed: false };
}

export const validSeconds = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === PRACTICE_BLOCKS.length
  && value.every((n) => Number.isInteger(n) && n >= 30 && n <= MAX_BLOCK_SECONDS);

/** The length of a block in this session. */
export const blockSeconds = (session: PracticeSessionData, block: number): number =>
  (session.seconds ?? DEFAULT_SECONDS)[block];

/** The Ear block of this session is a round of questions (true), or runs on the clock as it used to. */
export const earByCount = (session: PracticeSessionData, block: number): boolean =>
  block === EAR_BLOCK && session.earGoal !== undefined;

/**
 * A block is played through: its round is answered, or its time is up.
 * `bonus` is time the player added while playing ("+1 min"); it moves where
 * the block ends, never what counts as a full block.
 */
export function blockDone(session: PracticeSessionData, block: number, bonus = 0): boolean {
  if (earByCount(session, block)) return session.attempts.length >= session.earGoal!;
  return session.elapsed[block] >= blockSeconds(session, block) + bonus;
}

/** Add playing time to the current block, up to `limit` seconds in that block. */
export function advanceTime(session: PracticeSessionData, seconds: number, limit = blockSeconds(session, session.block)): PracticeSessionData {
  if (session.finishedAt || seconds <= 0 || !Number.isFinite(seconds)) return session;
  const elapsed = [...session.elapsed];
  // A session saved before lengths could be set is never logged past the old fixed length.
  const hard = session.seconds ? MAX_BLOCK_SECONDS : PRACTICE_BLOCKS[session.block].seconds;
  const cap = Math.max(elapsed[session.block], Math.min(limit, hard));
  elapsed[session.block] = Math.min(cap, elapsed[session.block] + seconds);
  return { ...session, elapsed };
}

export function finishSession(session: PracticeSessionData, now = new Date().toISOString()): PracticeSessionData {
  return { ...session, finishedAt: now,
    completed: PRACTICE_BLOCKS.every((_, index) => blockDone(session, index)) };
}

/** Take a session back out of the log: it was discarded, or is being carried on. */
export function dropHistory(history: PracticeSessionData[], id: string): PracticeSessionData[] {
  return history.filter((item) => item.id !== id);
}

export function saveHistory(history: PracticeSessionData[], session: PracticeSessionData): PracticeSessionData[] {
  return [session, ...history.filter((item) => item.id !== session.id)].slice(0, 100);
}

const semitones = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 11;

export function validSession(value: unknown): value is PracticeSessionData {
  if (!value || typeof value !== 'object') return false;
  const s = value as PracticeSessionData;
  return s.version === 1 && typeof s.id === 'string' && typeof s.startedAt === 'string'
    && Number.isFinite(Date.parse(s.startedAt)) && ALL_NOTES.includes(s.root)
    && Number.isFinite(s.bpm) && s.bpm >= 40 && s.bpm <= 180
    && Number.isInteger(s.block) && s.block >= 0 && s.block < 4
    && Array.isArray(s.elapsed) && s.elapsed.length === 4
    && (s.seconds === undefined || validSeconds(s.seconds))
    && (s.earGoal === undefined || (Number.isInteger(s.earGoal) && s.earGoal >= 1 && s.earGoal <= 50))
    // A session with its own lengths can be played past them; one without never could.
    && s.elapsed.every((n, i) => Number.isFinite(n) && n >= 0 && n <= (s.seconds ? MAX_BLOCK_SECONDS : PRACTICE_BLOCKS[i].seconds))
    && s.ratings !== null && typeof s.ratings === 'object'
    && Object.values(s.ratings).every((r) => typeof r === 'string' && ['clean', 'working', 'revisit'].includes(r))
    && (s.plan === undefined || validChoice(s.plan))
    && Array.isArray(s.attempts) && s.attempts.every((a) => a && semitones(a.interval)
      && semitones(a.answer) && a.correct === (a.interval === a.answer))
    && typeof s.completed === 'boolean'
    && (s.finishedAt === undefined || (typeof s.finishedAt === 'string' && Number.isFinite(Date.parse(s.finishedAt))));
}

export function loadDraft(): PracticeSessionData | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    return validSession(value) && !value.finishedAt ? value : null;
  } catch { return null; }
}

export function loadHistory(): PracticeSessionData[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(validSession).filter((s) => s.finishedAt).slice(0, 100) : [];
  } catch { return []; }
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
