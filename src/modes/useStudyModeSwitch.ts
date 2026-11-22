import { ALL_NOTES } from '../lib/colors';
import type { UseInstrument } from '../hooks/useInstrument';
import type { StudyMode } from '../types/music';
import { getEffectiveKeyMode, isSingleRootMode, toSingleRoot } from './studyModes';
import type { ModeStates } from './types';

/** Switching modes: stop the sound and carry the key across. */
export function useStudyModeSwitch(
  { studyMode, setStudyMode, keyState, scales, progressions, theory }: ModeStates,
  audio: UseInstrument,
) {
  const { activeNotes, setActiveNotes, rootNote, keyCenter, setKeyCenter, keyMode, setKeyMode } = keyState;
  return (mode: StudyMode) => {
    if (mode === studyMode) return;
    audio.stopAll();
    setStudyMode(mode);
    // In Scales and Progressions the scale or the progression says major or
    // minor. Leaving them, that goes with the key to the next mode.
    if (studyMode === 'scales' || studyMode === 'progressions') {
      setKeyMode(getEffectiveKeyMode(studyMode, scales.scaleQuality, progressions.activeProgression.keyMode, keyMode));
    }
    if (isSingleRootMode(mode)) {
      if (studyMode === 'chords' && mode !== 'chords' && rootNote !== keyCenter) {
        // Browsing a diatonic chord borrowed the root; coming out of Chords
        // returns home to the key center.
        setActiveNotes(new Set([keyCenter]));
      } else {
        const next = toSingleRoot(activeNotes);
        setActiveNotes(next);
        const nextRoot = ALL_NOTES.find((note) => next.has(note));
        if (nextRoot && nextRoot !== keyCenter) setKeyCenter(nextRoot);
      }
    }
    if (mode === 'progressions') {
      progressions.setProgressionStepIndex(0);
    }
    if (mode !== 'theory') {
      theory.setTheoryShowFretboard(false);
    }
  };
}
