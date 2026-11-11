import { advanceTime, finishSession, newSession, PRACTICE_BLOCKS, type PracticeSessionData, type Rating, type EarAttempt } from './session';
import type { NoteName } from '../../types/music';

export type SessionStatus = 'ready' | 'paused' | 'loading' | 'counting' | 'running' | 'review' | 'finished';
export interface SessionState { data: PracticeSessionData | null; status: SessionStatus }
export type SessionAction =
  | { type: 'start'; root: NoteName; bpm: number; id: string; now: string }
  | { type: 'resume' | 'counting' | 'running' | 'pause' | 'next' | 'reset' }
  | { type: 'tick'; seconds: number }
  | { type: 'rate'; rating: Rating }
  | { type: 'answer'; attempt: EarAttempt }
  | { type: 'finish'; now: string };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (action.type === 'reset') return { data: null, status: 'ready' };
  if (action.type === 'start') return { data: newSession(action.root, action.bpm, action.id, action.now), status: 'loading' };
  const data = state.data;
  if (!data || state.status === 'finished') return state;
  switch (action.type) {
    case 'resume': return state.status === 'paused' ? { ...state, status: 'loading' } : state;
    case 'counting': return state.status === 'loading' ? { ...state, status: 'counting' } : state;
    case 'running': return ['loading', 'counting'].includes(state.status) ? { ...state, status: 'running' } : state;
    case 'pause': return ['loading', 'counting', 'running'].includes(state.status) ? { ...state, status: 'paused' } : state;
    case 'tick': {
      if (state.status !== 'running') return state;
      const next = advanceTime(data, action.seconds);
      return { data: next, status: next.elapsed[next.block] >= PRACTICE_BLOCKS[next.block].seconds ? 'review' : 'running' };
    }
    case 'next': return state.status === 'review' && data.block < 3
      ? { data: { ...data, block: data.block + 1 }, status: 'loading' } : state;
    case 'rate': return { ...state, data: { ...data, ratings: { ...data.ratings, [data.block]: action.rating } } };
    case 'answer': return state.status === 'running' && data.block === 2
      ? { ...state, data: { ...data, attempts: [...data.attempts, action.attempt] } } : state;
    case 'finish': return { data: finishSession(data, action.now), status: 'finished' };
  }
}
