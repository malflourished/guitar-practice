import { describe, expect, it } from 'vitest';
import type { NoteName } from '../../types/music';
import { jamPosition } from '../audio/jamSchedule';
import { jamChordsOf } from '../../modes/progressions/jamChords';
import { buildChordPositions, type Position } from './positions';
import {
  CLIMB_TOP_FRET,
  buildClimbChordViews,
  buildClimbPlan,
  climbPassesPerRegion,
  climbRegionIndex,
  climbShapesAt,
  describeClimb,
  formatClimb,
  type ClimbDirection,
  type ClimbNow,
  type ClimbPlan,
} from './progressionClimb';
import {
  PROGRESSION_LIBRARY,
  entryToProgressionDef,
  getProgressionLibraryEntry,
} from './progressionLibrary';
import { resolveProgression, type ResolvedProgressionStep } from './progressions';

const KEYS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DIRECTIONS: ClimbDirection[] = ['up', 'down'];

const stepsOf = (id: string, key: NoteName): ResolvedProgressionStep[] =>
  resolveProgression(key, entryToProgressionDef(getProgressionLibraryEntry(id)!), 'sharps');
const planOf = (
  id: string,
  key: NoteName,
  direction: ClimbDirection = 'up',
  start = 0,
): ClimbPlan => buildClimbPlan(stepsOf(id, key), { direction, start })!;

const middle = (shape: Position) => (shape.startFret + shape.endFret) / 2;
const frets = (shapes: Position[]) => ({
  low: Math.min(...shapes.map((shape) => shape.startFret)),
  high: Math.max(...shapes.map((shape) => shape.endFret)),
});
/** The largest distance between the middles of neighbouring chords in a pass. */
const widestHop = (shapes: Position[]) =>
  shapes.slice(1).reduce((hop, shape, i) => Math.max(hop, Math.abs(middle(shape) - middle(shapes[i]))), 0);
const regionsOver = (plan: ClimbPlan, passes: number) =>
  Array.from({ length: passes }, (_, pass) => climbRegionIndex(plan, pass));

