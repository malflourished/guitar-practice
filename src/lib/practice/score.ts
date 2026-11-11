export interface Score { correct: number; total: number; streak: number; best: number }
export const EMPTY_SCORE: Score = { correct: 0, total: 0, streak: 0, best: 0 };
export function validScore(value: unknown): value is Score {
  if (!value || typeof value !== 'object') return false;
  const s = value as Score;
  return [s.correct, s.total, s.streak, s.best].every(n => Number.isInteger(n) && n >= 0)
    && s.correct <= s.total && s.streak <= s.best && s.best <= s.correct;
}
export function recordResult(score: Score, correct: boolean): Score {
  const streak = correct ? score.streak + 1 : 0;
  return { correct: score.correct + Number(correct), total: score.total + 1, streak, best: Math.max(score.best, streak) };
}
