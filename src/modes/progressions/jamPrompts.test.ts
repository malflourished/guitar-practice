import { describe, expect, it } from 'vitest';
import {
  JAM_PROMPTS,
  PROMPT_MAX_LENGTH,
  eligiblePrompts,
  promptAfter,
  promptAt,
  promptLine,
  promptPasses,
  resumeIndex,
  type PromptRotation,
} from './jamPrompts';

const ALL = { allSevenths: true, climbing: false };
const ids = (prompts: readonly { id: string }[]) => prompts.map((prompt) => prompt.id);
const rotation = (patch: Partial<PromptRotation> = {}): PromptRotation => ({
  mode: 'rotate',
  prompts: eligiblePrompts(ALL),
  anchor: { id: null, pass: 0 },
  bars: 12,
  ...patch,
});
const clock = (pass: number, stepIndex = 0, playing = true, countIn = false) => ({
  playing,
  countIn,
  stepIndex,
  pass,
});

describe('the prompts', () => {
  it('are the roadmap’s four and six more, in the lesson’s order, each with what the rings show', () => {
    expect(ids(JAM_PROMPTS)).toEqual([
      'thirds',
      'silence',
      'changes',
      'string-b',
      'sevenths',
      'repeat',
      'string-g',
      'late',
      'long',
      'ear',
    ]);
    const text = (id: string) => JAM_PROMPTS.find((prompt) => prompt.id === id)!.text;
    expect(text('thirds')).toBe('Land on the 3rd of each chord on beat 1');
    expect(text('changes')).toBe('Play only the notes that change');
    expect(text('string-b')).toBe('One string only: the B string');
    expect(text('silence')).toBe('Two beats of silence after every phrase');
    const focus = (id: string) => JAM_PROMPTS.find((prompt) => prompt.id === id)!.focus;
    expect(focus('thirds')).toEqual({ kind: 'thirds' });
    expect(focus('changes')).toEqual({ kind: 'changes' });
    expect(focus('string-b')).toEqual({ kind: 'string', string: 1 });
    expect(focus('string-g')).toEqual({ kind: 'string', string: 2 });
    expect(focus('sevenths')).toEqual({ kind: 'sevenths' });
    expect(focus('ear')).toEqual({ kind: 'none' });
    expect(focus('silence')).toEqual({ kind: 'guide' });
  });

  it('fit on one line, and no id is used twice', () => {
    for (const prompt of JAM_PROMPTS) {
      expect(prompt.text.length).toBeLessThanOrEqual(PROMPT_MAX_LENGTH);
    }
    expect(new Set(ids(JAM_PROMPTS)).size).toBe(JAM_PROMPTS.length);
  });

  it('leave out the 7th prompt on a form with triads, and the one-string prompts while it climbs', () => {
    expect(ids(eligiblePrompts(ALL))).toEqual(ids(JAM_PROMPTS));
    expect(ids(eligiblePrompts({ allSevenths: false, climbing: false }))).not.toContain('sevenths');
    const climbing = ids(eligiblePrompts({ allSevenths: true, climbing: true }));
    expect(climbing).not.toContain('string-b');
    expect(climbing).not.toContain('string-g');
    expect(climbing).toContain('sevenths');
    expect(eligiblePrompts({ allSevenths: false, climbing: true })).toHaveLength(7);
  });
});

