import { describe, expect, it } from 'vitest';
import { buildScalePositions } from '../music/positions';
import { orderScalePositions } from './pitch';

function cell(position: { string: number; fret: number }): string {
  return `${position.string}:${position.fret}`;
}

describe('orderScalePositions', () => {
  describe('CAGED root-resolved runs', () => {
    it('F major pos 1 ascending ends on octave F, not G above it', () => {
      const box = buildScalePositions('F', 'major', 'caged')[0];
      const run = orderScalePositions(box.positions, 'F', 'ascending', {
        startFret: box.startFret,
      });

      expect(cell(run[0])).toBe('5:1');
      expect(run[0].note).toBe('F');
      expect(cell(run[run.length - 1])).toBe('0:1');
      expect(run[run.length - 1].note).toBe('F');
      expect(run.some((p) => cell(p) === '0:3' && p.note === 'G')).toBe(false);
    });

    it('F major pos 2 ascending includes bass approach and resolves on F', () => {
      const box = buildScalePositions('F', 'major', 'caged')[1];
      const run = orderScalePositions(box.positions, 'F', 'ascending', {
        startFret: box.startFret,
      });

      expect(cell(run[0])).toBe('5:3');
      expect(run[0].note).toBe('G');
      expect(cell(run[run.length - 1])).toBe('1:6');
      expect(run[run.length - 1].note).toBe('F');
    });

    it('C major pos 1 ascending starts on A-string C without open-E prefix', () => {
      const box = buildScalePositions('C', 'major', 'caged')[0];
      const run = orderScalePositions(box.positions, 'C', 'ascending', {
        startFret: box.startFret,
      });

      expect(cell(run[0])).toBe('4:3');
      expect(run[0].note).toBe('C');
      expect(cell(run[run.length - 1])).toBe('1:1');
      expect(run[run.length - 1].note).toBe('C');
    });

    it('F major pos 1 descending reverses ascending and ends on low root', () => {
      const box = buildScalePositions('F', 'major', 'caged')[0];
      const ascending = orderScalePositions(box.positions, 'F', 'ascending', {
        startFret: box.startFret,
      });
      const descending = orderScalePositions(box.positions, 'F', 'descending', {
        startFret: box.startFret,
      });

      expect(descending[0]).toEqual(ascending[ascending.length - 1]);
      expect(descending[descending.length - 1]).toEqual(ascending[0]);
      expect(descending[descending.length - 1].note).toBe('F');
    });
  });

  describe('3NPS built-in walk order', () => {
    it('C major pos 1 keeps low-E walk and ends on octave C', () => {
      const box = buildScalePositions('C', 'major', '3nps')[0];
      const run = orderScalePositions(box.positions, 'C', 'ascending', {
        ordering: 'builtIn',
      });

      expect(cell(run[0])).toBe('5:0');
      expect(run[0].note).toBe('E');
      expect(cell(run[run.length - 1])).toBe('1:1');
      expect(run[run.length - 1].note).toBe('C');
      expect(run.some((p) => p.string === 5)).toBe(true);
    });
  });
});
