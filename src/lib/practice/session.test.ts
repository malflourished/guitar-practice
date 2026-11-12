import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionReducer, type SessionState } from './reducer';
import { DRAFT_KEY, HISTORY_KEY, PRACTICE_BLOCKS, SESSION_SECONDS, finishSession, loadDraft, loadHistory, newSession, saveHistory, validSession } from './session';
import { EMPTY_SCORE, recordResult, validScore } from './score';

const now = '2026-11-11T03:00:00.000Z';
const start = (): SessionState => sessionReducer({ data: null, status: 'ready' }, { type: 'start', root: 'A', bpm: 72, id: 'session-1', now });
afterEach(() => vi.unstubAllGlobals());

describe('ten minutes of active practice', () => {
  it('completes all four blocks with exactly 600 seconds and saves the assessments', () => {
    let state = start();
    expect(SESSION_SECONDS).toBe(600);
    for (let block = 0; block < 4; block++) {
      state = sessionReducer(state, { type: 'counting' });
      state = sessionReducer(state, { type: 'tick', seconds: 4 });
      expect(state.data?.elapsed[block]).toBe(0);
      state = sessionReducer(state, { type: 'running' });
      for (let t = 0; t < PRACTICE_BLOCKS[block].seconds * 4; t++) {
        state = sessionReducer(state, { type: 'tick', seconds: 0.25 });
      }
      expect(state.status).toBe('review');
      state = sessionReducer(state, { type: 'rate', rating: 'clean' });
      state = sessionReducer(state, { type: 'tick', seconds: 90 });
      expect(state.data?.elapsed[block]).toBe(PRACTICE_BLOCKS[block].seconds);
      if (block < 3) state = sessionReducer(state, { type: 'next' });
    }
    state = sessionReducer(state, { type: 'finish', now });
    expect(state.status).toBe('finished');
    expect(state.data?.completed).toBe(true);
    expect(state.data?.elapsed.reduce((sum, n) => sum + n, 0)).toBe(600);
    expect(Object.values(state.data!.ratings)).toEqual(['clean', 'clean', 'clean', 'clean']);
    expect(validSession(state.data)).toBe(true);
  });

  it('never counts loading, pauses, rest between blocks, or time after finishing', () => {
    let state = start();
    expect(sessionReducer(state, { type: 'tick', seconds: 20 })).toBe(state);
    state = sessionReducer(state, { type: 'running' });
    state = sessionReducer(state, { type: 'tick', seconds: 10 });
    state = sessionReducer(state, { type: 'pause' });
    expect(sessionReducer(state, { type: 'tick', seconds: 999 })).toBe(state);
    expect(sessionReducer(state, { type: 'running' })).toBe(state); // stale audio callback
    state = sessionReducer(state, { type: 'resume' });
    state = sessionReducer(state, { type: 'running' });
    state = sessionReducer(state, { type: 'tick', seconds: 500 });
    expect(state.data?.elapsed).toEqual([120, 0, 0, 0]);
    expect(state.status).toBe('review');
    expect(sessionReducer(state, { type: 'tick', seconds: 999 })).toBe(state);
    state = sessionReducer(state, { type: 'finish', now });
    expect(state.data?.completed).toBe(false);
    expect(sessionReducer(state, { type: 'tick', seconds: 600 })).toBe(state);
  });

  it('cannot skip an unfinished block, and ignores invalid elapsed time', () => {
    let state = start();
    expect(sessionReducer(state, { type: 'next' })).toBe(state);
    state = sessionReducer(state, { type: 'running' });
    for (const seconds of [-1, NaN, Infinity]) state = sessionReducer(state, { type: 'tick', seconds });
    expect(state.data?.elapsed).toEqual([0, 0, 0, 0]);
  });

  it('accepts quiz results only in the active ear block', () => {
    const attempt = { interval: 3, answer: 7, correct: false };
    const state = start();
    expect(sessionReducer(state, { type: 'answer', attempt })).toBe(state);
    const ear: SessionState = { status: 'running', data: { ...state.data!, block: 2, elapsed: [120, 180, 0, 0] } };
    expect(sessionReducer(ear, { type: 'answer', attempt }).data?.attempts).toEqual([attempt]);
    expect(sessionReducer({ ...ear, status: 'paused' }, { type: 'answer', attempt }).data?.attempts).toEqual([]);
  });
});

describe('saved practice', () => {
  it('recovers a draft and tolerates corrupt or unavailable storage', () => {
    const session = newSession('D', 84, 'saved', now);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === DRAFT_KEY ? JSON.stringify(session) : null });
    expect(loadDraft()).toEqual(session);
    vi.stubGlobal('localStorage', { getItem: () => '{broken' });
    expect(loadDraft()).toBeNull();
    expect(loadHistory()).toEqual([]);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage disabled'); } });
    expect(loadDraft()).toBeNull();
  });

  it('deduplicates saves, caps history, and excludes unfinished or corrupt results', () => {
    const result = finishSession(newSession('A', 72, 'same', now), now);
    expect(saveHistory([result], result)).toEqual([result]);
    expect(saveHistory(Array.from({ length: 100 }, (_, i) => ({ ...result, id: String(i) })), result)).toHaveLength(100);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === HISTORY_KEY ? JSON.stringify([result, newSession('A', 72, 'draft', now), { bad: true }]) : null });
    expect(loadHistory()).toEqual([result]);
  });

  it('rejects malformed time, root, ratings, and fabricated quiz correctness', () => {
    const session = newSession('A', 72, 'saved', now);
    expect(validSession(session)).toBe(true);
    for (const patch of [{ root: 'H' }, { elapsed: [999, 0, 0, 0] }, { block: 4 }, { bpm: -2 }, { ratings: null }, { ratings: { 1: 'perfect' } }, { attempts: [{ interval: 3, answer: 7, correct: true }] }]) {
      expect(validSession({ ...session, ...patch })).toBe(false);
    }
  });
});

describe('interval scores', () => {
  it('records misses, breaks streaks, and preserves the best streak', () => {
    let score = recordResult(recordResult(EMPTY_SCORE, true), true);
    score = recordResult(score, false);
    expect(score).toEqual({ correct: 2, total: 3, streak: 0, best: 2 });
    expect(validScore(score)).toBe(true);
    expect(validScore({ ...score, correct: 99 })).toBe(false);
    expect(validScore({ ...score, streak: -1 })).toBe(false);
  });
});

describe('the plan shown before Start', () => {
  it('lists four blocks in order, each with a line on what and why, adding up to ten minutes', () => {
    expect(PRACTICE_BLOCKS.map((b) => b.id)).toEqual(['roots', 'scale', 'ear', 'changes']);
    expect(PRACTICE_BLOCKS.map((b) => b.seconds / 60)).toEqual([2, 3, 2, 3]);
    expect(PRACTICE_BLOCKS.reduce((sum, b) => sum + b.seconds, 0)).toBe(600);
    for (const b of PRACTICE_BLOCKS) { expect(b.does.length).toBeGreaterThan(0); expect(b.why.length).toBeGreaterThan(0); }
  });
});
