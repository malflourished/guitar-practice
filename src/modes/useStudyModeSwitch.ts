import { ALL_NOTES } from '../lib/colors';
import type { UseInstrument } from '../hooks/useInstrument';
import type { StudyMode } from '../types/music';
import { isSingleRootMode, toSingleRoot } from './studyModes';
import type { ModeStates } from './types';

/** Switching modes: stop the sound and carry the key across. */
export function useStudyModeSwitch(
  { studyMode, setStudyMode, keyState, progressions, theory }: ModeStates,
  audio: UseInstrument,
) {
  const { activeNotes, setActiveNotes, rootNote, keyCenter, setKeyCenter } = keyState;
  return (mode: StudyMode) => {
    if (mode === studyMode) return;
    audio.stopAll();
    setStudyMode(mode);
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
