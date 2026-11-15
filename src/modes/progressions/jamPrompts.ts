import { GUIDE_FOCUS, type TargetFocus } from '../../lib/music/landingTargets';

/**
 * One prompt per pass (package P4, docs/specs/P3-targets.md): a single thing
 * to try each time round the form, drawn from the roadmap and from Discover's
 * sparks and lenses. Each prompt also says what the rings on the neck show
 * (`focus`), so the neck and the sentence agree. Pure helpers.
 */

export interface JamPrompt {
  id: string;
  /** One line, at most `PROMPT_MAX_LENGTH` characters: it never wraps. */
  text: string;
  /** What the targets on the neck show while this is the prompt. */
  focus: TargetFocus;
  /**
   * `sevenths`: only for a form where every chord has a 7th.
   * `inPlace`: not while the form climbs the neck, which already says where the hand is.
   */
  needs?: 'sevenths' | 'inPlace';
}

/** The strings by index: 0 is the high e. */
const B_STRING = 1;
const G_STRING = 2;

/**
 * In the order of a lesson: where to aim, then how to phrase, by turns, and
 * last the test with the help taken away.
 */
export const JAM_PROMPTS: readonly JamPrompt[] = [
  { id: 'thirds', text: 'Land on the 3rd of each chord on beat 1', focus: { kind: 'thirds' } },
  { id: 'silence', text: 'Two beats of silence after every phrase', focus: GUIDE_FOCUS },
  { id: 'changes', text: 'Play only the notes that change', focus: { kind: 'changes' } },
  { id: 'string-b', text: 'One string only: the B string', focus: { kind: 'string', string: B_STRING }, needs: 'inPlace' },
  { id: 'sevenths', text: 'Land on the 7th of each chord on beat 1', focus: { kind: 'sevenths' }, needs: 'sevenths' },
  { id: 'repeat', text: 'One short idea. Repeat it, change one note', focus: GUIDE_FOCUS },
  { id: 'string-g', text: 'One string only: the G string', focus: { kind: 'string', string: G_STRING }, needs: 'inPlace' },
  { id: 'late', text: 'Start every phrase after beat 1', focus: GUIDE_FOCUS },
  { id: 'long', text: 'No note shorter than a half note', focus: GUIDE_FOCUS },
  { id: 'ear', text: 'Eyes off the neck: find the 3rds by ear', focus: { kind: 'none' } },
];

/**
 * The strip is 301 px wide at its narrowest (a 960 px window); the line over it
 * has 330. This many characters fit there on one line, with "Next: " in front.
 */
export const PROMPT_MAX_LENGTH = 42;
/** A prompt stays long enough to read it, try it and hear the result. */
export const PROMPT_MIN_BARS = 8;

/** Rotate: a new prompt when the last has had its bars. Hold: keep the one shown. */
export type PromptMode = 'off' | 'rotate' | 'hold';

export interface PromptContext {
  /** Every chord of the form has a 7th. */
  allSevenths: boolean;
  /** "Move along the neck" is moving the form. */
  climbing: boolean;
}

/** The prompts that suit this form, in order. */
export function eligiblePrompts({ allSevenths, climbing }: PromptContext): JamPrompt[] {
  return JAM_PROMPTS.filter(
    (prompt) =>
      !(prompt.needs === 'sevenths' && !allSevenths) && !(prompt.needs === 'inPlace' && climbing),
  );
}

/**
 * How many passes a prompt lasts: as many as make eight bars. One for the
 * 12-bar blues, two for a four-bar loop, four for a two-bar vamp. It always
 * changes at the top of the form.
 */
export function promptPasses(bars: number): number {
  return Math.max(1, Math.ceil(PROMPT_MIN_BARS / Math.max(1, Math.floor(bars))));
}

/**
 * Where in `prompts` to start from a saved prompt: that prompt, or, when it
 * does not suit this form, the next in the lesson's order that does. Nothing
 * saved starts at the first.
 */
export function resumeIndex(savedId: string | null, prompts: readonly JamPrompt[]): number {
  if (prompts.length === 0) return -1;
  const from = Math.max(0, JAM_PROMPTS.findIndex((prompt) => prompt.id === savedId));
  for (let offset = 0; offset < JAM_PROMPTS.length; offset += 1) {
    const candidate = JAM_PROMPTS[(from + offset) % JAM_PROMPTS.length];
    const index = prompts.findIndex((prompt) => prompt.id === candidate.id);
    if (index >= 0) return index;
  }
  return 0;
}

/** "This prompt began at this pass": what the rotation counts from. */
export interface PromptAnchor {
  id: string | null;
  pass: number;
}

export interface PromptRotation {
  mode: PromptMode;
  prompts: readonly JamPrompt[];
  anchor: PromptAnchor;
  /** Bars in the form. */
  bars: number;
}

/** The prompt of a pass, or null when prompts are off. */
export function promptAt(pass: number, { mode, prompts, anchor, bars }: PromptRotation): JamPrompt | null {
  if (mode === 'off' || prompts.length === 0) return null;
  const start = resumeIndex(anchor.id, prompts);
  if (mode === 'hold') return prompts[start];
  const turns = Math.floor(Math.max(0, pass - anchor.pass) / promptPasses(bars));
  return prompts[(start + turns) % prompts.length];
}

/** The prompt after this one, for a click on the line. */
export function promptAfter(id: string | null, prompts: readonly JamPrompt[]): JamPrompt | null {
  if (prompts.length === 0) return null;
  return prompts[(resumeIndex(id, prompts) + 1) % prompts.length];
}

export interface PromptLine {
  prompt: JamPrompt;
  /** The next prompt, shown a bar early: "Next: …". */
  upcoming: boolean;
}

/**
 * What the line above the form strip says. Stopped and during the count-in:
 * the prompt of the first pass. In the last bar before the prompt changes
 * (never with Loop off, when the music stops there): the next one, early.
 */
export function promptLine(
  clock: { playing: boolean; countIn: boolean; stepIndex: number; pass: number },
  loop: boolean,
  rotation: PromptRotation,
): PromptLine | null {
  const sounding = clock.playing && !clock.countIn;
  const now = promptAt(sounding ? clock.pass : rotation.anchor.pass, rotation);
  if (!now) return null;
  if (sounding && loop && clock.stepIndex === rotation.bars - 1) {
    const next = promptAt(clock.pass + 1, rotation);
    if (next && next.id !== now.id) return { prompt: next, upcoming: true };
  }
  return { prompt: now, upcoming: false };
}
