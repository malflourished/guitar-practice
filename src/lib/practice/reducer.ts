import { EAR_BLOCK, MAX_BLOCK_SECONDS, advanceTime, blockDone, blockSeconds, earByCount, finishSession, newSession, PRACTICE_BLOCKS, type PracticeSessionData, type Rating, type EarAttempt, type SessionLengths } from './session';
import type { NoteName } from '../../types/music';
import { choiceOf, type KeyQuality, type PlanChoice } from './plan';

export type SessionStatus = 'ready' | 'paused' | 'loading' | 'counting' | 'running' | 'review' | 'finished';
export interface SessionState {
  data: PracticeSessionData | null;
  status: SessionStatus;
  /**
   * "Play this block again": the block is already played through, and now
   * runs until the player moves on. The time is logged (up to the cap) but
   * nothing ends by itself.
   */
  open?: boolean;
  /** Seconds added to the current block with "+1 min". */
  bonus?: number;
}
export type SessionAction =
  | { type: 'start'; root: NoteName; bpm: number; id: string; now: string; plan?: PlanChoice; lengths?: SessionLengths }
  | { type: 'resume' | 'counting' | 'running' | 'pause' | 'next' | 'skip' | 'again' | 'recount' | 'extend' | 'reopen' | 'reset' }
  | { type: 'tick'; seconds: number }
  | { type: 'rekey'; root: NoteName; quality: KeyQuality }
  | { type: 'rate'; rating: Rating }
  | { type: 'answer'; attempt: EarAttempt }
  | { type: 'finish'; now: string };

const LAST_BLOCK = PRACTICE_BLOCKS.length - 1;
/** One press of "+1 min". */
export const EXTEND_SECONDS = 60;

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (action.type === 'reset') return { data: null, status: 'ready' };
  if (action.type === 'start') return { data: newSession(action.root, action.bpm, action.id, action.now, action.plan, action.lengths), status: 'loading' };
  const data = state.data;
  // "Keep practicing" on the summary: the session is open again where it stopped.
  if (action.type === 'reopen') {
    if (!data || state.status !== 'finished') return state;
    const open: PracticeSessionData = { ...data, completed: false };
    delete open.finishedAt;
    return { data: open, status: blockDone(open, open.block) ? 'review' : 'paused' };
  }
  if (!data || state.status === 'finished') return state;
  const bonus = state.bonus ?? 0;
  const byCount = earByCount(data, data.block);
  switch (action.type) {
    case 'resume': return state.status === 'paused' ? { ...state, status: 'loading' } : state;
    case 'counting': return state.status === 'loading' ? { ...state, status: 'counting' } : state;
    case 'running': return ['loading', 'counting'].includes(state.status) ? { ...state, status: 'running' } : state;
    case 'pause': return ['loading', 'counting', 'running'].includes(state.status) ? { ...state, status: 'paused' } : state;
    case 'tick': {
      if (state.status !== 'running') return state;
      // A round of questions and a second go have no clock to run out.
      const untimed = state.open || byCount;
      const next = advanceTime(data, action.seconds, untimed ? MAX_BLOCK_SECONDS : blockSeconds(data, data.block) + bonus);
      return { ...state, data: next, status: !untimed && blockDone(next, next.block, bonus) ? 'review' : 'running' };
    }
    case 'next': return state.status === 'review' && data.block < LAST_BLOCK
      ? { data: { ...data, block: data.block + 1 }, status: 'loading' } : state;
    // Leave a block before it is played through (or end a second go at it). The last block ends with Finish.
    case 'skip': return state.status !== 'review' && data.block < LAST_BLOCK
      ? { data: { ...data, block: data.block + 1 }, status: 'loading' } : state;
    // Another go at a block that is played through.
    case 'again': return state.status === 'review' ? { ...state, status: 'loading', open: true } : state;
    // The loop starts over while it plays (the notes are asked for again): count in again, off the clock.
    case 'recount': return ['counting', 'running'].includes(state.status) ? { ...state, status: 'loading' } : state;
    // One more minute on a block that runs on the clock, while it is still going.
    case 'extend': {
      // Not for a session from before lengths could be set: its log stops at the old length.
      if (state.status === 'review' || state.open || byCount || !data.seconds) return state;
      const room = MAX_BLOCK_SECONDS - blockSeconds(data, data.block);
      return bonus + EXTEND_SECONDS <= room ? { ...state, bonus: bonus + EXTEND_SECONDS } : state;
    }
    // The app's key changed: a session that is still open is in the new key, and is logged in it.
    case 'rekey': return { ...state, data: { ...data, root: action.root, plan: { ...choiceOf(data), quality: action.quality } } };
    case 'rate': return { ...state, data: { ...data, ratings: { ...data.ratings, [data.block]: action.rating } } };
    case 'answer': {
      if (state.status !== 'running' || data.block !== EAR_BLOCK) return state;
      const next = { ...data, attempts: [...data.attempts, action.attempt] };
      // The last answer of a round ends the block; the screen still shows whether it was right.
      return { ...state, data: next, status: byCount && !state.open && blockDone(next, next.block) ? 'review' : 'running' };
    }
    case 'finish': return { data: finishSession(data, action.now), status: 'finished' };
  }
}
