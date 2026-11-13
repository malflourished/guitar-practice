/**
 * What the main thread and the drum kit's audio-thread processor say to each
 * other. Kept apart from the processor so that importing these names never
 * pulls audio-thread code into the page.
 */
import type { DrumKitId, DrumParams, DrumPiece } from './drumParams';

/** The name the processor registers under. */
export const DRUM_PROCESSOR_NAME = 'vibrato-drum-kit';

export type DrumMessage =
  /** Play `piece` at `time` (seconds on the audio clock). `duration` is a brush sweep's length, in seconds. */
  | { type: 'hit'; piece: DrumPiece; time: number; velocity: number; duration: number }
  /** Silence everything and forget strokes not yet played. */
  | { type: 'stop' }
  /** Change kit, with that kit's controls. */
  | { type: 'kit'; kit: DrumKitId; params: Partial<DrumParams> }
  | { type: 'params'; params: Partial<DrumParams> }
  /** The voice is gone: let the processor be collected. */
  | { type: 'dispose' };

export interface DrumProcessorOptions {
  kit?: DrumKitId;
  params?: Partial<DrumParams>;
  seed?: number;
}