describe('the 12-bar blues in D, Up the neck', () => {
  const plan = planOf('blues-12', 'D');

  it('plays all twelve bars of a pass in one stretch of the neck', () => {
    for (let pass = 0; pass < 12; pass++) {
      const { low, high } = frets(climbShapesAt(plan, pass));
      // "a stretch of N frets" counts both ends: 3 to 7 is five frets
      expect(high - low + 1, `pass ${pass + 1}`).toBeLessThanOrEqual(6);
    }
  });

  it('has three regions: the open position, frets 3 to 7, frets 10 to 14', () => {
    expect(plan.regions.map(({ startFret, endFret }) => [startFret, endFret])).toEqual([
      [0, 3],
      [3, 7],
      [10, 14],
    ]);
    // every bar sits in its own chord's shape for that region
    const shapes = (pass: number) =>
      climbShapesAt(plan, pass).map((shape, bar) => `${plan.steps[bar].chordName}@${shape.startFret}-${shape.endFret}`);
    expect(shapes(0)).toEqual(['D7@0-2', 'D7@0-2', 'D7@0-2', 'D7@0-2', 'G7@0-3', 'G7@0-3', 'D7@0-2', 'D7@0-2', 'A7@0-2', 'G7@0-3', 'D7@0-2', 'A7@0-2']);
    expect(shapes(1)).toEqual(['D7@5-7', 'D7@5-7', 'D7@5-7', 'D7@5-7', 'G7@3-5', 'G7@3-5', 'D7@5-7', 'D7@5-7', 'A7@5-7', 'G7@3-5', 'D7@5-7', 'A7@5-7']);
    expect(shapes(2)).toEqual(['D7@10-12', 'D7@10-12', 'D7@10-12', 'D7@10-12', 'G7@10-12', 'G7@10-12', 'D7@10-12', 'D7@10-12', 'A7@12-14', 'G7@10-12', 'D7@10-12', 'A7@12-14']);
  });

  it('starts at the region nearest the shape selected for the first chord, and goes up one region a pass', () => {
    expect(plan.startRegion).toBe(0);
    expect(regionsOver(plan, 3)).toEqual([0, 1, 2]);
    // each pass is higher: every bar's shape sits higher than it did a pass before
    for (const pass of [0, 1]) {
      const here = climbShapesAt(plan, pass);
      const next = climbShapesAt(plan, pass + 1);
      here.forEach((shape, bar) => expect(middle(next[bar]), `bar ${bar + 1}`).toBeGreaterThan(middle(shape)));
    }
  });

  it('turns round at the top and comes back down, and is never still', () => {
    expect(regionsOver(plan, 13)).toEqual([0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0]);
    const regions = regionsOver(plan, 40);
    regions.slice(1).forEach((region, i) => expect(region).not.toBe(regions[i]));
  });

  it('never uses a shape above fret 15', () => {
    for (let pass = 0; pass < 24; pass++) {
      for (const shape of climbShapesAt(plan, pass)) {
        expect(shape.endFret).toBeLessThanOrEqual(CLIMB_TOP_FRET);
        for (const dot of shape.positions) expect(dot.fret).toBeLessThanOrEqual(CLIMB_TOP_FRET);
      }
    }
  });

  it('starts at the region nearest the shape the player chose: D7 has five shapes, two of them too high', () => {
    // open (0-2), A shape (5-7), E shape (10-12), A shape (17-19), E shape (22-24)
    expect([0, 1, 2, 3, 4].map((start) => planOf('blues-12', 'D', 'up', start).startRegion)).toEqual([0, 1, 2, 2, 2]);
    // a choice past the last shape is the last shape
    expect(planOf('blues-12', 'D', 'up', 99).startRegion).toBe(2);
  });

  it('Down is Up in a mirror: it goes the other way first and turns round at the bottom', () => {
    const down = planOf('blues-12', 'D', 'down', 2);
    expect(down.startRegion).toBe(2);
    expect(regionsOver(down, 9)).toEqual([2, 1, 0, 1, 2, 1, 0, 1, 2]);
    // from the bottom, Down has nowhere to go but up, and does not stand still
    expect(regionsOver(planOf('blues-12', 'D', 'down', 0), 7)).toEqual([0, 1, 2, 1, 0, 1, 2]);
    // from the top, Up goes down first
    expect(regionsOver(planOf('blues-12', 'D', 'up', 2), 5)).toEqual([2, 1, 0, 1, 2]);
    // and in general Down from a region is Up from the mirrored region, mirrored
    for (let start = 0; start < plan.regions.length; start++) {
      const mirrored = plan.regions.length - 1 - start;
      const up = { ...plan, startRegion: mirrored };
      const mirror = { ...plan, direction: 'down' as const, startRegion: start };
      expect(regionsOver(mirror, 20)).toEqual(regionsOver(up, 20).map((region) => plan.regions.length - 1 - region));
    }
  });
});

