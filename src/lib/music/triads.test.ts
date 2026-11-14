import { describe, expect, it } from 'vitest';
import type { NoteName } from '../../types/music';
import { getChordIntervals } from './chords';
import { fingeringFaults } from './fingeringFaults';
import { noteToSemitone } from './notes';
import type { Position } from './positions';
import {
  TRIAD_QUALITIES,
  TRIAD_STRING_SETS,
  buildTriadPositions,
  fingerTriad,
  getTriadStringSet,
  isTriadQuality,
} from './triads';
import { FRET_COUNT, midiAt } from './tuning';

const ROOTS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Frets from the lowest string of the set up, e.g. "5-5-5". */
const frets = (shape: Position) =>
  [...shape.positions].sort((a, b) => b.string - a.string).map((p) => p.fret).join('-');

describe('small triads', () => {
  it('C major on the top three strings: the three inversions up the neck, then again an octave up', () => {
    const shapes = buildTriadPositions('C', 'major', getTriadStringSet('gbe'));
    expect(shapes.map((s) => `${s.shapeLabel}: ${frets(s)}`)).toEqual([
      '2nd inversion: 0-1-0',
      'Root position: 5-5-3',
      '1st inversion: 9-8-8',
      '2nd inversion: 12-13-12',
      'Root position: 17-17-15',
      '1st inversion: 21-20-20',
    ]);
  });

  it('the shapes every guitarist knows come out where they are played', () => {
    const at = (root: NoteName, quality: 'major' | 'minor' | 'dim' | 'aug', set: string) =>
      buildTriadPositions(root, quality, getTriadStringSet(set)).map((s) => `${s.badge} ${frets(s)}`);
    // D major on D G B: the open-D-chord triangle is on G B e; here the A-shape bar.
    expect(at('D', 'major', 'dgb')).toContain('2nd 7-7-7');
    // A minor on G B e: the top of the open Am chord, then the Em-shape top at fret 5.
    expect(at('A', 'minor', 'gbe')).toEqual(expect.arrayContaining(['Root 2-1-0', '2nd 9-10-8', '1st 5-5-5']));
    // G major on E A D: root position 3-2-0 is the bottom of the open G chord.
    expect(at('G', 'major', 'ead')).toContain('Root 3-2-0');
    // B diminished on D G B, root position: 9-7-6.
    expect(at('B', 'dim', 'dgb')).toContain('Root 9-7-6');
    // An augmented triad is the same shape every four frets.
    const aug = buildTriadPositions('C', 'aug', getTriadStringSet('dgb'));
    const shapesOf = aug.map((s) => s.positions.map((p) => p.fret - s.startFret).join(','));
    expect(new Set(shapesOf).size).toBe(1);
    expect(aug.slice(1).map((s, i) => s.startFret - aug[i].startFret).every((gap) => gap === 4)).toBe(true);
  });

  it('in all 12 keys: exactly the three chord tones, low to high in close position, on the neck', () => {
    for (const quality of TRIAD_QUALITIES) {
      const intervals = getChordIntervals(quality);
      for (const root of ROOTS) {
        const rootPc = noteToSemitone(root);
        const tones = intervals.map((i) => (rootPc + i) % 12);
        for (const set of TRIAD_STRING_SETS) {
          const shapes = buildTriadPositions(root, quality, set);
          const where = `${root} ${quality} on ${set.label}`;
          // All three inversions are there, and the list climbs the neck.
          expect(new Set(shapes.map((s) => s.shapeLabel)).size, where).toBe(3);
          expect(shapes.map((s) => s.number), where).toEqual(shapes.map((_, i) => i + 1));
          for (let i = 1; i < shapes.length; i++) {
            expect(shapes[i].startFret, where).toBeGreaterThanOrEqual(shapes[i - 1].startFret);
          }
          for (const shape of shapes) {
            const here = `${where} ${shape.shapeLabel} ${frets(shape)}`;
            expect(shape.positions.map((p) => p.string), here).toEqual(set.strings);
            expect(shape.mutedStrings.length, here).toBe(3);
            expect(shape.positions.map((p) => noteToSemitone(p.note)).sort(), here).toEqual([...tones].sort());
            for (const p of shape.positions) {
              expect(p.fret, here).toBeGreaterThanOrEqual(0);
              expect(p.fret, here).toBeLessThanOrEqual(FRET_COUNT);
            }
            // Close position: rising pitch, and the whole triad inside an octave.
            const midis = shape.positions.map((p) => midiAt(p.string, p.fret));
            expect(midis[1], here).toBeGreaterThan(midis[0]);
            expect(midis[2], here).toBeGreaterThan(midis[1]);
            expect(midis[2] - midis[0], here).toBeLessThan(12);
            // The label names the lowest note.
            const lowest = (noteToSemitone(shape.positions[0].note) - rootPc + 12) % 12;
            const turn = ['Root position', '1st inversion', '2nd inversion'].indexOf(shape.shapeLabel!);
            expect(lowest, here).toBe(intervals[turn]);
          }
        }
      }
    }
  });

  it('every triad can be fingered: four frets, or five for the root-position diminished triad low down', () => {
    const faults: string[] = [];
    const wide = new Set<string>();
    for (const quality of TRIAD_QUALITIES) {
      for (const root of ROOTS) {
        for (const set of TRIAD_STRING_SETS) {
          for (const shape of buildTriadPositions(root, quality, set)) {
            const fretted = shape.positions.filter((p) => p.fret > 0).map((p) => p.fret);
            const reach = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
            if (reach > 3) wide.add(`${quality} ${shape.shapeLabel} on ${set.label}`);
            for (const fault of fingeringFaults(shape, 4)) {
              faults.push(`${root} ${quality} ${set.label} ${frets(shape)}: ${fault}`);
            }
          }
        }
      }
    }
    expect([...new Set(faults)]).toEqual([]);
    // Root, minor 3rd and flat 5th stacked across strings a 4th apart fall two
    // frets back each time: 7-5-3. It is the reach of two whole steps on one
    // string, fingered 1-2-4. Every other triad fits four frets.
    expect([...wide].sort()).toEqual([
      'dim Root position on A D G',
      'dim Root position on E A D',
    ]);
  });

  it('fingers: a barre on the lowest fret, one finger per fret above it', () => {
    expect(fingerTriad([5, 5, 5])).toEqual([1, 1, 1]);
    expect(fingerTriad([5, 5, 3])).toEqual([3, 4, 1]);
    expect(fingerTriad([9, 8, 8])).toEqual([2, 1, 1]);
    expect(fingerTriad([9, 7, 6])).toEqual([4, 2, 1]);
    expect(fingerTriad([3, 2, 0])).toEqual([2, 1, 0]);
    expect(fingerTriad([0, 1, 0])).toEqual([0, 1, 0]);
    expect(fingerTriad([5, 6, 6])).toEqual([1, 2, 3]);
    // An open string between two notes on one fret: two fingers, not a barre.
    expect(fingerTriad([1, 0, 1])).toEqual([1, 0, 2]);
    // The wide diminished shape: index, middle, little finger.
    expect(fingerTriad([7, 5, 3])).toEqual([4, 2, 1]);
  });

  it('only the four triad qualities have small triads', () => {
    expect(isTriadQuality('major')).toBe(true);
    expect(isTriadQuality('dim')).toBe(true);
    expect(isTriadQuality('dom7')).toBe(false);
    expect(isTriadQuality('sus4')).toBe(false);
  });
});
