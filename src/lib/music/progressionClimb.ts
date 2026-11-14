import type { NotationPreference } from './notes';
import { buildChordPositions, type Position } from './positions';
import {
  buildChordViewFromShape,
  type ProgressionChordView,
} from './progressionChordViews';
import type { ResolvedProgressionStep } from './progressions';

/**
 * "Move along the neck", the first slice of P3's Climb lens (docs/specs/P3-climb.md).
 *
 * A whole pass of the form is played in one region of the neck, and the region
 * moves between passes. The plan is plain data built from the steps and the
 * player's choice, so the screen and the jam loop read the same thing: the
 * shapes for a pass depend on nothing but the pass number.
 */

export type ClimbDirection = 'up' | 'down';

/** No climb uses a shape that ends above this fret: many guitars stop at 21 or 22, and the top of the neck is a poor place to practise. */
export const CLIMB_TOP_FRET = 15;
/** A form shorter than this stays in a region for as many passes as it takes to last this many bars. */
export const CLIMB_MIN_BARS = 4;

/** What Play chose: which way to go, and the shape the first chord starts from. */
export interface ClimbChoice {
  direction: ClimbDirection;
  /**
   * The shape the player had selected for the first chord: an index into
   * `buildChordPositions`. Up starts at the region nearest it. Down ignores it
   * and starts at the top: from the open shape it would otherwise have nowhere
   * lower to go and behave exactly like Up.
   */
  start: number;
}

/** One region of the neck: every step's shape for a pass played there. */
export interface ClimbRegion {
  /** One shape per step. The same chord has the same shape all pass. */
  shapes: Position[];
  /** The lowest and the highest fret any of the pass's shapes uses. */
  startFret: number;
  endFret: number;
}

export interface ClimbPlan {
  direction: ClimbDirection;
  steps: ResolvedProgressionStep[];
  /** Low to high. */
  regions: ClimbRegion[];
  /**
   * Where the first pass is played. Up: the region nearest the shape the player
   * had selected for the first chord. Down: the highest region.
   */
  startRegion: number;
  /** How many passes the loop stays in a region before it moves. */
  passesPerRegion: number;
}

const middle = (shape: Position): number => (shape.startFret + shape.endFret) / 2;
const chordKey = (step: ResolvedProgressionStep): string => `${step.root}|${step.quality}`;
/** For a chord that has no shape at all (none of the library's do). */
const NO_SHAPE: Position = { number: 1, startFret: 0, endFret: 0, positions: [], mutedStrings: [] };

/** The shapes of a chord a climb may use, low to high; the lowest one when none ends low enough. */
function climbCandidates(step: ResolvedProgressionStep): Position[] {
  const all = buildChordPositions(step.root, step.quality);
  const within = all.filter((shape) => shape.endFret <= CLIMB_TOP_FRET);
  return within.length > 0 ? within : all.slice(0, 1);
}

/** The shape whose middle is nearest `target`; the lower one on a tie. `shapes` run low to high. */
function nearestShape(shapes: readonly Position[], target: number): Position {
  let best = shapes[0] ?? NO_SHAPE;
  for (const shape of shapes) {
    if (Math.abs(middle(shape) - target) < Math.abs(middle(best) - target)) best = shape;
  }
  return best;
}

/**
 * The pass around one shape of the first chord: for every other chord, the
 * shape that keeps the whole pass inside the fewest frets. A window starting
 * at some shape's first fret is as wide as its furthest chord needs; the
 * narrowest window wins. Where windows tie, the one whose shapes sit nearest
 * the first chord's middle wins (then the lower one). Inside the window each
 * chord takes the shape nearest that middle. Returns one shape per entry of
 * `others`, in order.
 */
function fitPass(anchor: Position, others: readonly (readonly Position[])[]): Position[] {
  const target = middle(anchor);
  const lows = [...new Set([anchor, ...others.flat()].map((shape) => shape.startFret))]
    .filter((low) => low <= anchor.startFret)
    .sort((a, b) => a - b);
  let best: { span: number; off: number; picks: Position[] } | null = null;
  for (const low of lows) {
    let high = anchor.endFret;
    let reachable = true;
    for (const shapes of others) {
      const ends = shapes.filter((shape) => shape.startFret >= low).map((shape) => shape.endFret);
      if (ends.length === 0) {
        reachable = false;
        break;
      }
      high = Math.max(high, Math.min(...ends));
    }
    if (!reachable) continue;
    const picks = others.map((shapes) =>
      nearestShape(shapes.filter((shape) => shape.startFret >= low && shape.endFret <= high), target),
    );
    const span = high - low;
    const off = picks.reduce((sum, shape) => sum + Math.abs(middle(shape) - target), 0);
    if (!best || span < best.span || (span === best.span && off < best.off)) best = { span, off, picks };
  }
  return best?.picks ?? others.map((shapes) => nearestShape(shapes, target));
}

/** How many passes the loop stays in a region: one, unless the form is under four bars. */
export function climbPassesPerRegion(stepCount: number): number {
  return Math.max(1, Math.ceil(CLIMB_MIN_BARS / Math.max(1, stepCount)));
}

