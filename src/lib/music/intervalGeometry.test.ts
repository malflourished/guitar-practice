import { describe, expect, it } from 'vitest';
import type { FretPosition } from '../../types/music';
import {
  crossesGtoB,
  getDirectedTargets,
  getPlayableAnchors,
} from './intervalGeometry';

// Low E string, fret 8 = C (open E semitone 4 + 8 = 12 → C).
const lowEC: FretPosition = { string: 5, fret: 8, note: 'C' };

describe('getDirectedTargets', () => {
  it('walks the same string in string scope', () => {
    const targets = getDirectedTargets(lowEC, 7, 'string');
    expect(targets).toEqual([{ string: 5, fret: 15, note: 'G' }]);
  });

  it('collects same pitch class within a hand window in position scope', () => {
    const targets = getDirectedTargets(lowEC, 7, 'position');
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.note).toBe('G');
      expect(t.fret).toBeGreaterThanOrEqual(7);
      expect(t.fret).toBeLessThanOrEqual(12);
    }
  });

  it('returns every occurrence in neck scope', () => {
    const targets = getDirectedTargets(lowEC, 7, 'neck');
    expect(targets.every((t) => t.note === 'G')).toBe(true);
    expect(targets.length).toBeGreaterThan(6);
  });
});

describe('crossesGtoB', () => {
  it('flags shapes that straddle the G and B strings', () => {
    // Root C on the G string (string 2), fret 5.
    const gStringC: FretPosition = { string: 2, fret: 5, note: 'C' };
    const targets = getDirectedTargets(gStringC, 4, 'position');
    expect(crossesGtoB(gStringC, targets)).toBe(true);
  });

  it('does not flag a single-string shape', () => {
    expect(crossesGtoB(lowEC, getDirectedTargets(lowEC, 7, 'string'))).toBe(false);
  });
});

describe('getPlayableAnchors', () => {
  it('only returns roots that have a reachable target', () => {
    const anchors = getPlayableAnchors('C', 4, 'string');
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.fret + 4).toBeLessThanOrEqual(24);
    }
  });
});
