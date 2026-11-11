import type { NoteName } from '../../types/music';
import { noteToSemitone } from '../music/notes';

/** Reference MIDI for a root, placed in a comfortable mid octave (C3–B3). */
export function rootReferenceMidi(root: NoteName): number {
  return 48 + noteToSemitone(root);
}

export type IntervalPlaybackDirection = 'ascending' | 'descending' | 'harmonic';

/**
 * Schedule an interval as two engine notes. Melodic directions play the root
 * then the target (or the reverse) a beat apart; harmonic sounds them together.
 * Returns timer handles so the caller can cancel a pending second note.
 *
 * This is pure orchestration over the existing engine `playNote` — no new audio
 * machinery (see plan: intervalEar is glue, not a new engine).
 */
export function playInterval(
  playNote: (midi: number) => void,
  rootMidi: number,
  semitones: number,
  direction: IntervalPlaybackDirection,
  gapMs = 600,
): ReturnType<typeof setTimeout>[] {
  const targetMidi = rootMidi + semitones;

  if (direction === 'harmonic') {
    playNote(rootMidi);
    playNote(targetMidi);
    return [];
  }

  const [first, second] =
    direction === 'ascending'
      ? [rootMidi, targetMidi]
      : [targetMidi, rootMidi];

  playNote(first);
  return [setTimeout(() => playNote(second), gapMs)];
}
