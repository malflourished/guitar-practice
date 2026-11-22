import { describe, expect, it } from 'vitest';
import { ALL_NOTES } from '../colors';
import { noteToSemitone } from '../music';
import { BAR_CHOICES, DEFAULT_BARS, barsLabel, boxFingers, boxRegion, changesChords, nextBars, validBars } from './board';
import type { KeyQuality } from './plan';

const QUALITIES: KeyQuality[] = ['minor', 'major'];
const cells = (positions: { string: number; fret: number }[]) => positions.map((p) => `${p.string}:${p.fret}`).sort();
const pcs = (positions: { note: string }[]) => new Set(positions.map((p) => noteToSemitone(p.note as never)));

describe('the five boxes', () => {
  it('uses the usual minor numbering: A minor box 1 is frets 5 to 8', () => {
    expect([1, 2, 3, 4, 5].map((box) => { const r = boxRegion('A', 'minor', box); return [r.startFret, r.endFret]; }))
      .toEqual([[5, 8], [7, 10], [9, 13], [0, 3], [2, 5]]);
  });

  it('gives a major key the boxes of its relative minor, number for number', () => {
    for (let box = 1; box <= 5; box++) {
      expect(cells(boxRegion('C', 'major', box).positions)).toEqual(cells(boxRegion('A', 'minor', box).positions));
      expect(cells(boxRegion('F', 'major', box).positions)).toEqual(cells(boxRegion('D', 'minor', box).positions));
    }
  });

  it('starts every box on the right scale tone in every key, with twelve notes and the root in it', () => {
    for (const root of ALL_NOTES) for (const quality of QUALITIES) {
      const frame = (noteToSemitone(root) + (quality === 'minor' ? 0 : 9)) % 12;
      const boxes = [1, 2, 3, 4, 5].map((box) => boxRegion(root, quality, box));
      expect(new Set(boxes.map((r) => cells(r.positions).join())).size).toBe(5);
      boxes.forEach((region, index) => {
        const lowest = Math.min(...region.positions.filter((p) => p.string === 5).map((p) => p.fret));
        expect((4 + lowest - frame + 12) % 12).toBe([0, 3, 5, 7, 10][index]);
        expect(region.positions).toHaveLength(12);
        expect(pcs(region.positions).has(noteToSemitone(root))).toBe(true);
      });
    }
  });

  it('gives sessions saved before plans the lowest box, as they had', () => {
    expect(boxRegion('A', 'minor', 0).startFret).toBe(0);
    expect(boxRegion('E', 'minor', 0)).toEqual(boxRegion('E', 'minor', 1));
  });
});

