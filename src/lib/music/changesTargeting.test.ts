import { describe, expect, it } from 'vitest';
import {
  buildChangesProgression,
  getChangesProgression,
  CHANGES_PROGRESSIONS,
  getGuideToneMotion,
  planGuideTones,
} from './changesTargeting';
import { getRootAnchors } from './intervalGeometry';
import { ALL_NOTES } from '../colors';

describe('buildChangesProgression', () => {
  it('resolves a C major ii-V-I into Dm7, G7, Cmaj7 guide tones', () => {
    const steps = buildChangesProgression('C', getChangesProgression('major-251'));
    expect(steps.map((s) => s.root)).toEqual(['D', 'G', 'C']);

    const [ii, v, i] = steps;
    // Dm7: ♭3 = F, ♭7 = C.
    expect([ii.thirdNote, ii.seventhNote]).toEqual(['F', 'C']);
    expect([ii.thirdLabel, ii.seventhLabel]).toEqual(['♭3', '♭7']);
    // G7: 3 = B, ♭7 = F.
    expect([v.thirdNote, v.seventhNote]).toEqual(['B', 'F']);
    // Cmaj7: 3 = E, 7 = B.
    expect([i.thirdNote, i.seventhNote]).toEqual(['E', 'B']);
    expect(i.seventhLabel).toBe('7');
  });

  it('uses a dominant V in the minor ii-V-i', () => {
    const steps = buildChangesProgression('A', getChangesProgression('minor-251'));
    expect(steps.map((s) => s.quality)).toEqual(['m7b5', 'dom7', 'min7']);
    // E7 (the V in A minor) has a major 3rd: G#.
    expect(steps[1].thirdNote).toBe('G#');
  });
});

describe('getGuideToneMotion', () => {
  it('finds the semitone guide-tone resolution from G7 to Cmaj7', () => {
    const steps = buildChangesProgression('C', getChangesProgression('major-251'));
    const motion = getGuideToneMotion(steps[1], steps[2]);
    // G7's 3rd (B) holds into Cmaj7's 7th (B): zero motion is the tightest.
    expect(motion.semitones).toBe(0);
  });

  it('holds the common guide tone from ii to V', () => {
    const steps = buildChangesProgression('C', getChangesProgression('major-251'));
    const motion = getGuideToneMotion(steps[0], steps[1]);
    // Dm7's ♭3 (F) is held as G7's ♭7 (F) — the tightest move is none at all.
    expect(motion.semitones).toBe(0);
    expect(motion.fromLabel).toBe('♭3');
    expect(motion.toLabel).toBe('♭7');
  });
});

/** The fret of the root anchor the drill shows for a chord (low-E side, frets 3-12). */
function anchorFret(root: Parameters<typeof getRootAnchors>[0]): number {
  const anchors = getRootAnchors(root);
  const comfy = anchors.filter((a) => a.fret >= 3 && a.fret <= 12);
  const pool = comfy.length ? comfy : anchors;
  return [...pool].sort((a, b) => b.string - a.string || a.fret - b.fret)[0].fret;
}

function planFor(key: (typeof ALL_NOTES)[number], id: string) {
  const steps = buildChangesProgression(key, getChangesProgression(id));
  return { steps, plan: planGuideTones(steps, anchorFret(steps[0].root)) };
}

describe('planGuideTones', () => {
  it('voice-leads C major ii-V-I on the D and G strings', () => {
    const { plan } = planFor('C', 'major-251');
    const show = (i: number) => [
      [plan[i].third.string, plan[i].third.fret, plan[i].third.note],
      [plan[i].seventh!.string, plan[i].seventh!.fret, plan[i].seventh!.note],
    ];
    // Dm7: C on D string 10, F on G string 10.
    expect(show(0).sort()).toEqual([[2, 10, 'F'], [3, 10, 'C']]);
    // G7: B on D string 9, F on G string 10.
    expect(show(1).sort()).toEqual([[2, 10, 'F'], [3, 9, 'B']]);
    // Cmaj7: B on D string 9, E on G string 9.
    expect(show(2).sort()).toEqual([[2, 9, 'E'], [3, 9, 'B']]);
  });

  for (const progression of CHANGES_PROGRESSIONS) {
    it(`never moves a voice more than 2 frets in ${progression.label}, in all 12 keys`, () => {
      for (const key of ALL_NOTES) {
        const { steps, plan } = planFor(key, progression.id);
        plan.forEach((p, i) => {
          const strings = [p.third.string, p.seventh!.string].sort();
          expect(strings).toEqual([2, 3]);
          expect(p.third.note).toBe(steps[i].thirdNote);
          expect(p.seventh!.note).toBe(steps[i].seventhNote);
        });
        for (let i = 1; i < plan.length; i += 1) {
          for (const string of [2, 3]) {
            const fretOf = (p: (typeof plan)[number]) =>
              p.third.string === string ? p.third.fret : p.seventh!.fret;
            const move = Math.abs(fretOf(plan[i]) - fretOf(plan[i - 1]));
            // Cmaj7 to Am7 (I to vi) cannot be done in 2: E and B must reach
            // C and G, a 3-semitone move for one voice whatever the strings.
            const limit = progression.id === 'turnaround-1625' && i === 1 ? 3 : 2;
            expect(
              move,
              `${key} ${progression.id} step ${i} string ${string}`,
            ).toBeLessThanOrEqual(limit);
          }
        }
      }
    });
  }

  it('places only the 3rd when a chord has no 7th', () => {
    const plan = planGuideTones([{ thirdNote: 'E', seventhNote: null }], 8);
    expect(plan[0].seventh).toBeNull();
    expect([2, 3]).toContain(plan[0].third.string);
  });
});

describe('getGuideToneMotion held', () => {
  it('is true only when string and fret are unchanged', () => {
    const { steps, plan } = planFor('C', 'major-251');
    const iiToV = getGuideToneMotion(steps[0], steps[1], plan[0], plan[1]);
    expect(iiToV.semitones).toBe(0);
    expect(iiToV.held).toBe(true);

    // Same pitch class on a different string is not "held".
    const moved = {
      third: { ...plan[1].third, string: 0, fret: 1 },
      seventh: { ...plan[1].seventh!, string: 1, fret: 6 },
    };
    expect(getGuideToneMotion(steps[0], steps[1], plan[0], moved).held).toBe(false);
  });
});
