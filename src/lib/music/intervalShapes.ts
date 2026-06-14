import type { FretPosition } from '../../types/music';
import { getNoteAt } from './fretboard';
import { FRET_COUNT, OPEN_STRING_MIDI, STRING_COUNT } from './tuning';

/**
 * The string relationship of a two-point (root → target) dyad. These are the
 * generic shapes Tom Quayle teaches per interval: the same note found on the
 * same string, the adjacent (next-higher) string, or one string skipped.
 */
export type DyadRelationship = 'same-string' | 'adjacent' | 'string-skip';

export interface IntervalDyadShape {
  relationship: DyadRelationship;
  /** The root anchor the dyad is measured from. */
  root: FretPosition;
  /** The note an interval above the root, in this string relationship. */
  target: FretPosition;
  /** target.string − root.string (negative = toward the higher-pitched strings). */
  stringStep: number;
  /** target.fret − root.fret — the visual fret offset of the shape. */
  fretOffset: number;
  /** Whether the dyad straddles the G–B pair, where the geometry shifts a fret. */
  crossesGB: boolean;
}

/** Absolute MIDI pitch of a fret position. */
function midiOf(pos: FretPosition): number {
  return OPEN_STRING_MIDI[pos.string] + pos.fret;
}

const RELATIONSHIPS: { step: number; relationship: DyadRelationship }[] = [
  { step: 0, relationship: 'same-string' },
  { step: -1, relationship: 'adjacent' },
  { step: -2, relationship: 'string-skip' },
];

/**
 * The generic two-point shapes for an ascending interval from a root anchor:
 * the literal target note (root MIDI + semitones) located on the same string,
 * the next-higher string, and the string two up. Each shape carries the fret
 * offset that defines its look, and whether it crosses the G–B seam (where the
 * offset differs by one fret from the all-fourths strings).
 *
 * Only physically reachable shapes (target on a real string and fret) are
 * returned, so small intervals near the nut or high anchors may yield fewer.
 */
export function getIntervalDyadShapes(
  anchor: FretPosition,
  semitones: number,
): IntervalDyadShape[] {
  if (semitones <= 0) return [];
  const targetMidi = midiOf(anchor) + semitones;
  const shapes: IntervalDyadShape[] = [];

  for (const { step, relationship } of RELATIONSHIPS) {
    const string = anchor.string + step;
    if (string < 0 || string >= STRING_COUNT) continue;
    const fret = targetMidi - OPEN_STRING_MIDI[string];
    if (fret < 0 || fret > FRET_COUNT) continue;
    const target: FretPosition = { string, fret, note: getNoteAt(string, fret) };
    const strings = new Set([anchor.string, string]);
    shapes.push({
      relationship,
      root: anchor,
      target,
      stringStep: step,
      fretOffset: fret - anchor.fret,
      crossesGB: strings.has(1) && strings.has(2),
    });
  }

  return shapes;
}

const RELATIONSHIP_LABEL: Record<DyadRelationship, string> = {
  'same-string': 'Same string',
  adjacent: 'Adjacent string',
  'string-skip': 'String skip',
};

/** Human-readable name for a dyad string relationship. */
export function getDyadRelationshipLabel(relationship: DyadRelationship): string {
  return RELATIONSHIP_LABEL[relationship];
}