describe('how they rotate', () => {
  it('a prompt lasts at least eight bars, in whole passes', () => {
    expect([1, 2, 3, 4, 5, 8, 12, 16].map(promptPasses)).toEqual([8, 4, 3, 2, 2, 1, 1, 1]);
  });

  it('the 12-bar blues: a new prompt every pass, in order, round and round', () => {
    const r = rotation();
    expect([0, 1, 2, 3].map((pass) => promptAt(pass, r)?.id)).toEqual([
      'thirds',
      'silence',
      'changes',
      'string-b',
    ]);
    expect(promptAt(10, r)?.id).toBe('thirds');
  });

  it('a four-bar loop changes every second pass, a two-bar vamp every fourth', () => {
    const four = rotation({ bars: 4 });
    expect([0, 1, 2, 3, 4].map((pass) => promptAt(pass, four)?.id)).toEqual([
      'thirds',
      'thirds',
      'silence',
      'silence',
      'changes',
    ]);
    const two = rotation({ bars: 2 });
    expect([0, 3, 4, 7, 8].map((pass) => promptAt(pass, two)?.id)).toEqual([
      'thirds',
      'thirds',
      'silence',
      'silence',
      'changes',
    ]);
  });

  it('starts from the saved prompt, or the next that suits when it does not', () => {
    const all = eligiblePrompts(ALL);
    expect(resumeIndex(null, all)).toBe(0);
    expect(resumeIndex('gone', all)).toBe(0);
    expect(all[resumeIndex('repeat', all)].id).toBe('repeat');
    // the 7th prompt on a form with triads: the next in order
    const triads = eligiblePrompts({ allSevenths: false, climbing: false });
    expect(triads[resumeIndex('sevenths', triads)].id).toBe('repeat');
    // a one-string prompt while climbing
    const climbing = eligiblePrompts({ allSevenths: true, climbing: true });
    expect(climbing[resumeIndex('string-b', climbing)].id).toBe('sevenths');
    expect(climbing[resumeIndex('string-g', climbing)].id).toBe('late');
    expect(resumeIndex('thirds', [])).toBe(-1);
    expect(promptAt(0, rotation({ anchor: { id: 'long', pass: 0 } }))?.id).toBe('long');
    expect(promptAt(1, rotation({ anchor: { id: 'long', pass: 0 } }))?.id).toBe('ear');
    expect(promptAt(2, rotation({ anchor: { id: 'long', pass: 0 } }))?.id).toBe('thirds');
  });

  it('counts from the pass a prompt began in (after a click, or the last change)', () => {
    const r = rotation({ bars: 4, anchor: { id: 'changes', pass: 5 } });
    expect([5, 6, 7].map((pass) => promptAt(pass, r)?.id)).toEqual(['changes', 'changes', 'string-b']);
    // the saved prompt moving on with the rotation gives the same answers
    const moved = rotation({ bars: 4, anchor: { id: 'string-b', pass: 7 } });
    expect([7, 8, 9].map((pass) => promptAt(pass, moved)?.id)).toEqual(['string-b', 'string-b', 'sevenths']);
  });

  it('Hold keeps the one shown; Off shows none; a click moves on, round the end', () => {
    const held = rotation({ mode: 'hold', anchor: { id: 'silence', pass: 0 } });
    expect([0, 1, 9].map((pass) => promptAt(pass, held)?.id)).toEqual(['silence', 'silence', 'silence']);
    expect(promptAt(0, rotation({ mode: 'off' }))).toBeNull();
    const all = eligiblePrompts(ALL);
    expect(promptAfter('thirds', all)?.id).toBe('silence');
    expect(promptAfter('ear', all)?.id).toBe('thirds');
    expect(promptAfter(null, all)?.id).toBe('silence');
    expect(promptAfter('thirds', [])).toBeNull();
  });
});

describe('the line above the form strip', () => {
  it('stopped and during the count-in: the prompt Play starts with', () => {
    const r = rotation({ anchor: { id: 'changes', pass: 0 } });
    expect(promptLine(clock(0, 0, false), true, r)).toEqual({ prompt: r.prompts[2], upcoming: false });
    expect(promptLine(clock(0, 0, true, true), true, r)?.prompt.id).toBe('changes');
  });

  it('in the last bar before it changes, the next prompt shows early', () => {
    const r = rotation();
    expect(promptLine(clock(0, 10), true, r)).toEqual({ prompt: r.prompts[0], upcoming: false });
    expect(promptLine(clock(0, 11), true, r)).toEqual({ prompt: r.prompts[1], upcoming: true });
    expect(promptLine(clock(1, 0), true, r)).toEqual({ prompt: r.prompts[1], upcoming: false });
    // a four-bar loop: only in the last bar of the second pass
    const four = rotation({ bars: 4 });
    expect(promptLine(clock(0, 3), true, four)?.upcoming).toBe(false);
    expect(promptLine(clock(1, 3), true, four)).toEqual({ prompt: four.prompts[1], upcoming: true });
  });

  it('never early with Loop off or on Hold, and nothing when prompts are off', () => {
    expect(promptLine(clock(0, 11), false, rotation())?.upcoming).toBe(false);
    expect(promptLine(clock(0, 11), true, rotation({ mode: 'hold' }))?.upcoming).toBe(false);
    expect(promptLine(clock(0, 11), true, rotation({ mode: 'off' }))).toBeNull();
  });
});
