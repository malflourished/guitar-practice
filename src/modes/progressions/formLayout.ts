import { sameChord, type JamChord } from '../../lib/audio/jamSchedule';

/**
 * The form strip is a lead sheet: one cell per bar, four bars to a line, the
 * way a chart is written. Pure helpers for what it draws.
 */

/** Bars on a line of the lead sheet. */
export const BARS_PER_LINE = 4;

/**
 * How many bars go on each line: twelve bars read 4, 4, 4 (the blues as it is
 * taught), five read 4, 1.
 */
export function formLines(bars: number, perLine = BARS_PER_LINE): number[] {
  const lines: number[] = [];
  for (let left = Math.max(0, Math.floor(bars)); left > 0; left -= perLine) {
    lines.push(Math.min(perLine, left));
  }
  return lines;
}

/**
 * Which bars only repeat the chord of the bar before them. The strip writes
 * those again in a dimmer tone so the changes stand out. The first bar never
 * repeats: it is the top of the form, whatever came last.
 */
export function repeatedBars(chords: readonly JamChord[]): boolean[] {
  return chords.map((chord, index) => index > 0 && sameChord(chord, chords[index - 1]));
}

/** "F7 in 3 bars", or "F7 next bar" when it is the very next one. */
export function formatNextChange(chordName: string, bars: number): string {
  return bars === 1 ? `${chordName} next bar` : `${chordName} in ${bars} bars`;
}
