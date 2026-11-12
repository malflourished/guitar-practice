/**
 * The Intervals drills, in two labelled groups (roadmap package N).
 *
 * Learn is the drills where the answer is in view. Train is where the app
 * asks and you answer (Find is graded, Ear has nothing on the neck, Shell
 * chords ends in a quiz). Each drill's `line` says, in plain words, what you
 * will do there; the tabs show it under the selected drill.
 */

export type DrillId = 'see' | 'shapes' | 'find' | 'ear' | 'shell' | 'guide';
export type DrillGroupId = 'learn' | 'train';

export interface DrillDef {
  id: DrillId;
  label: string;
  group: DrillGroupId;
  line: string;
}

export const DRILL_GROUPS: { id: DrillGroupId; label: string }[] = [
  { id: 'learn', label: 'Learn' },
  { id: 'train', label: 'Train' },
];

export const DRILLS: DrillDef[] = [
  {
    id: 'see',
    label: 'See',
    group: 'learn',
    line: 'Pick one interval. See where it sits from the root, and click a dot to hear it.',
  },
  {
    id: 'shapes',
    label: 'Shapes',
    group: 'learn',
    line: 'The same interval on different pairs of strings: how its shape changes from the root.',
  },
  {
    id: 'guide',
    label: 'Guide tones',
    group: 'learn',
    line: 'Follow the 3rds and 7ths through a progression and see how little they move.',
  },
  {
    id: 'find',
    label: 'Find',
    group: 'train',
    line: 'Hear an interval above the root, then click that note on the neck.',
  },
  {
    id: 'ear',
    label: 'Ear',
    group: 'train',
    line: 'Hear two notes and name the interval. The neck stays blank.',
  },
  {
    id: 'shell',
    label: 'Shell chords',
    group: 'train',
    line: 'Root, 3rd and 7th: the three notes that name a seventh chord. See them, then build them.',
  },
];

export type ShellStepId = 'see' | 'build' | 'test';

/** The steps inside Shell chords, in the order you meet them. */
export const SHELL_STEPS: { id: ShellStepId; label: string }[] = [
  { id: 'see', label: 'See it' },
  { id: 'build', label: 'Build it' },
  { id: 'test', label: 'Test it' },
];

export function drillsInGroup(group: DrillGroupId): DrillDef[] {
  return DRILLS.filter((d) => d.group === group);
}
