import type { Position } from './positions';

/**
 * What makes a fingering unplayable, or an empty list. The tests run every
 * chord shape and triad through it; it is the written-down form of "a shape a
 * guitarist can actually hold":
 * - open strings take no finger, fretted notes take fingers 1 to 4;
 * - the fretted notes reach across `maxReach` frets at most (3 is four frets,
 *   one finger each);
 * - a higher-numbered finger never sits behind a lower one;
 * - one finger on two strings is a barre: one fret, with no open or
 *   lower-fretted string under it.
 */
export function fingeringFaults(shape: Position, maxReach = 3): string[] {
  const faults: string[] = [];
  const fretted = shape.positions.filter((p) => p.fret > 0);
  for (const p of shape.positions) {
    if (p.fret === 0 && p.finger !== 0) faults.push(`open string ${p.string} has finger ${p.finger}`);
    if (p.fret > 0 && !(p.finger !== undefined && p.finger >= 1 && p.finger <= 4)) {
      faults.push(`string ${p.string} fret ${p.fret} has finger ${p.finger}`);
    }
  }
  if (fretted.length === 0) return faults;
  const low = Math.min(...fretted.map((p) => p.fret));
  const high = Math.max(...fretted.map((p) => p.fret));
  if (high - low > maxReach) faults.push(`spans ${high - low + 1} frets`);
  for (const a of fretted) {
    for (const b of fretted) {
      // A higher finger never sits behind a lower one.
      if (a.finger! < b.finger! && a.fret > b.fret) {
        faults.push(`finger ${a.finger} at fret ${a.fret} is above finger ${b.finger} at fret ${b.fret}`);
      }
      // One finger on two strings is a barre: same fret, and nothing under
      // it is open or fretted lower.
      if (a !== b && a.finger === b.finger) {
        if (a.fret !== b.fret) faults.push(`finger ${a.finger} is on frets ${a.fret} and ${b.fret}`);
        const [lo, hi] = [Math.min(a.string, b.string), Math.max(a.string, b.string)];
        for (const c of shape.positions) {
          if (c.string > lo && c.string < hi && c.fret < a.fret) {
            faults.push(`finger ${a.finger}'s barre at fret ${a.fret} covers string ${c.string} at fret ${c.fret}`);
          }
        }
      }
    }
  }
  return faults;
}
