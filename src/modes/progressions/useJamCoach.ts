import { useCallback, useMemo, useState } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { PlayPrompts } from '../../lib/audio/playOptions';
import {
  GUIDE_FOCUS,
  chordTargetTones,
  landingCue,
  type LandingTarget,
  type ResolvedProgressionStep,
} from '../../lib/music';
import type { StudyMode } from '../../types/music';
import {
  eligiblePrompts,
  promptAfter,
  promptAt,
  promptLine,
  type PromptRotation,
} from './jamPrompts';
import type { JamLoopState } from './useJamLoop';
import type { ProgressionViews } from './useProgressionViews';

interface JamCoachInput {
  studyMode: StudyMode;
  steps: ResolvedProgressionStep[];
  jam: JamLoopState;
  tempo: number;
  /** Play menu: Loop, Targets, Prompts. */
  loop: boolean;
  targetsOn: boolean;
  promptMode: PlayPrompts;
  /** "Move along the neck" is moving the form (what Play chose, or would choose). */
  climbing: boolean;
  views: ProgressionViews;
}

/** The prompt line above the form strip. */
export interface CoachPrompt {
  text: string;
  /** Shown a bar early, before it takes over: "Next: …". */
  upcoming: boolean;
  /** Stopped, or not yet this pass's: drawn in the quiet tone. */
  quiet: boolean;
  /** A click moves to the next prompt. */
  onNext: () => void;
}

const isIdOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const NO_TARGETS: LandingTarget[] = [];

/**
 * What the jam loop tells the player to aim for (P3 and P4): the rings on the
 * neck for the chord that is coming, and the prompt of the pass, which also
 * decides what the rings show. The prompt on screen is saved, so the next Play
 * starts where this one stopped. See docs/specs/P3-targets.md.
 */
export function useJamCoach({
  studyMode,
  steps,
  jam,
  tempo,
  loop,
  targetsOn,
  promptMode,
  climbing,
  views,
}: JamCoachInput) {
  const active = studyMode === 'progressions';
  const [savedId, setSavedId] = usePersistentState<string | null>('play-prompt', null, isIdOrNull);
  // The pass the saved prompt began in: 0 unless a click or the rotation moved on while playing.
  const [anchorPass, setAnchorPass] = useState(0);

  const prompts = useMemo(
    () =>
      eligiblePrompts({
        allSevenths:
          steps.length > 0 &&
          steps.every((step) => chordTargetTones(step).some((tone) => tone.role === 'seventh')),
        climbing,
      }),
    [steps, climbing],
  );
  const rotation: PromptRotation = useMemo(
    () => ({ mode: promptMode, prompts, anchor: { id: savedId, pass: anchorPass }, bars: steps.length }),
    [promptMode, prompts, savedId, anchorPass, steps.length],
  );

  const sounding = jam.playing && !jam.countIn;
  const current = active ? promptAt(sounding ? jam.pass : anchorPass, rotation) : null;
  const currentId = current?.id ?? null;

  // Keep what is on screen saved, so the next Play starts from it; and count
  // each Play's passes from 0 again. Both adjust state while rendering (React's
  // pattern for state that follows a prop), so no render shows a stale prompt.
  if (sounding && currentId !== null && currentId !== savedId) {
    setSavedId(currentId);
    setAnchorPass(jam.pass);
  } else if (!jam.playing && anchorPass !== 0) {
    setAnchorPass(0);
  }

  const next = useCallback(() => {
    const after = promptAfter(currentId, prompts);
    if (!after) return;
    setSavedId(after.id);
    setAnchorPass(sounding ? jam.pass : 0);
  }, [currentId, prompts, sounding, jam.pass, setSavedId]);

  const line = active ? promptLine(jam, loop, rotation) : null;
  const prompt: CoachPrompt | null = line
    ? {
        text: line.prompt.text,
        upcoming: line.upcoming,
        quiet: line.upcoming || !jam.playing,
        onNext: next,
      }
    : null;

  const { windowsForPass, displayProgressionChordViews } = views;
  const cue = useMemo(() => {
    if (!active || !targetsOn) return null;
    return landingCue({
      clock: jam,
      chords: steps,
      loop,
      bpm: tempo,
      windowAt: (pass, stepIndex) => windowsForPass(pass)[stepIndex] ?? null,
      focusAt: (pass) => promptAt(pass, rotation)?.focus ?? GUIDE_FOCUS,
    });
  }, [active, targetsOn, jam, steps, loop, tempo, windowsForPass, rotation]);

  // "Next: F7. Land on A (3) or E♭ (♭7)." for a screen reader, and the next change's tooltip.
  const targetsLabel = useMemo(() => {
    if (!cue) return undefined;
    const step = steps[cue.stepIndex];
    const names = displayProgressionChordViews[cue.stepIndex]?.noteLabels;
    const seen = new Set<string>();
    const notes = cue.targets
      .filter((target) => !seen.has(target.note) && seen.add(target.note))
      .map((target) => `${names?.get(target.note) ?? target.note} (${target.label})`);
    return `${jam.countIn ? 'Start' : 'Next'}: ${step?.chordName ?? ''}. Land on ${notes.join(' or ')}.`;
  }, [cue, steps, displayProgressionChordViews, jam.countIn]);

  return {
    targets: cue?.targets ?? NO_TARGETS,
    targetsArriving: cue?.phase === 'arriving',
    targetsLabel,
    prompt,
  };
}

export type JamCoach = ReturnType<typeof useJamCoach>;
