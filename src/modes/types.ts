import type { Dispatch, SetStateAction } from 'react';
import type { KeyState } from '../hooks/useKeyState';
import type { StudyMode } from '../types/music';
import type { ChordsState } from './chords/useChordsState';
import type { ProgressionsState } from './progressions/useProgressionsState';
import type { ScalesState } from './scales/useScalesState';
import type { TheoryState } from './theory/useTheoryState';

/**
 * Every mode's state in one bundle. App builds it once; the pieces that move
 * between modes (the key context, the mode switch, Theory's links) read it.
 */
export interface ModeStates {
  studyMode: StudyMode;
  setStudyMode: Dispatch<SetStateAction<StudyMode>>;
  keyState: KeyState;
  chords: ChordsState;
  scales: ScalesState;
  progressions: ProgressionsState;
  theory: TheoryState;
}
