import { describe, expect, it } from 'vitest';
import type { ChordQuality, NoteName } from '../../types/music';
import { CHORD_QUALITIES, getChordIntervals } from './chords';
import { fingeringFaults } from './fingeringFaults';
import { noteToSemitone } from './notes';
import { buildChordPositions, type Position } from './positions';
import { FRET_COUNT } from './tuning';

const ROOTS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAIN: ChordQuality[] = ['major', 'minor', 'dom7', 'maj7', 'min7'];
const TRIADS: ChordQuality[] = ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4'];

const frets = (shape: Position) =>
  [5, 4, 3, 2, 1, 0]
    .map((string) => {
      if (shape.mutedStrings.includes(string)) return 'x';
      return String(shape.positions.find((p) => p.string === string)?.fret ?? '?');
    })
    .join('-');

const tones = (root: NoteName, quality: ChordQuality) =>
  new Set(getChordIntervals(quality).map((i) => (noteToSemitone(root) + i) % 12));

describe('chord shapes', () => {
  it('C major shows the five CAGED shapes inside frets 0 to 13, each named by its letter', () => {
    const shapes = buildChordPositions('C', 'major', 'caged');
    expect(shapes.slice(0, 5).map((s) => [s.shapeLabel, s.startFret, frets(s)])).toEqual([
      ['Open C shape', 0, 'x-3-2-0-1-0'],
      ['A shape', 3, 'x-3-5-5-5-3'],
      ['G shape', 5, 'x-x-5-5-5-8'],
      ['E shape', 8, '8-10-10-9-8-8'],
      ['D shape', 10, 'x-x-10-12-13-12'],
    ]);
    expect(shapes.slice(0, 5).every((s) => s.endFret <= 13)).toBe(true);
    // The same five again an octave up, as far as the neck goes.
    expect(shapes.slice(5).map((s) => [s.shapeLabel, s.startFret])).toEqual([
      ['C shape', 12],
      ['A shape', 15],
      ['G shape', 17],
      ['E shape', 20],
    ]);
  });

  it('the main qualities have every CAGED letter in every key (min7 has no G shape)', () => {
    for (const quality of MAIN) {
      const wanted = quality === 'min7' ? ['A', 'C', 'D', 'E'] : ['A', 'C', 'D', 'E', 'G'];
      for (const root of ROOTS) {
        const letters = new Set(
          buildChordPositions(root, quality, 'caged').map((s) => s.shapeLabel?.replace('Open ', '').charAt(0)),
        );
        expect([...letters].sort(), `${root} ${quality}`).toEqual(wanted);
      }
    }
  });

  it('the shapes of a main quality follow the CAGED order up the neck', () => {
    const order = 'CAGED';
    for (const quality of MAIN) {
      for (const root of ROOTS) {
        const letters = buildChordPositions(root, quality, 'caged').map(
          (s) => s.shapeLabel!.replace('Open ', '').charAt(0),
        );
        for (let i = 1; i < letters.length; i++) {
          let next = order[(order.indexOf(letters[i - 1]) + 1) % 5];
          if (quality === 'min7' && next === 'G') next = 'E';
          expect(letters[i], `${root} ${quality}: ${letters.join('')}`).toBe(next);
        }
      }
    }
  });

  it('every shape of every chord, in all 12 keys, holds only chord tones and stays on the neck', () => {
    for (const quality of CHORD_QUALITIES) {
      for (const root of ROOTS) {
        const allowed = tones(root, quality);
        const shapes = buildChordPositions(root, quality, 'caged');
        expect(shapes.length, `${root} ${quality}`).toBeGreaterThan(0);
        for (const shape of shapes) {
          const where = `${root} ${quality} ${shape.shapeLabel ?? ''} ${frets(shape)}`;
          const pcs = new Set(shape.positions.map((p) => noteToSemitone(p.note)));
          for (const pc of pcs) expect(allowed.has(pc), where).toBe(true);
          for (const p of shape.positions) {
            expect(p.fret, where).toBeGreaterThanOrEqual(0);
            expect(p.fret, where).toBeLessThanOrEqual(FRET_COUNT);
          }
          // The strings that are not played are marked, and no string is both.
          expect(shape.positions.length + shape.mutedStrings.length, where).toBe(6);
          expect(new Set([...shape.positions.map((p) => p.string), ...shape.mutedStrings]).size, where).toBe(6);
        }
      }
    }
  });

  it('a triad shape holds all three notes; a seventh chord may only leave out its perfect fifth', () => {
    for (const quality of CHORD_QUALITIES) {
      const intervals = getChordIntervals(quality);
      if (intervals.length > 4) continue; // extended chords: see the next test
      for (const root of ROOTS) {
        const rootPc = noteToSemitone(root);
        for (const shape of buildChordPositions(root, quality, 'caged')) {
          const where = `${root} ${quality} ${shape.shapeLabel ?? ''} ${frets(shape)}`;
          const pcs = new Set(shape.positions.map((p) => noteToSemitone(p.note)));
          const missing = intervals.filter((i) => !pcs.has((rootPc + i) % 12));
          if (TRIADS.includes(quality)) expect(missing, where).toEqual([]);
          else expect(missing.filter((i) => i !== 7), where).toEqual([]);
        }
      }
    }
  });

  it('an extended chord keeps its third, its seventh and the note it is named for', () => {
    for (const quality of CHORD_QUALITIES) {
      const intervals = getChordIntervals(quality);
      if (intervals.length <= 4) continue;
      const [, third, , seventh] = intervals;
      const top = intervals[intervals.length - 1];
      // An 11th over a major third is played without the third (it clashes).
      const needed = quality === 'dom11' ? [seventh, top] : [third, seventh, top];
      for (const root of ROOTS) {
        const rootPc = noteToSemitone(root);
        for (const shape of buildChordPositions(root, quality, 'caged')) {
          const where = `${root} ${quality} ${frets(shape)}`;
          const pcs = new Set(shape.positions.map((p) => noteToSemitone(p.note)));
          for (const i of needed) expect(pcs.has((rootPc + i) % 12), `${where} lacks ${i}`).toBe(true);
        }
      }
    }
  });

  it('every fingering can be played: four frets at most, sensible fingers, real barres', () => {
    const faults: string[] = [];
    for (const quality of CHORD_QUALITIES) {
      for (const root of ROOTS) {
        for (const shape of buildChordPositions(root, quality, 'caged')) {
          for (const fault of fingeringFaults(shape)) {
            faults.push(`${root} ${quality} ${shape.shapeLabel ?? ''} ${frets(shape)}: ${fault}`);
          }
        }
      }
    }
    expect([...new Set(faults)]).toEqual([]);
  });

  it('a shape on open strings is fingered around them', () => {
    // B minor 7 from the C shape: x-x-0-2-0-2.
    const bm7 = buildChordPositions('B', 'min7', 'caged').find((s) => s.startFret <= 2 && s.shapeLabel === 'C shape')!;
    expect(frets(bm7)).toBe('x-x-0-2-0-2');
    expect(bm7.positions.filter((p) => p.fret === 0).every((p) => p.finger === 0)).toBe(true);
    expect(bm7.positions.filter((p) => p.fret > 0).map((p) => p.finger).sort()).toEqual([1, 2]);
  });

  it('Progressions keeps the E and A shapes and the open chords it was specified on', () => {
    for (const quality of MAIN) {
      for (const root of ROOTS) {
        const labels = new Set(buildChordPositions(root, quality).map((s) => s.shapeLabel));
        for (const label of labels) {
          expect(['E shape', 'A shape', `Open ${root} shape`], `${root} ${quality}`).toContain(label);
        }
      }
    }
    // D7, the blues in D: the open chord, then the A and E shapes, twice.
    expect(buildChordPositions('D', 'dom7').map((s) => s.startFret)).toEqual([0, 5, 10, 17, 22]);
    expect(buildChordPositions('C', 'minor').map((s) => s.startFret)).toEqual([3, 8, 15, 20]);
  });

  it('an open chord replaces its own movable shape and no other', () => {
    for (const quality of MAIN) {
      for (const root of ROOTS) {
        const shapes = buildChordPositions(root, quality, 'caged');
        const keys = shapes.map((s) => `${s.startFret}:${frets(s)}`);
        expect(new Set(keys).size, `${root} ${quality}`).toBe(keys.length);
        const open = shapes.filter((s) => s.shapeLabel?.startsWith('Open'));
        expect(open.length, `${root} ${quality}`).toBeLessThanOrEqual(1);
        if (open[0]) {
          const letter = open[0].shapeLabel!.charAt(5);
          expect(letter).toBe(root);
          // That letter's next appearance is an octave up.
          const again = shapes.find((s) => s.shapeLabel === `${letter} shape`);
          if (again) expect(again.startFret, `${root} ${quality}`).toBeGreaterThanOrEqual(9);
        }
      }
    }
  });
});
