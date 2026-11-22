import { describe, expect, it } from 'vitest';
import { finishSession, newSession, validSession, type PracticeSessionData, type Rating } from './session';
import { EAR_LADDER, EAR_NAMES, EAR_TOP, addDays, drawEar, earPool, earRound, earWeights, lapKey, localDay, pickedLine, planFor, stepKey, validChoice } from './plan';

const DAY1 = '2026-11-16';
/** A moment on a local day; midday unless told otherwise. */
const at = (day: string, hour = 12) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
};

interface Outcome { ratings?: Partial<Record<number, Rating>>; ear?: [correct: number, total: number]; finished?: boolean; hour?: number }

/** One session on `day` that follows that day's plan. 10 of 12 by ear unless told otherwise. */
function practise(history: PracticeSessionData[], day: string, outcome: Outcome = {}): PracticeSessionData[] {
  const plan = planFor(day, history);
  const { ratings = {}, ear = [10, 12], finished = true, hour = 12 } = outcome;
  const [correct, total] = ear;
  const attempts = Array.from({ length: total }, (_, i) => {
    const interval = plan.ear[i % 3];
    return { interval, answer: i < correct ? interval : plan.ear[(i + 1) % 3], correct: i < correct };
  });
  const base = newSession(plan.root, 72, `${day}-${hour}`, at(day, hour), { box: plan.box, quality: plan.quality, ear: plan.ear, track: plan.track });
  const session = finishSession({ ...base, block: 3, elapsed: finished ? [120, 180, 120, 180] : [120, 60, 0, 0], ratings, attempts }, at(day, hour));
  expect(validSession(session)).toBe(true);
  return [session, ...history];
}

/** Practise on consecutive days from DAY1, one outcome a day; returns the history. */
function run(outcomes: Outcome[], history: PracticeSessionData[] = [], from = DAY1): PracticeSessionData[] {
  return outcomes.reduce((all, outcome, i) => practise(all, addDays(from, i), outcome), history);
}

