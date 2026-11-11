import type { NoteName } from '../../types/music';
import { ALL_NOTES } from '../colors';

export const PRACTICE_BLOCKS = [
  { id: 'roots', title: 'Find your bearings', short: 'Roots', seconds: 120,
    detail: 'Find the root and fifth. Let your ears settle into the key.' },
  { id: 'scale', title: 'Connect the notes', short: 'Scale', seconds: 180,
    detail: 'Loop a minor pentatonic shape, up and down, in eighth notes.' },
  { id: 'ear', title: 'Hear the distance', short: 'Ear', seconds: 120,
    detail: 'Recognize the minor third, perfect fifth, and minor seventh.' },
  { id: 'changes', title: 'Make it musical', short: 'Changes', seconds: 180,
    detail: 'Play over i–iv–V. Land on a chord tone when the harmony changes.' },
] as const;
export const SESSION_SECONDS = PRACTICE_BLOCKS.reduce((sum, block) => sum + block.seconds, 0);
export type Rating = 'clean' | 'working' | 'revisit';
export interface EarAttempt { interval: number; answer: number; correct: boolean }
export interface PracticeSessionData {
  version: 1;
  id: string;
  startedAt: string;
  root: NoteName;
  bpm: number;
  block: number;
  elapsed: number[];
  ratings: Partial<Record<number, Rating>>;
  attempts: EarAttempt[];
  finishedAt?: string;
  completed: boolean;
}
export const DRAFT_KEY = 'vibrato:practice-draft-v1';
export const HISTORY_KEY = 'vibrato:practice-history-v1';

export function newSession(root: NoteName, bpm: number, id: string, now = new Date().toISOString()): PracticeSessionData {
  return { version: 1, id, startedAt: now, root, bpm, block: 0,
    elapsed: [0, 0, 0, 0], ratings: {}, attempts: [], completed: false };
}

export function advanceTime(session: PracticeSessionData, seconds: number): PracticeSessionData {
  if (session.finishedAt || seconds <= 0 || !Number.isFinite(seconds)) return session;
  const elapsed = [...session.elapsed];
  elapsed[session.block] = Math.min(PRACTICE_BLOCKS[session.block].seconds, elapsed[session.block] + seconds);
  return { ...session, elapsed };
}

export function finishSession(session: PracticeSessionData, now = new Date().toISOString()): PracticeSessionData {
  return { ...session, finishedAt: now,
    completed: session.elapsed.every((elapsed, index) => elapsed >= PRACTICE_BLOCKS[index].seconds) };
}

export function saveHistory(history: PracticeSessionData[], session: PracticeSessionData): PracticeSessionData[] {
  return [session, ...history.filter((item) => item.id !== session.id)].slice(0, 100);
}

export function validSession(value: unknown): value is PracticeSessionData {
  if (!value || typeof value !== 'object') return false;
  const s = value as PracticeSessionData;
  return s.version === 1 && typeof s.id === 'string' && typeof s.startedAt === 'string'
    && Number.isFinite(Date.parse(s.startedAt)) && ALL_NOTES.includes(s.root)
    && Number.isFinite(s.bpm) && s.bpm >= 40 && s.bpm <= 180
    && Number.isInteger(s.block) && s.block >= 0 && s.block < 4
    && Array.isArray(s.elapsed) && s.elapsed.length === 4
    && s.elapsed.every((n, i) => Number.isFinite(n) && n >= 0 && n <= PRACTICE_BLOCKS[i].seconds)
    && s.ratings !== null && typeof s.ratings === 'object'
    && Object.values(s.ratings).every((r) => typeof r === 'string' && ['clean', 'working', 'revisit'].includes(r))
    && Array.isArray(s.attempts) && s.attempts.every((a) => a && [3, 7, 10].includes(a.interval)
      && [3, 7, 10].includes(a.answer) && a.correct === (a.interval === a.answer))
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
