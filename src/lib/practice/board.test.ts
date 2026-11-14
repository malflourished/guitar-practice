import { describe, expect, it } from 'vitest';
import { ALL_NOTES } from '../colors';
import { noteToSemitone } from '../music';
import { boxRegion, changesChords } from './board';
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
