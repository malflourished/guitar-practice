import { describe, expect, it } from 'vitest';
import {
  FORMULA_TARGETS,
  buildFormulaSpec,
  getFormulaTarget,
} from './intervalFormulas';

describe('buildFormulaSpec', () => {
  it('reads the major scale as all-natural with no alterations', () => {
    const spec = buildFormulaSpec(getFormulaTarget('scale:major'));
    expect(spec.tones.map((t) => t.label)).toEqual(['R', '2', '3', '4', '5', '6', '7']);
    expect(spec.tones.every((t) => !t.altered)).toBe(true);
  });

  it('flags the flattened 3rd and 7th of a min7 chord', () => {
    const spec = buildFormulaSpec(getFormulaTarget('chord:min7'));
    const altered = spec.tones.filter((t) => t.altered).map((t) => t.label);
    expect(altered).toEqual(['♭3', '♭7']);
  });

  it('marks dorian as flat 3 and flat 7 against major', () => {
    const spec = buildFormulaSpec(getFormulaTarget('scale:dorian'));
    const altered = spec.tones.filter((t) => t.altered).map((t) => t.label);
    expect(altered).toEqual(['♭3', '♭7']);
  });

  it('exposes every curated target with a label', () => {
    for (const target of FORMULA_TARGETS) {
      const spec = buildFormulaSpec(target);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.tones[0].label).toBe('R');
    }
  });
});
