/**
 * What the main thread and the modelled bass's audio-thread processor say to
 * each other. Kept apart from the processor so that importing these names
 * never pulls audio-thread code into the page.
 */
import type { BassParams } from './bassParams';

/** The name the processor registers under. */
export const BASS_PROCESSOR_NAME = 'vibrato-modelled-bass';

export type BassMessage =
  /** Pluck `midi` at `time` (seconds on the audio clock) and damp it `duration` seconds later. */
  | { type: 'note'; midi: number; time: number; duration: number; velocity: number }
  /** Silence everything and forget notes not yet played. */
  | { type: 'stop' }
  | { type: 'params'; params: Partial<BassParams> }
  /** The voice is gone: let the processor be collected. */
  | { type: 'dispose' };

export interface BassProcessorOptions {
  params?: Partial<BassParams>;
  seed?: number;
}
