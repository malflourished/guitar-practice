import { chordFifthPc, type JamChord } from '../../lib/audio/jamSchedule';
import { getChordIntervals, noteToSemitone, type ResolvedProgressionStep } from '../../lib/music';

/**
 * What the jam loop and the form strip need to know about each step's chord:
 * its root, quality, slash bass and own 5th. One step is one bar.
 */
export function jamChordsOf(steps: readonly ResolvedProgressionStep[]): JamChord[] {
  return steps.map((step) => ({
    rootPc: noteToSemitone(step.root),
    quality: step.quality,
    bassPc: step.bass ? noteToSemitone(step.bass) : undefined,
    fifthPc: chordFifthPc(noteToSemitone(step.root), getChordIntervals(step.quality)),
  }));
}