describe('every library entry, in every key', () => {
  /** The neighbouring-chord bound, and the entries where the guitar cannot meet it. */
  const HOP_BOUND = 5;
  const HOP_EXCEPTIONS: Record<string, number> = {
    // third-cycle in G: Gmaj7 open, Bmaj7 at 2-4, and Ebmaj7 only at 6-8 or 11-13
    'third-cycle:G': 5.5,
    // the flat-II chord has no shape near the nut: Eb7 sits at 6-8 beside an open Em7 or Dmaj7
    'tritone-sub:D': 6,
    'tritone-sub:D#': 6,
    // D#7 at 6-8 beside an open Emaj7
    'city-pop:B': 6,
  };
  const SPAN_BOUND = 7;
  const SPAN_EXCEPTIONS = new Set(['third-cycle', 'tritone-sub', 'city-pop']);

  const everyPlan = function* () {
    for (const entry of PROGRESSION_LIBRARY) {
      for (const key of KEYS) {
        const steps = resolveProgression(key, entryToProgressionDef(entry), 'sharps');
        const shapes = buildChordPositions(steps[0].root, steps[0].quality).length;
        for (let start = 0; start < shapes; start++) {
          for (const direction of DIRECTIONS) {
            yield { entry, key, steps, start, direction, plan: buildClimbPlan(steps, { direction, start })! };
          }
        }
      }
    }
  };

  it('never uses a shape above fret 15, in any pass, either way, from any starting shape', () => {
    const tooHigh: string[] = [];
    let passes = 0;
    for (const { entry, key, direction, start, plan } of everyPlan()) {
      for (let pass = 0; pass < 8 * plan.passesPerRegion; pass++) {
        passes++;
        climbShapesAt(plan, pass).forEach((shape, bar) => {
          const highest = Math.max(shape.endFret, ...shape.positions.map((dot) => dot.fret));
          if (highest > CLIMB_TOP_FRET) {
            tooHigh.push(`${entry.id} in ${key}, ${direction} from ${start}, pass ${pass + 1}, bar ${bar + 1}: fret ${highest}`);
          }
        });
      }
    }
    expect(passes).toBeGreaterThan(20000);
    expect(tooHigh).toEqual([]);
  });

  it('gives every chord one of its own shapes, and the same shape all pass', () => {
    for (const { entry, key, steps, plan } of everyPlan()) {
      for (const [index, region] of plan.regions.entries()) {
        const shapeOf = new Map<string, Position>();
        steps.forEach((step, bar) => {
          const where = `${entry.id} in ${key}, region ${index}, bar ${bar + 1}`;
          const shape = region.shapes[bar];
          const own = buildChordPositions(step.root, step.quality);
          expect(own.some((candidate) => candidate.number === shape.number && candidate.startFret === shape.startFret), where).toBe(true);
          const name = `${step.root}|${step.quality}`;
          expect(shapeOf.get(name) ?? shape, where).toBe(shape);
          shapeOf.set(name, shape);
        });
      }
    }
  });

  it('keeps neighbouring chords within five frets of each other, bar to bar (pinned exceptions named)', () => {
    const over = new Set<string>();
    for (const { entry, key, plan } of everyPlan()) {
      for (const region of plan.regions) {
        const hop = widestHop(region.shapes);
        const bound = HOP_EXCEPTIONS[`${entry.id}:${key}`] ?? HOP_BOUND;
        expect(hop, `${entry.id} in ${key}`).toBeLessThanOrEqual(bound);
        if (hop > HOP_BOUND) over.add(`${entry.id}:${key}`);
      }
    }
    // the list of exceptions is exactly the combinations that need it
    expect([...over].sort()).toEqual(Object.keys(HOP_EXCEPTIONS).sort());
  });

  it('keeps a whole pass inside eight frets, and seven except in three entries', () => {
    for (const { entry, key, plan } of everyPlan()) {
      for (const region of plan.regions) {
        const span = region.endFret - region.startFret;
        expect(span, `${entry.id} in ${key}`).toBeLessThanOrEqual(SPAN_EXCEPTIONS.has(entry.id) ? 8 : SPAN_BOUND);
      }
    }
  });

  it('has at least two regions to move between, and the first chord is the first shape of each', () => {
    for (const { entry, key, steps, plan } of everyPlan()) {
      expect(plan.regions.length, `${entry.id} in ${key}`).toBeGreaterThanOrEqual(2);
      const anchors = buildChordPositions(steps[0].root, steps[0].quality).filter(
        (shape) => shape.endFret <= CLIMB_TOP_FRET,
      );
      expect(plan.regions.map((region) => region.shapes[0].startFret)).toEqual(anchors.map((shape) => shape.startFret));
    }
  });

  it('never moves a chord down as the region goes up', () => {
    for (const { entry, key, steps, plan } of everyPlan()) {
      for (let region = 1; region < plan.regions.length; region++) {
        steps.forEach((_, bar) => {
          expect(
            middle(plan.regions[region].shapes[bar]),
            `${entry.id} in ${key}, bar ${bar + 1}, region ${region}`,
          ).toBeGreaterThanOrEqual(middle(plan.regions[region - 1].shapes[bar]));
        });
      }
    }
  });

  it('takes, for each region, the pass that fits in the fewest frets (brute force agrees)', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      for (const key of KEYS) {
        const steps = resolveProgression(key, entryToProgressionDef(entry), 'sharps');
        const plan = buildClimbPlan(steps, { direction: 'up', start: 0 })!;
        const within = (step: ResolvedProgressionStep) =>
          buildChordPositions(step.root, step.quality).filter((shape) => shape.endFret <= CLIMB_TOP_FRET);
        const firstName = `${steps[0].root}|${steps[0].quality}`;
        const others = [...new Map(steps.map((step) => [`${step.root}|${step.quality}`, step])).entries()]
          .filter(([name]) => name !== firstName)
          .map(([, step]) => within(step));
        for (const [index, anchor] of within(steps[0]).entries()) {
          // every way of giving each other chord one of its shapes
          let best: [number, number] | null = null;
          const search = (chosen: Position[], from: number) => {
            if (from === others.length) {
              const all = [anchor, ...chosen];
              const { low, high } = frets(all);
              const off = chosen.reduce((sum, shape) => sum + Math.abs(middle(shape) - middle(anchor)), 0);
              if (!best || high - low < best[0] || (high - low === best[0] && off < best[1])) best = [high - low, off];
              return;
            }
            for (const shape of others[from]) search([...chosen, shape], from + 1);
          };
          search([], 0);
          const region = plan.regions[index];
          const distinct = new Map(steps.map((step, bar) => [`${step.root}|${step.quality}`, region.shapes[bar]]));
          distinct.delete(firstName);
          const off = [...distinct.values()].reduce((sum, shape) => sum + Math.abs(middle(shape) - middle(anchor)), 0);
          expect([region.endFret - region.startFret, off], `${entry.id} in ${key}, region ${index}`).toEqual(best);
        }
      }
    }
  });
});

