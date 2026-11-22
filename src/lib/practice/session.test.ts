import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionReducer, type SessionState } from './reducer';
import { DEFAULT_SECONDS, DRAFT_KEY, EAR_ROUND, HISTORY_KEY, MAX_BLOCK_SECONDS, PRACTICE_BLOCKS, SESSION_SECONDS, blockDone, blockSeconds, dropHistory, finishSession, loadDraft, loadHistory, newSession, saveHistory, validSession, type SessionLengths } from './session';
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

  /** A session as the app starts one now: with its own lengths and an ear round. */
  const startWith = (lengths: SessionLengths = { seconds: DEFAULT_SECONDS, earGoal: EAR_ROUND }): SessionState =>
    sessionReducer({ data: null, status: 'ready' }, { type: 'start', root: 'A', bpm: 72, id: 'session-2', now, lengths });
  /** Answer the ear round, every question right. */
  const answerRound = (from: SessionState): SessionState => {
    let state = from;
    while (state.status === 'running') state = sessionReducer(state, { type: 'answer', attempt: { interval: 7, answer: 7, correct: true } });
    return state;
  };
  /** Run the current block to the end of its time. */
  const playThrough = (from: SessionState): SessionState => {
    let state = sessionReducer(from, { type: 'running' });
    const seconds = blockSeconds(state.data!, state.data!.block);
    for (let t = 0; t < seconds; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    return state;
  };

  it('skips to the next block on request, and logs the session as short', () => {
    let state = sessionReducer(start(), { type: 'running' });
    state = sessionReducer(state, { type: 'tick', seconds: 30 });
    state = sessionReducer(state, { type: 'skip' });
    expect(state.status).toBe('loading');
    expect(state.data?.block).toBe(1);
    expect(state.data?.elapsed).toEqual([30, 0, 0, 0]);
    // Paused counts too: a player who stopped to think can still move on.
    state = sessionReducer(sessionReducer(state, { type: 'running' }), { type: 'pause' });
    state = sessionReducer(state, { type: 'skip' });
    expect(state.data?.block).toBe(2);
    state = sessionReducer(state, { type: 'skip' });
    expect(state.data?.block).toBe(3);
    // The last block has nowhere to skip to: it ends with Finish.
    expect(sessionReducer(state, { type: 'skip' })).toBe(state);
    state = sessionReducer(state, { type: 'finish', now });
    expect(state.data?.completed).toBe(false);
    expect(validSession(state.data)).toBe(true);
  });

  it('skip is not the way out of a finished block: that is next', () => {
    const review = playThrough(start());
    expect(review.status).toBe('review');
    expect(sessionReducer(review, { type: 'skip' })).toBe(review);
    expect(sessionReducer(review, { type: 'next' }).data?.block).toBe(1);
  });

  it('plays a finished block again: it runs until the player moves on, and the time is logged', () => {
    const review = playThrough(startWith());
    expect(sessionReducer(sessionReducer(startWith(), { type: 'running' }), { type: 'again' }).open).toBeUndefined();
    let state = sessionReducer(review, { type: 'again' });
    expect(state.status).toBe('loading');
    expect(state.open).toBe(true);
    state = sessionReducer(state, { type: 'counting' });
    state = sessionReducer(state, { type: 'tick', seconds: 4 });
    expect(state.data?.elapsed[0]).toBe(120); // the count-in is not playing time
    state = sessionReducer(state, { type: 'running' });
    for (let t = 0; t < 200; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    state = sessionReducer(state, { type: 'tick', seconds: NaN });
    expect(state.status).toBe('running');
    expect(state.data?.elapsed[0]).toBe(320);
    // However long it goes on, no block is logged past the cap.
    for (let t = 0; t < 2000; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('running');
    expect(state.data?.elapsed[0]).toBe(MAX_BLOCK_SECONDS);
    expect(validSession(state.data)).toBe(true);
    // Moving on ends the second go; the next block runs on its own clock.
    state = sessionReducer(state, { type: 'skip' });
    expect(state.data?.block).toBe(1);
    expect(state.open).toBeUndefined();
    state = playThrough(state);
    expect(state.status).toBe('review');
    expect(state.data?.elapsed[1]).toBe(180);
  });

  it('a session from before lengths could be set is never logged past its old length', () => {
    let state = sessionReducer(sessionReducer(playThrough(start()), { type: 'again' }), { type: 'running' });
    for (let t = 0; t < 60; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('running');
    expect(state.data?.elapsed[0]).toBe(120);
    expect(validSession(state.data)).toBe(true);
    expect(sessionReducer(sessionReducer(start(), { type: 'running' }), { type: 'extend' }).bonus).toBeUndefined();
  });

  it('a full session stays complete when its last block is played again', () => {
    let state = startWith();
    for (let block = 0; block < 4; block++) {
      state = block === 2 ? answerRound(sessionReducer(state, { type: 'running' })) : playThrough(state);
      expect(state.status).toBe('review');
      if (block < 3) state = sessionReducer(state, { type: 'next' });
    }
    state = sessionReducer(sessionReducer(state, { type: 'again' }), { type: 'running' });
    state = sessionReducer(state, { type: 'tick', seconds: 45 });
    state = sessionReducer(state, { type: 'finish', now });
    expect(state.data?.completed).toBe(true);
    expect(state.data?.elapsed[3]).toBe(225);
  });

  it('runs each block for the length the player gave it', () => {
    let state = startWith({ seconds: [60, 300, 120, 180], earGoal: 10 });
    state = sessionReducer(state, { type: 'running' });
    for (let t = 0; t < 59; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('running');
    state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('review');
    state = sessionReducer(sessionReducer(state, { type: 'next' }), { type: 'running' });
    for (let t = 0; t < 299; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('running');
    expect(sessionReducer(state, { type: 'tick', seconds: 1 }).status).toBe('review');
  });

  it('adds a minute to a block while it plays, without raising what counts as a full block', () => {
    let state = sessionReducer(startWith(), { type: 'running' });
    for (let t = 0; t < 100; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    state = sessionReducer(state, { type: 'extend' });
    expect(state.bonus).toBe(60);
    for (let t = 0; t < 79; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('running'); // 179 of 180
    expect(blockDone(state.data!, 0)).toBe(true); // already a full block by the length it was given
    state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('review');
    expect(state.data?.elapsed[0]).toBe(180);
    // The minute belongs to that block only.
    expect(sessionReducer(state, { type: 'extend' })).toBe(state);
    state = sessionReducer(state, { type: 'next' });
    expect(state.bonus).toBeUndefined();
    // And it stops at the cap.
    let long = sessionReducer(startWith({ seconds: [300, 180, 120, 180], earGoal: 10 }), { type: 'running' });
    for (let presses = 0; presses < 30; presses++) long = sessionReducer(long, { type: 'extend' });
    expect(300 + (long.bonus ?? 0)).toBe(MAX_BLOCK_SECONDS);
  });

  it('ends the ear block after its round of questions, not after a time', () => {
    let state = startWith({ seconds: DEFAULT_SECONDS, earGoal: 3 });
    for (let block = 0; block < 2; block++) state = sessionReducer(playThrough(state), { type: 'next' });
    state = sessionReducer(state, { type: 'running' });
    // Ten minutes of thinking does not end it, and there is no minute to add.
    for (let t = 0; t < 600; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    expect(state.status).toBe('running');
    expect(sessionReducer(state, { type: 'extend' })).toBe(state);
    const right = { interval: 7, answer: 7, correct: true };
    const wrong = { interval: 3, answer: 7, correct: false };
    state = sessionReducer(state, { type: 'answer', attempt: right });
    state = sessionReducer(state, { type: 'answer', attempt: wrong });
    expect(state.status).toBe('running');
    expect(blockDone(state.data!, 2)).toBe(false);
    state = sessionReducer(state, { type: 'answer', attempt: right });
    expect(state.status).toBe('review');
    expect(blockDone(state.data!, 2)).toBe(true);
    // No more answers once the round is over, until it is played again.
    expect(sessionReducer(state, { type: 'answer', attempt: right })).toBe(state);
    let more = sessionReducer(sessionReducer(state, { type: 'again' }), { type: 'running' });
    more = sessionReducer(more, { type: 'answer', attempt: right });
    more = sessionReducer(more, { type: 'answer', attempt: right });
    expect(more.status).toBe('running');
    expect(more.data?.attempts).toHaveLength(5);
    expect(validSession(more.data)).toBe(true);
  });

  it('a skipped ear round makes a short session', () => {
    let state = startWith();
    for (let block = 0; block < 2; block++) state = sessionReducer(playThrough(state), { type: 'next' });
    state = sessionReducer(sessionReducer(state, { type: 'running' }), { type: 'skip' });
    state = playThrough(state);
    expect(sessionReducer(state, { type: 'finish', now }).data?.completed).toBe(false);
  });

  it('follows the app’s key while it is open, and not once it is finished', () => {
    let state = sessionReducer(sessionReducer(start(), { type: 'running' }), { type: 'tick', seconds: 10 });
    state = sessionReducer(state, { type: 'rekey', root: 'D', quality: 'major' });
    expect(state.data?.root).toBe('D');
    expect(state.data?.plan?.quality).toBe('major');
    // The clock and the place in the session are untouched.
    expect(state.status).toBe('running');
    expect(state.data?.elapsed[0]).toBe(10);
    const done = sessionReducer(state, { type: 'finish', now });
    expect(sessionReducer(done, { type: 'rekey', root: 'E', quality: 'minor' })).toBe(done);
  });

  it('counts in again when the loop starts over while it plays, off the clock', () => {
    let state = sessionReducer(start(), { type: 'running' });
    state = sessionReducer(state, { type: 'tick', seconds: 10 });
    state = sessionReducer(state, { type: 'recount' });
    expect(state.status).toBe('loading');
    state = sessionReducer(state, { type: 'tick', seconds: 5 });
    expect(state.data?.elapsed[0]).toBe(10);
    const paused = sessionReducer(sessionReducer(start(), { type: 'running' }), { type: 'pause' });
    expect(sessionReducer(paused, { type: 'recount' })).toBe(paused);
  });

  it('discards a session with reset: nothing is left to log', () => {
    const state = sessionReducer(playThrough(start()), { type: 'reset' });
    expect(state).toEqual({ data: null, status: 'ready' });
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

describe('ending a session', () => {
  const lengths = { seconds: DEFAULT_SECONDS, earGoal: EAR_ROUND };
  const begin = (): SessionState => sessionReducer({ data: null, status: 'ready' }, { type: 'start', root: 'A', bpm: 72, id: 'end', now, lengths });

  it('can be carried on from the summary: open again where it stopped, and no longer finished', () => {
    let state = sessionReducer(begin(), { type: 'running' });
    state = sessionReducer(state, { type: 'tick', seconds: 40 });
    state = sessionReducer(state, { type: 'finish', now });
    expect(state.status).toBe('finished');
    const open = sessionReducer(state, { type: 'reopen' });
    expect(open.status).toBe('paused');
    expect(open.data?.finishedAt).toBeUndefined();
    expect('finishedAt' in open.data!).toBe(false);
    expect(open.data?.elapsed[0]).toBe(40);
    expect(validSession(open.data)).toBe(true);
    // And it plays on to the end of the block as if it had never stopped.
    let on = sessionReducer(sessionReducer(open, { type: 'resume' }), { type: 'running' });
    for (let t = 0; t < 80; t++) on = sessionReducer(on, { type: 'tick', seconds: 1 });
    expect(on.status).toBe('review');
  });

  it('opens again at the rest after a block that was played through', () => {
    let state = sessionReducer(begin(), { type: 'running' });
    for (let t = 0; t < 120; t++) state = sessionReducer(state, { type: 'tick', seconds: 1 });
    state = sessionReducer(state, { type: 'finish', now });
    expect(sessionReducer(state, { type: 'reopen' }).status).toBe('review');
  });

  it('only a finished session can be opened again', () => {
    const running = sessionReducer(begin(), { type: 'running' });
    expect(sessionReducer(running, { type: 'reopen' })).toBe(running);
    expect(sessionReducer({ data: null, status: 'ready' }, { type: 'reopen' })).toEqual({ data: null, status: 'ready' });
  });

  it('comes out of the log when discarded or carried on', () => {
    const one = finishSession(newSession('A', 72, 'one', now), now);
    const two = finishSession(newSession('A', 72, 'two', now), now);
    expect(dropHistory([two, one], 'two')).toEqual([one]);
    expect(dropHistory([two, one], 'nobody')).toEqual([two, one]);
  });
});

describe('a session with its own lengths', () => {
  const lengths = { seconds: [60, 300, 120, 180], earGoal: 10 };
  const fresh = () => newSession('A', 72, 'own', now, undefined, lengths);

  it('saves the lengths and the round, and loads again', () => {
    const session = fresh();
    expect(session.seconds).toEqual([60, 300, 120, 180]);
    expect(session.earGoal).toBe(10);
    expect(validSession(session)).toBe(true);
    expect(blockSeconds(session, 1)).toBe(300);
    expect(blockSeconds(newSession('A', 72, 'old', now), 1)).toBe(180);
  });

  it('may be played past a block\'s length, up to the cap, where an older session may not', () => {
    expect(validSession({ ...fresh(), elapsed: [400, 0, 0, 0] })).toBe(true);
    expect(validSession({ ...fresh(), elapsed: [MAX_BLOCK_SECONDS + 1, 0, 0, 0] })).toBe(false);
    expect(validSession({ ...newSession('A', 72, 'old', now), elapsed: [121, 0, 0, 0] })).toBe(false);
  });

  it('rejects lengths and rounds that make no sense', () => {
    for (const seconds of [[60, 300, 120], [60, 300, 120, 5000], [0, 300, 120, 180], [60.5, 300, 120, 180], 'long']) {
      expect(validSession({ ...fresh(), seconds })).toBe(false);
    }
    for (const earGoal of [0, 2.5, 500, '10']) expect(validSession({ ...fresh(), earGoal })).toBe(false);
  });

  it('is complete when every block ran its own length and the round was answered', () => {
    const attempts = Array.from({ length: 10 }, () => ({ interval: 7, answer: 7, correct: true }));
    const full = { ...fresh(), block: 3, elapsed: [60, 300, 40, 180], attempts };
    expect(finishSession(full, now).completed).toBe(true);
    expect(finishSession({ ...full, attempts: attempts.slice(0, 9) }, now).completed).toBe(false);
    expect(finishSession({ ...full, elapsed: [60, 299, 40, 180] }, now).completed).toBe(false);
    // The defaults would have been enough for block 1, but not for the five minutes asked of block 2.
    expect(finishSession({ ...full, elapsed: [120, 180, 120, 180] }, now).completed).toBe(false);
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

  it('says who plays what in the last block', () => {
    const changes = PRACTICE_BLOCKS[3];
    expect(changes.title).toBe('Solo over the chords');
    expect(changes.does).toMatch(/^Improvise over .* while the app plays it/);
  });
});
