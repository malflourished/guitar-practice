import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifest from '../../../public/audio/manifest.json';
import sampleMap from './sampleMap.json';
import { GUITAR_INSTRUMENTS, INSTRUMENT_SAMPLES, chooseSample } from './instruments';
import { barsBeat, barsPattern, chordPattern, loopTempo, sequencePattern } from './pattern';
import { ALL_NOTES } from '../colors';
import { buildScalePositions, buildChordPositions } from '../music';

describe('bundled guitar banks', () => {
  it('ships every sample with a matching checksum and no runtime remote URLs', () => {
    let bytes = 0;
    for (const sample of manifest) {
      const url = new URL(`../../../public/audio/${sample.file}`, import.meta.url);
      expect(createHash('sha256').update(readFileSync(url)).digest('hex')).toBe(sample.sha256);
      expect(sample.file).not.toMatch(/^https?:/);
      bytes += statSync(url).size;
    }
    expect(sampleMap).toEqual(manifest.map(sample => Object.fromEntries(Object.entries(sample).filter(([key]) => !['source', 'sha256'].includes(key)))));
    expect(bytes).toBeLessThan(4_000_000);
    expect(manifest.length).toBeGreaterThan(60);
  });
  it('has a usable recording for every guitar note in every preset', () => {
    for (const instrument of GUITAR_INSTRUMENTS) {
      const samples = INSTRUMENT_SAMPLES[instrument.name].samples;
      for (let midi = 40; midi <= 88; midi++) {
        const sample = chooseSample(samples, midi, undefined, 0.8, 0);
        expect(sample).toBeDefined();
        expect(Math.abs(sample.midi - midi)).toBeLessThanOrEqual(7);
      }
    }
  });
  it('uses soft electric attacks and alternates recorded takes', () => {
    const samples = INSTRUMENT_SAMPLES.electric_guitar_clean.samples;
    expect(chooseSample(samples, 40, 5, 0.5, 0).layer).toBe('soft');
    expect(chooseSample(samples, 40, 5, 0.8, 0).file).not.toBe(chooseSample(samples, 40, 5, 0.8, 1).file);
    expect(chooseSample(samples, 40, 5, 0.8, 0).string).toBe(5);
  });
});

describe('musical practice patterns', () => {
  it('gives each chord a full four-beat bar and scales an even eighth-note grid', () => {
    const positions = buildScalePositions('A', 'minorPentatonic')[0].positions;
    const scale = sequencePattern(positions, 0.5);
    expect(scale.beats).toBe(positions.length / 2);
    expect(scale.events[1].beat).toBe(0.5);
    const progression = chordPattern([positions.slice(0, 3), positions.slice(3, 6), positions.slice(6, 9)]);
    expect(progression.beats).toBe(12);
    expect(progression.events.map(event => event.beat)).toEqual([0, 4, 8]);
  });
  it('lets each chord last whole bars, striking it again on every bar', () => {
    const positions = buildScalePositions('A', 'minorPentatonic')[0].positions;
    const grips = [positions.slice(0, 3), positions.slice(3, 6), positions.slice(6, 9)];
    // One bar each is the loop as it was.
    expect(barsPattern(grips, [1, 1, 1])).toEqual(chordPattern(grips));
    // i for two bars, then iv and V: a four-bar phrase.
    const phrase = barsPattern(grips, [2, 1, 1]);
    expect(phrase.beats).toBe(16);
    expect(phrase.events.map(event => event.beat)).toEqual([0, 4, 8, 12]);
    expect(phrase.events.map(event => event.index)).toEqual([0, 0, 1, 2]);
    expect(phrase.events.every(event => event.duration < 4)).toBe(true);
    expect(barsPattern(grips, [4, 4, 4]).beats).toBe(48);
    // A missing or broken length is one bar, never an empty loop.
    expect(barsPattern(grips, [0, NaN]).beats).toBe(12);
  });
  it('keeps its place in the loop when a chord changes length', () => {
    // A chord that is not playing: nothing that is heard moves.
    expect(barsBeat(1.5, [1, 1, 1], [1, 4, 1])).toBe(1.5);
    // A chord before the one playing: the same beat of the same chord, later in the loop.
    expect(barsBeat(5, [1, 1, 1], [2, 1, 1])).toBe(9);
    expect(barsBeat(9, [2, 1, 1], [1, 1, 1])).toBe(5);
    // The chord playing, made longer: it carries on from the bar it is in.
    expect(barsBeat(6.5, [1, 2, 1], [1, 4, 1])).toBe(6.5);
    // The chord playing, made shorter than the bar it is in: its last bar, so the next chord comes at the bar line.
    expect(barsBeat(14, [4, 1, 1], [1, 1, 1])).toBe(2);
    expect(barsBeat(14, [4, 1, 1], [2, 1, 1])).toBe(6);
    // Past the end of the loop: the top.
    expect(barsBeat(12, [1, 1, 1], [1, 1, 2])).toBe(0);
  });
  it('only raises tempo after four full loops and caps it at 120', () => {
    expect(loopTempo(72, 3, true)).toBe(72);
    expect(loopTempo(72, 4, true)).toBe(76);
    expect(loopTempo(116, 20, true)).toBe(120);
    expect(loopTempo(72, 40, false)).toBe(72);
  });
  it('has playable scale and chord positions for all twelve practice keys', () => {
    for (const root of ALL_NOTES) {
      expect(buildScalePositions(root, 'minorPentatonic')[0].positions.length).toBeGreaterThan(5);
      for (const quality of ['minor', 'major'] as const) {
        const region = buildChordPositions(root, quality)[0];
        expect(region.positions.length).toBeGreaterThanOrEqual(3);
        expect(region.positions.every(p => p.fret >= 0 && p.fret <= 24)).toBe(true);
      }
    }
  });
});
