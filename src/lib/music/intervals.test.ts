import { describe, expect, it } from 'vitest';
import {
  getIntervalColor,
  getIntervalDef,
  getIntervalLabel,
  getIntervalMarker,
  intervalBetween,
  noteAtInterval,
} from './intervals';

describe('interval catalog', () => {
  it('names intervals by semitone distance', () => {
    expect(getIntervalDef(4)).toMatchObject({ abbr: 'M3', functionLabel: '3' });
    expect(getIntervalDef(10)).toMatchObject({ abbr: 'm7', functionLabel: '♭7' });
    expect(getIntervalDef(7)).toMatchObject({ abbr: 'P5', name: 'Perfect 5th' });
  });

  it('keeps the octave distinct from the unison', () => {
    expect(getIntervalDef(12)).toMatchObject({ functionLabel: 'R', degreeLabel: '8' });
    expect(getIntervalDef(0)).toMatchObject({ functionLabel: 'R', degreeLabel: '1' });
  });

  it('switches between function and degree labels', () => {
    expect(getIntervalLabel(3, 'function')).toBe('♭3');
    expect(getIntervalLabel(3, 'degree')).toBe('♭3');
    expect(getIntervalLabel(12, 'function')).toBe('R');
    expect(getIntervalLabel(12, 'degree')).toBe('8');
  });

  it('measures the distance between two notes', () => {
    expect(intervalBetween('C', 'E')).toBe(4);
    expect(intervalBetween('A', 'G')).toBe(10);
    expect(intervalBetween('C', 'C')).toBe(0);
  });

  it('finds the note an interval above a root', () => {
    expect(noteAtInterval('C', 4)).toBe('E');
    expect(noteAtInterval('A', 10)).toBe('G');
  });

  it('builds a fretboard marker with label, shape, color, and root flag', () => {
    expect(getIntervalMarker('C', 'E')).toMatchObject({
      label: '3',
      shape: 'triangle-up',
      isRoot: false,
    });
    expect(getIntervalMarker('C', 'C')).toMatchObject({ label: 'R', isRoot: true });
  });

  it('paints the inert 5th gray (the "potato")', () => {
    expect(getIntervalColor(7)).toBe('#9E9E9E');
  });
});
