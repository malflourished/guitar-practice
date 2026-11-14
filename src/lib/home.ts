import type { ProgressionDef, StudyMode } from '../types/music';

/**
 * The Home screen (roadmap package Q): what it offers and where each choice
 * lands. Pure, so the routing is tested without drawing anything.
 */

export type HomeChoiceId = 'practice' | 'explore' | 'learn';

export interface HomeChoice {
  id: HomeChoiceId;
  title: string;
  /** One line, in the app's own voice. */
  blurb: string;
}

export const HOME_CHOICES: readonly HomeChoice[] = [
  {
    id: 'practice',
    title: 'Practice',
    blurb: 'A short session with a plan. Each block says what to play and why.',
  },
  {
    id: 'explore',
    title: 'Explore',
    blurb: 'A progression picked at random, ready to play over.',
  },
  {
    id: 'learn',
    title: 'Learn',
    blurb: 'Theory: how keys, chords and scales fit together.',
  },
];

/** What a mode is called on screen: its id with a capital. */
export function modeLabel(mode: StudyMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** The primary button's words: "Continue · Scales". */
export function continueLabel(mode: StudyMode): string {
  return `Continue · ${modeLabel(mode)}`;
}

export interface HomeRoute {
  mode: StudyMode;
  /** Explore also sets the progression. */
  progressionId?: string;
}

/** Where a choice lands. Explore opens the progression it showed. */
export function homeRoute(choice: HomeChoiceId, exploreId: string): HomeRoute {
  switch (choice) {
    case 'practice':
      return { mode: 'practice' };
    case 'explore':
      return { mode: 'progressions', progressionId: exploreId };
    case 'learn':
      return { mode: 'theory' };
  }
}

/**
 * A random progression, never one of `avoid` (the one just played, the last
 * one offered) unless the library has no other. `random` returns [0, 1).
 */
export function pickExploreProgression(
  progressions: readonly ProgressionDef[],
  avoid: readonly (string | null | undefined)[] = [],
  random: () => number = Math.random,
): ProgressionDef {
  const fresh = progressions.filter((p) => !avoid.includes(p.id));
  const pool = fresh.length > 0 ? fresh : progressions;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** A progression as Explore shows it: its name, and its numerals. */
export function exploreTeaser(progression: ProgressionDef): {
  name: string;
  numerals: string;
} {
  return {
    name: progression.nickname ?? progression.label,
    numerals: progression.label,
  };
}

/** What Esc is up against when it might go Home. */
export interface EscapeContext {
  key: string;
  defaultPrevented: boolean;
  /** Ctrl, Alt or Meta is held. */
  modified: boolean;
  /** The key was pressed in a text field or a select. */
  inField: boolean;
  /** A menu or dialog is open: Esc closes it first. */
  overlayOpen: boolean;
  /** Settings, Focus or the drawer is open: Esc closes it first. */
  layerOpen: boolean;
  /** Already Home. */
  home: boolean;
}

/** Esc goes Home only when it has nothing nearer to close. */
export function escapeGoesHome(context: EscapeContext): boolean {
  return (
    context.key === 'Escape' &&
    !context.defaultPrevented &&
    !context.modified &&
    !context.inField &&
    !context.overlayOpen &&
    !context.layerOpen &&
    !context.home
  );
}