describe('forms under four bars', () => {
  it('stay in a region for as many passes as it takes to last four bars', () => {
    expect([1, 2, 3, 4, 5, 12].map(climbPassesPerRegion)).toEqual([4, 2, 2, 1, 1, 1]);
  });

  it('a two-bar vamp changes region every second pass', () => {
    const plan = planOf('vamp-mixolydian', 'A');
    expect(plan.steps).toHaveLength(2);
    expect(plan.passesPerRegion).toBe(2);
    expect(regionsOver(plan, 12)).toEqual([0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1]);
  });

  it('a three-bar form changes region every second pass', () => {
    const plan = planOf('blues-145', 'A');
    expect(plan.steps).toHaveLength(3);
    expect(regionsOver(plan, 10)).toEqual([0, 0, 1, 1, 2, 2, 1, 1, 0, 0]);
  });

  it('a one-bar loop changes region every fourth pass', () => {
    const one = buildClimbPlan(stepsOf('vamp-mixolydian', 'A').slice(0, 1), { direction: 'up', start: 0 })!;
    expect(one.passesPerRegion).toBe(4);
    expect(regionsOver(one, 16)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1]);
  });

  it('a form of four bars or more moves every pass', () => {
    expect(planOf('jazz-251', 'C').passesPerRegion).toBe(1);
    expect(planOf('blues-12', 'C').passesPerRegion).toBe(1);
  });

  it('says how long until the move: in 2 passes, then next pass', () => {
    const plan = planOf('vamp-mixolydian', 'A');
    expect(describeClimb(plan, 0).next).toEqual({ direction: 'up', passes: 2 });
    expect(describeClimb(plan, 1).next).toEqual({ direction: 'up', passes: 1 });
    expect(describeClimb(plan, 4).next).toEqual({ direction: 'down', passes: 2 });
    expect(describeClimb(plan, 5).next).toEqual({ direction: 'down', passes: 1 });
  });
});