describe('days', () => {
  it('names local days and steps across months and years', () => {
    expect(localDay(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(localDay(at('2026-11-16', 0))).toBe('2026-11-16');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('the first day', () => {
  it('is box 1 in A minor with the old three intervals, and says why', () => {
    const plan = planFor(DAY1, []);
    expect(plan).toMatchObject({ root: 'A', quality: 'minor', box: 1, ear: [3, 7, 10], lap: 0 });
    expect(plan.line).toBe('Box 1 opens a lap of the five boxes in A minor. Ear: ♭3, 5 and ♭7, the minor 7th chord.');
    expect(validChoice({ box: plan.box, quality: plan.quality, ear: plan.ear, track: plan.track })).toBe(true);
  });
});

describe('the box rotates from day to day', () => {
  it('goes 1 to 5 over five clean days, then starts a lap in the relative major', () => {
    const boxes: number[] = [];
    let history: PracticeSessionData[] = [];
    for (let i = 0; i < 5; i++) {
      boxes.push(planFor(addDays(DAY1, i), history).box);
      history = practise(history, addDays(DAY1, i), { ratings: { 0: 'clean', 1: 'clean', 3: 'clean' } });
    }
    expect(boxes).toEqual([1, 2, 3, 4, 5]);
    const lap2 = planFor(addDays(DAY1, 5), history);
    expect(lap2).toMatchObject({ root: 'C', quality: 'major', box: 1, lap: 1 });
    expect(lap2.line).toContain('New lap: C major is the same five shapes as A minor, heard from C. Box 1.');
  });

  it('moves up a fourth for the third lap', () => {
    const history = run(Array.from({ length: 10 }, () => ({})));
    const lap3 = planFor(addDays(DAY1, 10), history);
    expect(lap3).toMatchObject({ root: 'D', quality: 'minor', box: 1, lap: 2 });
    expect(lap3.line).toContain('New lap, new key: D minor, a fourth up from A minor. Box 1.');
  });

  it('says which box came before', () => {
    const history = run([{}, {}]);
    expect(planFor(addDays(DAY1, 2), history).line).toContain('Box 3: you finished box 2 last time.');
  });

  it('covers 24 keys in 24 laps, each minor key followed by its relative major', () => {
    const keys = Array.from({ length: 24 }, (_, lap) => lapKey(lap));
    expect(new Set(keys.map((k) => `${k.root} ${k.quality}`)).size).toBe(24);
    expect(keys.slice(0, 6).map((k) => `${k.root} ${k.quality}`)).toEqual(['A minor', 'C major', 'D minor', 'F major', 'G minor', 'A# major']);
    expect(lapKey(24)).toEqual(lapKey(0));
  });

  it('counts practice days, not calendar days: a missed day skips nothing', () => {
    let history = practise([], DAY1);
    history = practise(history, addDays(DAY1, 2));
    expect(planFor(addDays(DAY1, 3), history).box).toBe(3);
    expect(planFor(addDays(DAY1, 6), history).box).toBe(3);
  });

  it('counts a session played in another key', () => {
    const plan = planFor(DAY1, []);
    const other = finishSession({ ...newSession('E', 72, 'other', at(DAY1), { box: plan.box, quality: 'major', ear: plan.ear, track: plan.track }),
      block: 3, elapsed: [120, 180, 120, 180] }, at(DAY1));
    expect(planFor(addDays(DAY1, 1), [other])).toMatchObject({ box: 2, root: 'A', quality: 'minor' });
  });
});

describe('the ratings are used', () => {
  it('brings a box back tomorrow when one of its blocks was marked hard, and names the block', () => {
    let history = practise([], DAY1, { ratings: { 1: 'clean', 3: 'revisit' } });
    const again = planFor(addDays(DAY1, 1), history);
    expect(again).toMatchObject({ box: 1, boxNote: { kind: 'again', blocks: [3] } });
    expect(again.line).toContain('Box 1 again: you marked Solo “Revisit this”.');
    history = practise(history, addDays(DAY1, 1), { ratings: { 3: 'clean' } });
    expect(planFor(addDays(DAY1, 2), history).box).toBe(2);
  });

  it('names every block marked hard', () => {
    const history = practise([], DAY1, { ratings: { 0: 'revisit', 1: 'revisit', 3: 'revisit' } });
    expect(planFor(addDays(DAY1, 1), history).line).toContain('you marked Roots, Scale and Solo “Revisit this”');
  });

  it('moves on after "Felt clean", "Getting there" or no rating', () => {
    for (const ratings of [{ 1: 'clean' }, { 0: 'working', 1: 'working', 3: 'working' }, {}] as Partial<Record<number, Rating>>[]) {
      expect(planFor(addDays(DAY1, 1), practise([], DAY1, { ratings })).box).toBe(2);
    }
  });

  it('ignores a hard Ear rating when deciding the box', () => {
    expect(planFor(addDays(DAY1, 1), practise([], DAY1, { ratings: { 2: 'revisit' } })).box).toBe(2);
  });

  it('moves on after three days on one box, whatever the rating', () => {
    const hard = { ratings: { 1: 'revisit' as Rating } };
    const history = run([hard, hard]);
    expect(planFor(addDays(DAY1, 2), history).box).toBe(1);
    const moved = planFor(addDays(DAY1, 3), run([hard], history, addDays(DAY1, 2)));
    expect(moved).toMatchObject({ box: 2, boxNote: { kind: 'limit', from: 1 } });
    expect(moved.line).toContain('Three days on box 1 is enough for now; it returns next lap. Box 2 today.');
  });

  it('repeats the plan after a session that stopped early, without counting it toward the limit', () => {
    const hard = { ratings: { 1: 'revisit' as Rating } };
    let history = run([hard, { finished: false }]);
    const again = planFor(addDays(DAY1, 2), history);
    expect(again).toMatchObject({ box: 1, boxNote: { kind: 'unfinished' } });
    expect(again.line).toContain('Box 1 again: the last session stopped early.');
    history = run([hard], history, addDays(DAY1, 2));
    expect(planFor(addDays(DAY1, 3), history).box).toBe(1); // two finished days so far
    history = run([hard], history, addDays(DAY1, 3));
    expect(planFor(addDays(DAY1, 4), history).box).toBe(2);
  });
});

describe('the plan holds still for the day', () => {
  it('does not change after a session today', () => {
    const before = planFor(DAY1, []);
    const history = practise([], DAY1, { ear: [12, 12] });
    expect(planFor(DAY1, history)).toEqual(before);
    expect(planFor(addDays(DAY1, 1), history)).not.toEqual(before);
  });

  it('lets the last finished session of a day decide', () => {
    const hardThenClean = practise(practise([], DAY1, { ratings: { 1: 'revisit' }, hour: 9 }), DAY1, { ratings: { 1: 'clean' }, hour: 18 });
    expect(planFor(addDays(DAY1, 1), hardThenClean).box).toBe(2);
    const cleanThenHard = practise(practise([], DAY1, { ratings: { 1: 'clean' }, hour: 9 }), DAY1, { ratings: { 1: 'revisit' }, hour: 18 });
    expect(planFor(addDays(DAY1, 1), cleanThenHard).box).toBe(1);
  });

  it('needs only the last day practised, so a history cut short gives the same plan', () => {
    const history = run(Array.from({ length: 23 }, (_, i) => ({ ear: [i % 3 ? 12 : 10, 12] as [number, number], ratings: i % 4 ? {} : { 1: 'revisit' as Rating } })));
    const day = addDays(DAY1, 23);
    const full = planFor(day, history);
    expect(full.lap).toBeGreaterThan(1);
    expect(full.ear).not.toEqual([3, 7, 10]);
    expect(planFor(day, history.slice(0, 1))).toEqual(full);
    expect(planFor(addDays(day, 9), history.slice(0, 1))).toEqual(planFor(addDays(day, 9), history));
  });

  it('gives the same plan whatever order the history is stored in', () => {
    const history = run([{}, { ratings: { 1: 'revisit' } }, { ear: [12, 12] }, {}, { finished: false }, {}]);
    const day = addDays(DAY1, 6);
    expect(planFor(day, [...history].reverse())).toEqual(planFor(day, history));
    expect(planFor(day, history)).toEqual(planFor(day, history));
  });
});

describe('a key other than the plan’s', () => {
  it('names the picked key in the line, and keeps the box and the ear set', () => {
    const plan = planFor('2026-11-21', []);
    expect(plan.line).toBe(`Box 1 opens a lap of the five boxes in A minor. ${plan.earLine}`);
    expect(pickedLine(plan, 'D minor')).toBe(`Box 1 in D minor. ${plan.earLine}`);
  });
});

describe('stepping through the keys', () => {
  it('goes along the key menu: minor from C, then major, and round again', () => {
    expect(stepKey('A', 'minor', 1)).toEqual(['A#', 'minor']);
    expect(stepKey('A', 'minor', -1)).toEqual(['G#', 'minor']);
    expect(stepKey('B', 'minor', 1)).toEqual(['C', 'major']);
    expect(stepKey('C', 'major', -1)).toEqual(['B', 'minor']);
    expect(stepKey('B', 'major', 1)).toEqual(['C', 'minor']);
    expect(stepKey('C', 'minor', -1)).toEqual(['B', 'major']);
    expect(stepKey('E', 'major', 24)).toEqual(['E', 'major']);
  });
});

describe('key names', () => {
  it('are spelled by the caller: the sixth lap is B♭ major, not A# major', () => {
    const history = run(Array.from({ length: 25 }, () => ({})));
    const plan = planFor(addDays(DAY1, 25), history, (root, quality) => (root === 'A#' && quality === 'major' ? 'B♭' : root));
    expect(plan).toMatchObject({ root: 'A#', quality: 'major', box: 1, lap: 5 });
    expect(plan.line).toContain('New lap: B♭ major is the same five shapes as G minor, heard from B♭.');
    expect(plan.preview).toContain('a new lap, box 1 in B♭ major');
  });
});

describe('the finished screen', () => {
  it('says what the ratings and the score did to the next session', () => {
    const next = (outcomes: Outcome[]) => planFor(addDays(DAY1, outcomes.length), run(outcomes)).preview;
    expect(next([{ ear: [11, 12] }])).toBe('Next time: box 2. The major third joins the ear set.');
    expect(next([{ ratings: { 3: 'revisit' } }])).toBe('Next time: box 1 again, because you marked Solo “Revisit this”. The same three intervals by ear.');
    expect(next([{ finished: false, ear: [2, 2] }])).toBe('Next time: box 1 again, to play it through. The same three intervals by ear.');
    expect(next([{}, {}, {}, {}, {}])).toBe('Next time: a new lap, box 1 in C major. The same three intervals by ear.');
    expect(next([{ ear: [12, 12] }, { ear: [10, 12] }])).toBe('Next time: box 3. The ear set moves to 3, 5 and ♭7.');
  });
});

describe('a week away', () => {
  it('repeats the last box and ear set, then carries on', () => {
    let history = run([{}, {}, { ear: [12, 12] }]);
    const last = addDays(DAY1, 2);
    expect(planFor(addDays(last, 1), history)).toMatchObject({ box: 4, ear: [3, 4, 7] });
    expect(planFor(addDays(last, 6), history).box).toBe(4);
    const back = planFor(addDays(last, 9), history);
    expect(back).toMatchObject({ box: 3, ear: [3, 7, 10], boxNote: { kind: 'away', days: 9 } });
    expect(back.line).toBe('9 days away: box 3 again to warm back in. Ear: the last set again.');
    history = practise(history, addDays(last, 9), { ear: [12, 12] });
    expect(planFor(addDays(last, 10), history)).toMatchObject({ box: 4, ear: [3, 4, 7] });
  });
});

describe('the ear ladder', () => {
  it('adds one interval after each day at 90% or better, each with its neighbours', () => {
    const sets: number[][] = [];
    let history: PracticeSessionData[] = [];
    for (let i = 0; i < 7; i++) {
      sets.push(planFor(addDays(DAY1, i), history).ear);
      history = practise(history, addDays(DAY1, i), { ear: [11, 12] });
    }
    expect(sets).toEqual([[3, 7, 10], [3, 4, 7], [4, 6, 7], [4, 5, 6], [7, 9, 10], [2, 3, 4], [9, 10, 11]]);
    expect(planFor(addDays(DAY1, 1), history.slice(-1)).line).toContain('Ear: the major third joins, after 11 of 12.');
    expect(planFor(addDays(DAY1, 2), history.slice(-2)).line).toContain('Ear: the tritone joins, after 11 of 12.');
  });

  it('rotates through all nine once the ladder is complete', () => {
    let history = run(Array.from({ length: 7 }, () => ({ ear: [12, 12] as [number, number] })));
    const heard = new Set<number>();
    for (let i = 7; i < 16; i++) {
      const plan = planFor(addDays(DAY1, i), history);
      expect(plan.earNote.kind).toBe('rotate');
      plan.ear.forEach((n) => heard.add(n));
      history = practise(history, addDays(DAY1, i), { ear: [12, 12] });
    }
    expect([...heard].sort((a, b) => a - b)).toEqual([...EAR_LADDER].sort((a, b) => a - b));
    expect(earPool(6)).toHaveLength(9);
    expect(EAR_LADDER.every((n) => n in EAR_NAMES)).toBe(true);
  });

  it('lets the score decide: a good rating cannot promote, a hard one can hold back', () => {
    const next = (outcome: Outcome) => planFor(addDays(DAY1, 1), practise([], DAY1, outcome));
    expect(next({ ratings: { 2: 'clean' }, ear: [6, 10] })).toMatchObject({ ear: [3, 7, 10], earNote: { kind: 'same', why: 'score' } });
    expect(next({ ratings: { 2: 'revisit' }, ear: [12, 12] })).toMatchObject({ ear: [3, 7, 10], earNote: { kind: 'same', why: 'rating' } });
    expect(next({ ratings: { 2: 'clean' }, ear: [5, 5] })).toMatchObject({ ear: [3, 7, 10], earNote: { kind: 'same', why: 'few' } });
    expect(next({ ear: [10, 12] })).toMatchObject({ ear: [3, 7, 10], earNote: { kind: 'same', why: 'zone' } });
    expect(next({ ear: [9, 10] })).toMatchObject({ ear: [3, 4, 7], earNote: { kind: 'joins', interval: 4 } });
    expect(next({ ear: [6, 10] }).line).toContain('Ear: the same three, after 6 of 10; 9 in 10 moves on.');
    expect(next({ ear: [10, 12] }).line).toContain('Ear: the same three, after 10 of 12; 9 in 10 brings in the major third.');
  });

  it('rotates without adding anything between 70% and 90%', () => {
    const history = run([{ ear: [12, 12] }, { ear: [10, 12] }]);
    const plan = planFor(addDays(DAY1, 2), history);
    expect(plan).toMatchObject({ ear: [4, 7, 10], earNote: { kind: 'rotate' } });
    expect(plan.line).toContain('Ear: 3, 5 and ♭7, next in the rotation.');
  });

  it('adds up the answers of every session that day', () => {
    const twice = practise(practise([], DAY1, { ear: [5, 5], hour: 9 }), DAY1, { ear: [5, 5], hour: 18 });
    expect(planFor(addDays(DAY1, 1), twice).ear).toEqual([3, 4, 7]);
  });

  it('keeps its own track: the box can repeat while the ear moves on', () => {
    const plan = planFor(addDays(DAY1, 1), practise([], DAY1, { ratings: { 1: 'revisit' }, ear: [12, 12] }));
    expect(plan).toMatchObject({ box: 1, ear: [3, 4, 7] });
  });
});

describe('sessions saved before plans', () => {
  it('can unlock the major third once and do not move the box', () => {
    const old = [0, 1, 2].map((i) => {
      const session = newSession('E', 72, `old-${i}`, at(addDays(DAY1, i)));
      const attempts = Array.from({ length: 12 }, () => ({ interval: 3, answer: 3, correct: true }));
      return finishSession({ ...session, block: 3, elapsed: [120, 180, 120, 180], attempts }, at(addDays(DAY1, i)));
    });
    expect(old.every(validSession)).toBe(true);
    expect(planFor(addDays(DAY1, 3), old)).toMatchObject({ box: 1, lap: 0, ear: [3, 4, 7], boxNote: { kind: 'first' } });
  });
});

describe('saved plans', () => {
  it('rejects a malformed plan and accepts any interval up to a major seventh', () => {
    const track = { lap: 3, box: 1, streak: 0, stage: 2, offset: 1 };
    const good = { box: 2, quality: 'major' as const, ear: [4, 6, 7], track };
    const session = newSession('A', 72, 'saved', at(DAY1), good);
    expect(validSession(session)).toBe(true);
    expect(validSession({ ...session, attempts: [{ interval: 6, answer: 11, correct: false }] })).toBe(true);
    const start = { lap: 0, box: 0, streak: 0, stage: 0, offset: 0 };
    for (const plan of [{ ...good, box: 0 }, { ...good, box: 6 }, { ...good, box: 3 }, { ...good, quality: 'dorian' },
      { ...good, ear: [3, 3, 7] }, { ...good, ear: [4, 6] }, { ...good, ear: [3, 7, 10] }, { ...good, ear: [1, 3, 7] },
      { ...good, track: undefined }, { ...good, track: { ...track, streak: 3 } }, { ...good, track: { ...track, stage: 7 } },
      { ...good, track: { ...track, lap: -1 } }, { box: 1, quality: 'minor', ear: [3, 7, 10], track: { ...start, offset: 3 } }, null]) {
      expect(validSession({ ...session, plan })).toBe(false);
    }
    expect(validSession({ ...session, plan: { box: 1, quality: 'minor', ear: [3, 7, 10], track: start } })).toBe(true);
    expect(validSession({ ...session, attempts: [{ interval: 12, answer: 12, correct: true }] })).toBe(false);
  });
});

describe('120 days of mixed practice', () => {
  it('always gives a valid plan, brings every hard box back, and never skips or strands a box', () => {
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
    const ratings: (Rating | undefined)[] = ['clean', 'working', 'revisit', undefined];
    let history: PracticeSessionData[] = [];
    const seen = new Set<number>();
    let daysOnBox = 0;
    for (let i = 0; i < 120; i++) {
      const day = addDays(DAY1, i);
      const plan = planFor(day, history);
      expect(validChoice({ box: plan.box, quality: plan.quality, ear: plan.ear, track: plan.track })).toBe(true);
      expect(plan.line.length).toBeGreaterThan(20);
      seen.add(plan.box);
      daysOnBox += 1;
      expect(daysOnBox).toBeLessThanOrEqual(12);
      const total = pick([4, 8, 10, 12, 14]);
      const outcome: Outcome = { finished: random() > 0.15, ear: [Math.round(total * pick([0.5, 0.75, 0.85, 1])), total],
        ratings: Object.fromEntries([0, 1, 2, 3].map((b) => [b, pick(ratings)]).filter(([, r]) => r)) };
      history = practise(history, day, outcome);
      const next = planFor(addDays(day, 1), history);
      const hardBox = [0, 1, 3].some((b) => outcome.ratings![b] === 'revisit');
      const [correct] = outcome.ear!;
      const earHeld = total < 6 || correct / total < 0.7 || outcome.ratings![2] === 'revisit';
      if (earHeld) expect(next.ear).toEqual(plan.ear);
      if (!outcome.finished) expect([next.lap, next.box]).toEqual([plan.lap, plan.box]);
      else if (!hardBox || next.boxNote.kind === 'limit') expect(next.box).toBe(plan.box % 5 + 1);
      else expect([next.lap, next.box, next.boxNote.kind]).toEqual([plan.lap, plan.box, 'again']);
      if (next.box !== plan.box) daysOnBox = 0;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(planFor(addDays(DAY1, 120), history).lap).toBeGreaterThan(8);
  });
});

describe('starting further up the ear ladder', () => {
  it('opens more intervals on the first day, and says so', () => {
    const plan = planFor(DAY1, [], undefined, 2);
    expect(plan.track.stage).toBe(2);
    expect(earPool(plan.track.stage)).toHaveLength(5);
    expect(plan.ear).toHaveLength(3);
    expect(validChoice({ box: plan.box, quality: plan.quality, ear: plan.ear, track: plan.track })).toBe(true);
    expect(plan.line).toContain('Ear: 5 intervals, most often');
    expect(planFor(DAY1, [], undefined, EAR_TOP).line).toContain('Ear: 9 intervals');
  });

  it('never goes past the whole ladder, and ignores nonsense', () => {
    expect(planFor(DAY1, [], undefined, 99).track.stage).toBe(EAR_TOP);
    for (const start of [-3, NaN, 0]) expect(planFor(DAY1, [], undefined, start).track.stage).toBe(0);
  });

  it('only ever raises the stage: a ladder that has climbed further is left alone', () => {
    // Four days at 12 of 12 unlock four more intervals.
    const history = run(Array.from({ length: 4 }, () => ({ ear: [12, 12] as [number, number] })));
    const own = planFor(addDays(DAY1, 4), history);
    expect(own.track.stage).toBe(4);
    expect(planFor(addDays(DAY1, 4), history, undefined, 2).track).toEqual(own.track);
    expect(planFor(addDays(DAY1, 4), history, undefined, 2).line).toBe(own.line);
  });

  it('carries on from the stage a session was played at', () => {
    // Day 1 at stage 4 (seven intervals), saved with the session; the setting is then put back.
    const first = planFor(DAY1, [], undefined, 4);
    const attempts = Array.from({ length: 10 }, () => ({ interval: first.ear[0], answer: first.ear[0], correct: true }));
    const base = newSession(first.root, 72, 'raised', at(DAY1), { box: first.box, quality: first.quality, ear: first.ear, track: first.track });
    const session = finishSession({ ...base, block: 3, elapsed: [120, 180, 120, 180], attempts }, at(DAY1));
    expect(validSession(session)).toBe(true);
    const next = planFor(addDays(DAY1, 1), [session]);
    expect(next.track.stage).toBe(5); // 10 of 10 brought in one more
    expect(validChoice({ box: next.box, quality: next.quality, ear: next.ear, track: next.track })).toBe(true);
  });
});

describe('the questions of an ear round', () => {
  /** A repeatable stand-in for Math.random. */
  const seeded = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  it('asks the day\'s three twice as often as the rest of the unlocked intervals', () => {
    const pool = earPool(4);
    const focus = [pool[2], pool[3], pool[4]];
    expect(earWeights(pool, focus)).toEqual([1, 1, 2, 2, 2, 1, 1]);
    expect(earWeights(earPool(0), earPool(0))).toEqual([2, 2, 2]);
    const weights = earWeights(pool, focus);
    const random = seeded(7);
    const counts = pool.map(() => 0);
    let previous: number | null = null;
    let run = 0;
    for (let i = 0; i < 10_000; i++) {
      const next = drawEar(weights, previous, run, random);
      run = next === previous ? run + 1 : 1;
      previous = next;
      counts[next] += 1;
    }
    expect(counts.every((count) => count > 0)).toBe(true);
    const focusShare = (counts[2] + counts[3] + counts[4]) / 10_000;
    expect(focusShare).toBeGreaterThan(0.55); // 6 parts in 10, less a little for the no-three-in-a-row rule
    expect(focusShare).toBeLessThan(0.65);
  });

  it('never asks the same interval three times running, yet allows it twice', () => {
    const weights = [2, 2, 2];
    const random = seeded(11);
    let previous: number | null = null;
    let run = 0;
    let longest = 0;
    for (let i = 0; i < 5000; i++) {
      const next = drawEar(weights, previous, run, random);
      run = next === previous ? run + 1 : 1;
      previous = next;
      longest = Math.max(longest, run);
    }
    expect(longest).toBe(2);
  });

  it('always lands inside the pool, at either end of the draw', () => {
    expect(drawEar([1, 2, 1], null, 0, () => 0)).toBe(0);
    expect(drawEar([1, 2, 1], null, 0, () => 0.999999)).toBe(2);
    expect(drawEar([1, 2, 1], 2, 2, () => 0.999999)).toBe(1);
    expect(drawEar([3], 0, 5, () => 0.5)).toBe(0);
  });
});

describe('a dealt ear round', () => {
  const seeded = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const countOf = (round: number[], size: number) => Array.from({ length: size }, (_, i) => round.filter((pick) => pick === i).length);

  it('asks each of three intervals three or four times in ten, never leaving one out', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const round = earRound([2, 2, 2], 10, seeded(seed));
      expect(round).toHaveLength(10);
      expect(countOf(round, 3).sort()).toEqual([3, 3, 4]);
    }
  });

  it('asks every one of nine intervals, and one of the day\'s three twice', () => {
    const weights = earWeights(earPool(EAR_TOP), [earPool(EAR_TOP)[0], earPool(EAR_TOP)[1], earPool(EAR_TOP)[2]]);
    for (let seed = 1; seed <= 200; seed++) {
      const counts = countOf(earRound(weights, 10, seeded(seed)), 9);
      expect(counts.every((n) => n >= 1)).toBe(true);
      expect(counts.slice(3)).toEqual([1, 1, 1, 1, 1, 1]);
      expect(counts.slice(0, 3).sort()).toEqual([1, 1, 2]);
    }
  });

  it('leans on the day\'s three among five intervals', () => {
    const counts = countOf(earRound([1, 2, 2, 2, 1], 10, seeded(3)), 5);
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(10);
    expect(counts[0]).toBeGreaterThanOrEqual(1);
    expect(counts[4]).toBeGreaterThanOrEqual(1);
    expect(counts[1] + counts[2] + counts[3]).toBeGreaterThanOrEqual(7);
  });

  it('never deals the same interval three times running', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const round = earRound([2, 2, 2], 10, seeded(seed));
      expect(round.some((pick, i) => i >= 2 && pick === round[i - 1] && pick === round[i - 2])).toBe(false);
    }
  });

  it('is empty when there is nothing to ask', () => {
    expect(earRound([], 10)).toEqual([]);
    expect(earRound([2, 2, 2], 0)).toEqual([]);
  });
});