/**
 * The regions of a progression, from the shapes of its first chord that end at
 * or below `CLIMB_TOP_FRET`: each one is a region, and the other chords take
 * their shapes around it (`fitPass`). The same chord is always the same shape
 * within a region, and as the region goes up no chord's shape goes down.
 *
 * Where the climb begins depends on the way. Up begins at the region nearest
 * the shape the player had selected for the first chord (`choice.start`). Down
 * begins at the highest region, whatever was selected, and steps down from
 * there. Returns null for an empty form.
 */
export function buildClimbPlan(
  steps: ResolvedProgressionStep[],
  choice: ClimbChoice,
): ClimbPlan | null {
  if (steps.length === 0) return null;
  const candidates = new Map<string, Position[]>();
  for (const step of steps) {
    if (!candidates.has(chordKey(step))) candidates.set(chordKey(step), climbCandidates(step));
  }
  const firstKey = chordKey(steps[0]);
  const anchors = candidates.get(firstKey) ?? [];
  const others = [...candidates].filter(([key]) => key !== firstKey);

  const regions: ClimbRegion[] = anchors.map((anchor) => {
    const picks = fitPass(anchor, others.map(([, shapes]) => shapes));
    const byChord = new Map<string, Position>([[firstKey, anchor]]);
    others.forEach(([key], index) => byChord.set(key, picks[index]));
    const shapes = steps.map((step) => byChord.get(chordKey(step)) ?? NO_SHAPE);
    return {
      shapes,
      startFret: Math.min(...shapes.map((shape) => shape.startFret)),
      endFret: Math.max(...shapes.map((shape) => shape.endFret)),
    };
  });
  if (regions.length === 0) return null;

  const all = buildChordPositions(steps[0].root, steps[0].quality);
  const selected = all[Math.min(Math.max(0, choice.start), Math.max(0, all.length - 1))];
  const startRegion =
    choice.direction === 'down'
      ? regions.length - 1
      : selected
        ? anchors.indexOf(nearestShape(anchors, middle(selected)))
        : 0;
  return {
    direction: choice.direction,
    steps,
    regions,
    startRegion: Math.max(0, startRegion),
    passesPerRegion: climbPassesPerRegion(steps.length),
  };
}

/**
 * The region a pass is played in. The climb starts at `startRegion`, moves one
 * region every `passesPerRegion` passes in its direction, turns round at the
 * highest (or the lowest) region and comes back, and never stops at an end.
 * Down is Up seen in a mirror: begun at the top it goes down first, turns
 * round at the lowest region and comes back up.
 */
export function climbRegionIndex(plan: ClimbPlan, pass: number): number {
  const top = plan.regions.length - 1;
  if (top <= 0) return 0;
  const moves = Math.floor(Math.max(0, pass) / plan.passesPerRegion);
  const mirrored = plan.direction === 'down';
  const from = mirrored ? top - plan.startRegion : plan.startRegion;
  const along = (from + moves) % (2 * top);
  const up = along <= top ? along : 2 * top - along;
  return mirrored ? top - up : up;
}

/** One shape per step, for a pass: what the neck, the panel and the guitar's strum all show. */
export function climbShapesAt(plan: ClimbPlan, pass: number): Position[] {
  return plan.regions[climbRegionIndex(plan, pass)].shapes;
}

export function buildClimbChordViews(
  plan: ClimbPlan,
  pass: number,
  notation: NotationPreference,
): ProgressionChordView[] {
  const shapes = climbShapesAt(plan, pass);
  return plan.steps.map((step, index) => buildChordViewFromShape(step, shapes[index], notation));
}

/** Where a pass is, and what happens next. */
export interface ClimbNow {
  region: number;
  regionCount: number;
  startFret: number;
  endFret: number;
  /** The move that comes next, and how many passes away it is (1 is the very next pass); null with one region. */
  next: { direction: ClimbDirection; passes: number } | null;
}

export function describeClimb(plan: ClimbPlan, pass: number): ClimbNow {
  const region = climbRegionIndex(plan, pass);
  const { startFret, endFret } = plan.regions[region];
  let next: ClimbNow['next'] = null;
  if (plan.regions.length > 1) {
    for (let passes = 1; passes <= plan.passesPerRegion; passes++) {
      const there = climbRegionIndex(plan, pass + passes);
      if (there !== region) {
        next = { direction: there > region ? 'up' : 'down', passes };
        break;
      }
    }
  }
  return { region, regionCount: plan.regions.length, startFret, endFret, next };
}

/**
 * The deck's label: "frets 3–7 · up next pass", "frets 10–14 · down next pass",
 * "frets 0–2 · up in 2 passes" on a short form that stays a while. With Loop
 * off there is no next pass, so it names only the frets.
 */
export function formatClimb(now: ClimbNow, loop: boolean): string {
  const frets =
    now.startFret === now.endFret
      ? `fret ${now.startFret}`
      : `frets ${now.startFret}–${now.endFret}`;
  if (!loop || !now.next) return frets;
  const when = now.next.passes === 1 ? 'next pass' : `in ${now.next.passes} passes`;
  return `${frets} · ${now.next.direction} ${when}`;
}
