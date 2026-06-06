import { Frequency } from 'tone';

/** Convert a MIDI note number to scientific pitch notation (e.g. 64 → "E4"). */
export function midiToNote(midi: number): string {
  return Frequency(midi, 'midi').toNote();
}
