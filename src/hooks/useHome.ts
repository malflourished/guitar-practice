import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  escapeGoesHome,
  homeRoute,
  pickExploreProgression,
  type HomeChoiceId,
} from '../lib/home';
import { PROGRESSIONS, getProgressionById } from '../lib/music';
import type { ProgressionsState } from '../modes/progressions/useProgressionsState';
import type { StudyMode } from '../types/music';
import type { FrameState } from './useFrameState';

interface HomeInput {
  home: boolean;
  setHome: Dispatch<SetStateAction<boolean>>;
  switchMode: (mode: StudyMode) => void;
  progressions: ProgressionsState;
  stopAll: () => void;
  frame: Pick<FrameState, 'settingsOpen' | 'focusMode' | 'sideState' | 'setFocusMode'>;
}

/** A text field or a select: Esc belongs to it. */
function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('textarea, select, [contenteditable=""], [contenteditable="true"]')) {
    return true;
  }
  const input = target.closest('input');
  return Boolean(input && !['range', 'checkbox', 'radio', 'button'].includes(input.type));
}

/**
 * Home is a place in the frame, not a study mode: the app still opens on the
 * last mode, and Home is one click (the wordmark) or Esc away. Leaving it by
 * any route puts a study mode back. Explore's pick is made when Home opens and
 * shown on its card, so the card promises what the click opens.
 */
export function useHome({
  home,
  setHome,
  switchMode,
  progressions,
  stopAll,
  frame,
}: HomeInput) {
  const [exploreId, setExploreId] = useState(
    () => pickExploreProgression(PROGRESSIONS, [progressions.progressionId]).id,
  );

  const goHome = () => {
    if (home) return;
    // Home has no Play control: whatever was sounding stops with the mode.
    stopAll();
    frame.setFocusMode(false);
    setExploreId(
      pickExploreProgression(PROGRESSIONS, [progressions.progressionId, exploreId]).id,
    );
    setHome(true);
  };

  /** Leave Home for a mode (a tab, Continue, a choice). */
  const openMode = (mode: StudyMode) => {
    switchMode(mode);
    setHome(false);
  };

  const choose = (choice: HomeChoiceId) => {
    const route = homeRoute(choice, exploreId);
    if (route.progressionId) progressions.handleProgressionChange(route.progressionId);
    openMode(route.mode);
  };

  // Esc, when it has nothing nearer to close.
  const goHomeRef = useRef(goHome);
  const layerOpen = frame.settingsOpen || frame.focusMode || frame.sideState === 'drawer';
  const layerRef = useRef(layerOpen);
  useEffect(() => {
    goHomeRef.current = goHome;
    layerRef.current = layerOpen;
  });
  useEffect(() => {
    if (home) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const go = escapeGoesHome({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        modified: event.metaKey || event.ctrlKey || event.altKey,
        inField: inTextField(event.target),
        overlayOpen: document.querySelector('[role="dialog"]:not([hidden])') !== null,
        layerOpen: layerRef.current,
        home: false,
      });
      if (go) goHomeRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [home]);

  return {
    explore: getProgressionById(exploreId) ?? PROGRESSIONS[0],
    goHome,
    openMode,
    choose,
  };
}
