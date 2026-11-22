/**
 * The wordmark's wave (the ~ of vibrato~), drawn as a string held at both
 * ends with a wave running along it. At phase 0 it is the tilde at rest: one
 * hump up, one down.
 */

/** The drawing's box. The line's ends sit at mid-height, `WAVE.inset` in from each side. */
export const WAVE = { width: 100, height: 60, inset: 12, amplitude: 15, points: 28, frames: 16 };

const TWO_PI = Math.PI * 2;

/**
 * How far the string can move at `u` along it (0 to 1): nothing at the ends,
 * where it is held, and most in the middle.
 */
export function waveEnvelope(u: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.7;
}

/** The wave's height at `u` along the string, for a wave that has travelled `phase` radians. Up is positive. */
export function waveHeight(u: number, phase: number): number {
  return WAVE.amplitude * waveEnvelope(u) * Math.sin(TWO_PI * u - phase);
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The line as an SVG path. Every phase gives the same commands, so one can be morphed into the next. */
export function wavePath(phase: number): string {
  const span = WAVE.width - WAVE.inset * 2;
  let path = '';
  for (let i = 0; i <= WAVE.points; i += 1) {
    const u = i / WAVE.points;
    const x = round(WAVE.inset + span * u);
    const y = round(WAVE.height / 2 - waveHeight(u, phase));
    path += `${i === 0 ? 'M' : 'L'}${x} ${y}`;
  }
  return path;
}

/**
 * One trip of the wave along the string as path frames, the last the same as
 * the first, so the loop has no seam.
 */
export function waveFrames(): string[] {
  return Array.from({ length: WAVE.frames + 1 }, (_, frame) => wavePath((TWO_PI * frame) / WAVE.frames));
}