describe('what the neck, the panel and the strum read', () => {
  const steps = stepsOf('blues-12', 'D');
  const chords = jamChordsOf(steps);
  const start = { direction: 'up', start: 0 } as const;

  /** The shape the guitar strums for a bar: found from the bar number alone. */
  const strumFor = (plan: ClimbPlan, bar: number) => {
    const { stepIndex, pass } = jamPosition(bar, chords);
    return climbShapesAt(plan, pass)[stepIndex];
  };

  it('depends only on the bar, the steps and the starting choice', () => {
    const plan = buildClimbPlan(steps, start)!;
    const inOrder = Array.from({ length: 96 }, (_, bar) => strumFor(plan, bar));
    // a plan built again, and asked in a scrambled order, gives the same shapes
    const again = buildClimbPlan(stepsOf('blues-12', 'D'), { ...start })!;
    const scrambled = Array.from({ length: 96 }, (_, i) => (i * 37) % 96);
    for (const bar of scrambled) expect(strumFor(again, bar), `bar ${bar}`).toEqual(inOrder[bar]);
  });

  it('bar 13, the first of the second pass, is in the second region while the screen still holds the first', () => {
    const plan = buildClimbPlan(steps, start)!;
    // the screen's pass lags: at scheduling time it is still pass 0
    const screenPass = 0;
    const fromScreen = climbShapesAt(plan, screenPass)[0];
    const fromBar = strumFor(plan, 12);
    expect(jamPosition(12, chords)).toMatchObject({ stepIndex: 0, pass: 1 });
    expect([fromScreen.startFret, fromScreen.endFret]).toEqual([0, 2]);
    expect([fromBar.startFret, fromBar.endFret]).toEqual([5, 7]);
  });

  it('shows the neck, the panel and the strum the same shapes for the same bar', () => {
    const plan = buildClimbPlan(steps, start)!;
    for (let bar = 0; bar < 48; bar++) {
      const { stepIndex, pass } = jamPosition(bar, chords);
      const view = buildClimbChordViews(plan, pass, 'sharps')[stepIndex];
      const strum = strumFor(plan, bar);
      expect(view.positions, `bar ${bar}`).toBe(strum.positions);
      expect([view.startFret, view.endFret]).toEqual([strum.startFret, strum.endFret]);
      expect(view.step).toBe(steps[stepIndex]);
    }
  });
});

describe('the label', () => {
  const plan = planOf('blues-12', 'D');
  const label = (pass: number, loop = true) => formatClimb(describeClimb(plan, pass), loop);

  it('names the frets and what happens next', () => {
    expect(label(0)).toBe('frets 0–3 · up next pass');
    expect(label(1)).toBe('frets 3–7 · up next pass');
    expect(label(2)).toBe('frets 10–14 · down next pass');
    expect(label(3)).toBe('frets 3–7 · down next pass');
    expect(label(4)).toBe('frets 0–3 · up next pass');
  });

  it('names only the frets when the loop will not come round again', () => {
    expect(label(0, false)).toBe('frets 0–3');
  });

  it('counts passes on a short form', () => {
    const vamp = planOf('vamp-mixolydian', 'A');
    expect(formatClimb(describeClimb(vamp, 0), true)).toBe('frets 0–3 · up in 2 passes');
    expect(formatClimb(describeClimb(vamp, 1), true)).toBe('frets 0–3 · up next pass');
  });

  it('says "fret" for a single fret', () => {
    const now: ClimbNow = { region: 0, regionCount: 2, startFret: 5, endFret: 5, next: null };
    expect(formatClimb(now, true)).toBe('fret 5');
  });
});

describe('edges', () => {
  it('an empty form has no plan', () => {
    expect(buildClimbPlan([], { direction: 'up', start: 0 })).toBeNull();
  });

  it('a chord with one shape in reach is one region: nowhere to go, and it says nothing about moving', () => {
    // C half-diminished: one shape (frets 3-4) ends below fret 15; the next is at 15-16
    const step: ResolvedProgressionStep = {
      root: 'C',
      quality: 'm7b5',
      numeral: 'ii',
      chordName: 'Cm7♭5',
      qualityLabel: 'Half-diminished',
    };
    const plan = buildClimbPlan([step], { direction: 'up', start: 0 })!;
    expect(plan.regions).toHaveLength(1);
    expect(regionsOver(plan, 6)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(describeClimb(plan, 0).next).toBeNull();
    expect(formatClimb(describeClimb(plan, 3), true)).toBe('frets 3–4');
  });

  it('a pass before the first is the first', () => {
    const plan = planOf('blues-12', 'D');
    expect(climbRegionIndex(plan, -3)).toBe(climbRegionIndex(plan, 0));
  });
});
