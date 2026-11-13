import { describe, expect, it } from 'vitest';
import type { NoteName } from '../../types/music';
import { getScaleIntervalsForKeyMode } from './diatonic';
import { CHROMATIC, noteToSemitone, type NotationPreference } from './notes';
import {
  PROGRESSION_LIBRARY,
  PROGRESSION_LIBRARY_GROUPS,
  getProgressionLibraryGroups,
} from './progressionLibrary';
import {
  PROGRESSIONS,
  formatProgressionChords,
  getProgressionById,
  resolveProgression,
} from './progressions';

const LETTER_PITCH: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Pitch class of a chord name's root ("Bb7" is 10, "F#m7" is 6). */
function rootPitchClass(chordName: string): number {
  const match = /^([A-G])(bb|##|b|#)?/.exec(chordName);
  if (!match) throw new Error(`No root in ${chordName}`);
  const accidental =
    match[2] === 'b' ? -1 : match[2] === '#' ? 1 : match[2] === 'bb' ? -2 : match[2] === '##' ? 2 : 0;
  return (LETTER_PITCH[match[1]] + accidental + 12) % 12;
}

const NOTATIONS: NotationPreference[] = ['sharps', 'flats'];

describe('progression library', () => {
  it('has unique ids', () => {
    const ids = PROGRESSION_LIBRARY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the ids saved selections use', () => {
    for (const id of [
      'blues-145',
      'doo-wop',
      'pop-1564',
      'axis',
      'rock-1465',
      'jazz-251',
      'minor-145',
      'minor-6415',
    ]) {
      expect(getProgressionById(id), id).toBeDefined();
    }
  });

  it('puts every entry in one of the five groups, and fills each group', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      expect(PROGRESSION_LIBRARY_GROUPS).toContain(entry.group);
    }
    for (const { group, entries } of getProgressionLibraryGroups()) {
      expect(entries.length, group).toBeGreaterThan(0);
    }
  });

  it('gives every entry a why and an aim', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      expect(entry.why.length, entry.id).toBeGreaterThan(20);
      expect(entry.aim.length, entry.id).toBeGreaterThan(20);
      expect(entry.steps.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('makes the 12-bar forms 12 steps', () => {
    for (const id of ['blues-12', 'blues-minor']) {
      expect(PROGRESSION_LIBRARY.find((entry) => entry.id === id)?.steps).toHaveLength(12);
    }
  });

  it('feeds the deck picker the same ids, in the same order', () => {
    expect(PROGRESSIONS.map((p) => p.id)).toEqual(
      PROGRESSION_LIBRARY.map((entry) => entry.id),
    );
  });

  it('spells every chord on the right root in all 12 keys', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      const scale = getScaleIntervalsForKeyMode(entry.keyMode);
      for (const key of CHROMATIC) {
        for (const notation of NOTATIONS) {
          const resolved = resolveProgression(key, PROGRESSIONS.find((p) => p.id === entry.id)!, notation);
          expect(resolved).toHaveLength(entry.steps.length);
          resolved.forEach((chord, index) => {
            const step = entry.steps[index];
            const offset = step.offset ?? scale[step.degree - 1];
            const expected = (noteToSemitone(key) + offset) % 12;
            const where = `${entry.id} step ${index} in ${key} (${notation}): ${chord.chordName}`;
            expect(rootPitchClass(chord.chordName), where).toBe(expected);
            expect(chord.chordName, where).not.toMatch(/bb|##/);
            expect(chord.chordName, where).not.toMatch(/undefined/);
          });
        }
      }
    }
  });

  it('writes well-known progressions the way a player would', () => {
    const names = (id: string, key: NoteName) =>
      formatProgressionChords(
        resolveProgression(key, getProgressionById(id)!, 'sharps'),
      );
    expect(names('blues-12', 'E').split(' – ').slice(0, 5)).toEqual(['E7', 'E7', 'E7', 'E7', 'A7']);
    expect(names('jazz-251', 'C')).toBe('Dm7 – G7 – Cmaj7 – Cmaj7');
    expect(names('turnaround-1625', 'C')).toBe('Cmaj7 – Am7 – Dm7 – G7');
    expect(names('vamp-mixolydian', 'A')).toBe('A7 – D');
    expect(names('vamp-dorian', 'A')).toBe('Am7 – D7');
    expect(names('borrowed-bvii', 'D')).toBe('D – C – G');
    expect(names('creep-lift', 'G')).toBe('G – B – C – Cm');
    expect(names('mario-cadence', 'C')).toBe('Ab – Bb – C');
    expect(names('andalusian', 'A')).toBe('Am – G – F – E');
    expect(names('lydian-float', 'C')).toBe('Cmaj7 – D/C');
    expect(names('tritone-sub', 'C')).toBe('Dm7 – Db7 – Cmaj7');
    expect(names('third-cycle', 'C')).toBe('Cmaj7 – Abmaj7 – Emaj7');
    expect(names('backdoor', 'C')).toBe('Cmaj7 – Fm7 – Bb7 – Cmaj7');
    expect(names('city-pop', 'C')).toBe('Fmaj7 – E7 – Am7 – Gm7 – C7');
    expect(names('blues-minor', 'A').split(' – ').slice(8)).toEqual(['F7', 'E7', 'Am7', 'E7']);
  });
});