describe('the Changes block in one window', () => {
  it('plays i–iv–V in minor and I–IV–V in major', () => {
    expect(changesChords('A', 'minor', boxRegion('A', 'minor', 1)).map((c) => `${c.numeral} ${c.root} ${c.quality}`))
      .toEqual(['i A minor', 'iv D minor', 'V E major']);
    expect(changesChords('C', 'major', boxRegion('C', 'major', 1)).map((c) => `${c.numeral} ${c.root} ${c.quality}`))
      .toEqual(['I C major', 'IV F major', 'V G major']);
  });

  it('shows every chord\'s root, 3rd and 5th inside the box\'s frets, in every key and box', () => {
    for (const root of ALL_NOTES) for (const quality of QUALITIES) for (let box = 1; box <= 5; box++) {
      const region = boxRegion(root, quality, box);
      for (const chord of changesChords(root, quality, region)) {
        const chordRoot = noteToSemitone(chord.root);
        const triad = [0, chord.quality === 'minor' ? 3 : 4, 7].map((n) => (chordRoot + n) % 12);
        expect([...pcs(chord.tones)].sort()).toEqual([...triad].sort());
        expect(chord.tones.every((p) => p.fret >= region.startFret && p.fret <= region.endFret)).toBe(true);
        expect(chord.grip.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps the backing chord near the window', () => {
    const region = boxRegion('A', 'minor', 2); // frets 7–10
    for (const chord of changesChords('A', 'minor', region)) {
      const frets = chord.grip.map((p) => p.fret);
      expect(Math.min(...frets)).toBeGreaterThanOrEqual(4);
      expect(Math.max(...frets)).toBeLessThanOrEqual(13);
    }
  });

  it('puts the V chord\'s 3rd, which the pentatonic lacks, in reach in A minor box 1', () => {
    const [, , five] = changesChords('A', 'minor', boxRegion('A', 'minor', 1));
    expect(cells(five.tones.filter((p) => p.note === 'G#'))).toEqual(['3:6']);
  });
});

describe('how long a chord lasts in the Changes block', () => {
  it('starts at one bar each and steps 1, 2, 4 and round again', () => {
    expect(DEFAULT_BARS).toEqual([1, 1, 1]);
    expect(BAR_CHOICES.map(nextBars)).toEqual([2, 4, 1]);
    // A length from an older build that is no longer offered goes back to the start.
    expect(nextBars(3)).toBe(1);
  });

  it('only ever offers whole bars, so the changes stay on the count', () => {
    expect(BAR_CHOICES.every((bars) => Number.isInteger(bars) && bars >= 1)).toBe(true);
  });

  it('accepts three saved lengths from the choices and nothing else', () => {
    expect(validBars([2, 1, 1])).toBe(true);
    expect(validBars([4, 4, 4])).toBe(true);
    for (const bad of [[1, 1], [1, 1, 1, 1], [1, 3, 1], [1, '2', 1], '1,1,1', null, undefined]) {
      expect(validBars(bad)).toBe(false);
    }
  });

  it('names a length in bars', () => {
    expect(barsLabel(1)).toBe('1 bar');
    expect(barsLabel(4)).toBe('4 bars');
  });
});

describe('the fingering of a pentatonic box', () => {
  /** Fingers from the low E string to the high e, low note first: "14 13 13 13 14 14". */
  const fingering = (root: 'A' | 'E', box: number) => {
    const region = boxRegion(root, 'minor', box);
    const fingers = boxFingers(region);
    return [5, 4, 3, 2, 1, 0].map((string) => region.positions
      .filter((p) => p.string === string).sort((a, b) => a.fret - b.fret)
      .map((p) => fingers.get(`${p.string}:${p.fret}`)).join('')).join(' ');
  };
  // String 5 is the low E here if the low E's lowest fret is the box's anchor.
  const lowToHigh = (root: 'A' | 'E', box: number) => {
    const region = boxRegion(root, 'minor', box);
    const lowE = region.positions.some((p) => p.string === 5 && p.fret === region.startFret) || box !== 1;
    return lowE ? fingering(root, box) : fingering(root, box).split(' ').reverse().join(' ');
  };

  it('plays box 1 as every guitarist learns it: 1-4, 1-3, 1-3, 1-3, 1-4, 1-4', () => {
    expect(['14 13 13 13 14 14', '14 14 13 13 13 14']).toContain(lowToHigh('A', 1));
    expect(fingering('A', 1).split(' ').sort().join(' ')).toBe('13 13 13 14 14 14');
  });

  it('gives every note of every box a finger from 1 to 4, low note below high note', () => {
    for (let box = 1; box <= 5; box++) {
      const region = boxRegion('A', 'minor', box);
      const fingers = boxFingers(region);
      expect(fingers.size).toBe(region.positions.length);
      if (region.startFret === 0) continue; // the open position has its own rule, tested below
      for (const pair of fingering('A', box).split(' ')) {
        expect(pair).toMatch(/^[1-4]{2}$/);
        expect(Number(pair[0])).toBeLessThan(Number(pair[1]));
      }
    }
  });

  it('uses 1 and 4 for a three-fret stretch, and 2 and 4 on a string that starts above the box\'s lowest fret', () => {
    for (let box = 1; box <= 5; box++) {
      const region = boxRegion('A', 'minor', box);
      if (region.startFret === 0) continue;
      const fingers = boxFingers(region);
      for (let string = 0; string < 6; string++) {
        const frets = region.positions.filter((p) => p.string === string).map((p) => p.fret).sort((a, b) => a - b);
        const pair = frets.map((fret) => fingers.get(`${string}:${fret}`)).join('');
        if (frets[1] - frets[0] === 3) expect(pair).toBe('14');
        else expect(pair).toBe(frets[0] === region.startFret ? '13' : '24');
      }
    }
  });

  it('in the open position, open strings take no finger and each fret takes its own', () => {
    const region = boxRegion('E', 'minor', 1);
    expect(region.startFret).toBe(0);
    const fingers = boxFingers(region);
    for (const p of region.positions) expect(fingers.get(`${p.string}:${p.fret}`)).toBe(Math.min(p.fret, 4));
  });
});
