import { describe, expect, it } from 'vitest';
import { filterToChordTones, getImpliedChordQuality } from './harmonyLayers';
import { buildScalePositions } from './positions';

describe('getImpliedChordQuality', () => {
  it('maps major-family scales to major chords', () => {
    expect(getImpliedChordQuality('major')).toBe('major');
    expect(getImpliedChordQuality('majorPentatonic')).toBe('major');
    expect(getImpliedChordQuality('lydian')).toBe('major');
  });

  it('maps minor-family scales to minor chords', () => {
    expect(getImpliedChordQuality('minor')).toBe('minor');
    expect(getImpliedChordQuality('minorPentatonic')).toBe('minor');
    expect(getImpliedChordQuality('harmonicMinor')).toBe('minor');
  });

  it('uses sevenths where the scale implies one', () => {
    expect(getImpliedChordQuality('mixolydian')).toBe('dom7');
    expect(getImpliedChordQuality('dorian')).toBe('min7');
    expect(getImpliedChordQuality('locrian')).toBe('m7b5');
  });
});

describe('filterToChordTones', () => {
  it('reduces an A minor pentatonic box to the Am arpeggio', () => {
    const box = buildScalePositions('A', 'minorPentatonic')[0];
    const arpeggio = filterToChordTones(box.positions, 'A', 'minor');

    // Every remaining note is A, C, or E.
    for (const position of arpeggio) {
      expect(['A', 'C', 'E']).toContain(position.note);
    }
    // The pentatonic also contains D and G, which must be filtered out.
    expect(arpeggio.length).toBeLessThan(box.positions.length);
    expect(arpeggio.length).toBeGreaterThan(0);
    expect(arpeggio.some((p) => p.note === 'D')).toBe(false);
    expect(arpeggio.some((p) => p.note === 'G')).toBe(false);
  });

  it('keeps the seventh for seventh-chord qualities', () => {
    const box = buildScalePositions('G', 'mixolydian', '3nps')[0];
    const arpeggio = filterToChordTones(box.positions, 'G', 'dom7');
    expect(arpeggio.some((p) => p.note === 'F')).toBe(true);
  });
});
