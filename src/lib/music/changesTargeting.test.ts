import { describe, expect, it } from 'vitest';
import {
  buildChangesProgression,
  getChangesProgression,
  getGuideToneMotion,
} from './changesTargeting';

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
