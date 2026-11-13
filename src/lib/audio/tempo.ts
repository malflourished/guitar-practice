export const MIN_TEMPO = 40;
export const MAX_TEMPO = 400;
export const DEFAULT_TEMPO = 90;
/** The Settings slider stops here; the number field takes the full range. */
export const SLIDER_MAX_TEMPO = 240;

export function clampTempo(bpm: number): number {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));
}
