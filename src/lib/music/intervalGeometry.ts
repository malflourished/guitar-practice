import type { FretPosition, NoteName } from '../../types/music';
import { getNoteAt, getPositionsForNotes } from './fretboard';
import { noteToSemitone, samePitchClass, semitoneToNote } from './notes';
import { FRET_COUNT, STRING_COUNT } from './tuning';

/**
 * How wide the search is for a "find the interval" drill (Decision 9: progressive).
 * - `string`: the same string as the root — interval as a pure fret distance
 * - `position`: a one-hand window around the root — the two-point shape
 * - `neck`: every occurrence across the whole fretboard
 */
export type DrillScope = 'string' | 'position' | 'neck';

/** Frets reachable below/above the anchor in `position` scope (a hand span). */
const POSITION_BELOW = 1;
const POSITION_ABOVE = 4;

/** All board locations of the root pitch class (open strings included). */
export function getRootAnchors(root: NoteName): FretPosition[] {
  return getPositionsForNotes(new Set([root]));
}

/** The pitch class an interval above an anchor note. */
function targetSemitone(anchor: FretPosition, semitones: number): number {
  return (noteToSemitone(anchor.note) + semitones) % 12;
}

/**
 * Every acceptable answer for finding `semitones` above the anchored root,
 * scoped by difficulty. `string` walks up the anchor's own string; `position`
 * collects matches inside a hand window; `neck` returns all occurrences.
 */
export function getDirectedTargets(
  anchor: FretPosition,
  semitones: number,
  scope: DrillScope,
): FretPosition[] {
  const targetPc = targetSemitone(anchor, semitones);
  const targetNote = semitoneToNote(targetPc);

  if (scope === 'neck') {
    return getPositionsForNotes(new Set([targetNote]));
  }

  if (scope === 'string') {
    const targets: FretPosition[] = [];
    for (const fret of [anchor.fret + semitones, anchor.fret + semitones + 12]) {
      if (fret >= 0 && fret <= FRET_COUNT) {
        targets.push({ string: anchor.string, fret, note: targetNote });
      }
    }
    return targets;
  }

  // position scope: a hand window around the anchor, any string.
  const lowFret = Math.max(0, anchor.fret - POSITION_BELOW);
  const highFret = Math.min(FRET_COUNT, anchor.fret + POSITION_ABOVE);
  const targets: FretPosition[] = [];
  for (let string = 0; string < STRING_COUNT; string += 1) {
    for (let fret = lowFret; fret <= highFret; fret += 1) {
      const note = getNoteAt(string, fret);
      if (samePitchClass(note, targetNote)) {
        targets.push({ string, fret, note });
      }
    }
  }
  return targets;
}

/**
 * True when the anchor + its targets straddle the G (string 2) and B (string 1)
 * pair — the one place standard tuning shifts by a major 3rd instead of a 4th,
 * so the interval shape changes. Drives the teaching badge.
 */
export function crossesGtoB(
  anchor: FretPosition,
  targets: FretPosition[],
): boolean {
  const strings = new Set<number>([anchor.string, ...targets.map((t) => t.string)]);
  return strings.has(1) && strings.has(2);
}

/**
 * The interval drawn on every string: each string's lowest root with its target
 * the same number of frets up. Shows that a one-string interval is an identical
 * fret distance no matter which string you play it on.
 */
export function getOneStringShapes(
  root: NoteName,
  semitones: number,
): FretPosition[] {
  const targetNote = semitoneToNote((noteToSemitone(root) + semitones) % 12);
  const out: FretPosition[] = [];
  for (let string = 0; string < STRING_COUNT; string += 1) {
    let rootFret = -1;
    for (let fret = 0; fret + semitones <= FRET_COUNT; fret += 1) {
      if (samePitchClass(getNoteAt(string, fret), root)) {
        rootFret = fret;
        break;
      }
    }
    if (rootFret < 0) continue;
    out.push({ string, fret: rootFret, note: root });
    out.push({ string, fret: rootFret + semitones, note: targetNote });
  }
  return out;
}

/** Root anchors that have at least one valid target for the interval/scope. */
export function getPlayableAnchors(
  root: NoteName,
  semitones: number,
  scope: DrillScope,
): FretPosition[] {
  return getRootAnchors(root).filter(
    (anchor) => getDirectedTargets(anchor, semitones, scope).length > 0,
  );
}
