import { describe, expect, it } from 'vitest';
import { buildScalePositions } from '../music/positions';
import { noteToSemitone } from '../music/notes';
import { orderScalePositions, positionToMidi } from './pitch';
import type { FretPosition } from '../../types/music';

function lowestMidiOfNote(positions: FretPosition[], note: string): number {
  return Math.min(
    ...positions.filter((p) => p.note === note).map(positionToMidi),
  );
}

function highestMidi(positions: FretPosition[]): number {
  return Math.max(...positions.map(positionToMidi));
}

function lowestMidi(positions: FretPosition[]): number {
  return Math.min(...positions.map(positionToMidi));
}

describe('orderScalePositions', () => {
  describe('CAGED box runs', () => {
    it('F major pos 1 ascending starts on the lowest F and plays to the top of the box', () => {
      const box = buildScalePositions('F', 'major', 'caged')[0];
      const run = orderScalePositions(box.positions, 'F', 'ascending');

      expect(run[0].note).toBe('F');
      expect(positionToMidi(run[0])).toBe(lowestMidiOfNote(box.positions, 'F'));
      // Run covers everything visualized from the root up — including notes
      // above the octave root that the old logic trimmed.
      expect(positionToMidi(run[run.length - 1])).toBe(
        highestMidi(box.positions),
      );
    });

    it('F major pos 2 ascending starts on the root, not bass approach notes', () => {
      const box = buildScalePositions('F', 'major', 'caged')[1];
      const run = orderScalePositions(box.positions, 'F', 'ascending');

      expect(run[0].note).toBe('F');
      expect(positionToMidi(run[0])).toBe(lowestMidiOfNote(box.positions, 'F'));
    });

    it('runs are strictly ascending with no repeated pitches', () => {
      const box = buildScalePositions('A', 'minorPentatonic', 'caged')[0];
      const run = orderScalePositions(box.positions, 'A', 'ascending');

      for (let i = 1; i < run.length; i += 1) {
        expect(positionToMidi(run[i])).toBeGreaterThan(
          positionToMidi(run[i - 1]),
        );
      }
    });

    it('descending starts on the highest root and walks to the bottom of the box', () => {
      const box = buildScalePositions('F', 'major', 'caged')[0];
      const run = orderScalePositions(box.positions, 'F', 'descending');

      expect(run[0].note).toBe('F');
      expect(positionToMidi(run[run.length - 1])).toBe(
        lowestMidi(box.positions),
      );
      for (let i = 1; i < run.length; i += 1) {
        expect(positionToMidi(run[i])).toBeLessThan(positionToMidi(run[i - 1]));
      }
    });
  });

  describe('anchor pitch class (start on 3rd / 5th)', () => {
    it('starts an A minor pentatonic run on the b3 when anchored to the third', () => {
      const box = buildScalePositions('A', 'minorPentatonic', 'caged')[0];
      const thirdPc = (noteToSemitone('A') + 3) % 12; // C
      const run = orderScalePositions(box.positions, 'A', 'ascending', {
        anchorPc: thirdPc,
      });

      expect(run[0].note).toBe('C');
    });

    it('starts a C major run on the fifth when anchored to the fifth', () => {
      const box = buildScalePositions('C', 'major', 'caged')[0];
      const fifthPc = (noteToSemitone('C') + 7) % 12; // G
      const run = orderScalePositions(box.positions, 'C', 'ascending', {
        anchorPc: fifthPc,
      });

      expect(run[0].note).toBe('G');
    });

    it('falls back to the full run when the anchor is absent', () => {
      const box = buildScalePositions('C', 'major', 'caged')[0];
      const run = orderScalePositions(box.positions, 'C', 'ascending', {
        anchorPc: (noteToSemitone('C') + 1) % 12, // C# — not in C major
      });

      expect(run.length).toBeGreaterThan(0);
      expect(positionToMidi(run[0])).toBe(lowestMidi(box.positions));
    });
  });

  describe('3NPS built-in walk order', () => {
    it('C major pos 1 starts on the first root in the walk and plays to the end', () => {
      const box = buildScalePositions('C', 'major', '3nps')[0];
      const run = orderScalePositions(box.positions, 'C', 'ascending', {
        ordering: 'builtIn',
      });

      expect(run[0].note).toBe('C');
      const firstRootIdx = box.positions.findIndex((p) => p.note === 'C');
      expect(run.length).toBe(box.positions.length - firstRootIdx);
      expect(run[run.length - 1]).toEqual(
        box.positions[box.positions.length - 1],
      );
    });

    it('3NPS descending starts on the highest root and walks back down', () => {
      const box = buildScalePositions('C', 'major', '3nps')[0];
      const run = orderScalePositions(box.positions, 'C', 'descending', {
        ordering: 'builtIn',
      });

      expect(run[0].note).toBe('C');
      expect(run[run.length - 1]).toEqual(box.positions[0]);
    });
  });
});
