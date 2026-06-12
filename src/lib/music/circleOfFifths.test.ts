import { describe, expect, it } from 'vitest';
import {
  formatCircleKeyLabel,
  getCircleKeyDisplay,
  getCircleKeyEntries,
  getCircleKeySignatures,
  getRelativeMajor,
  getRelativeMinor,
  usesFlatCircleSpelling,
} from './circleOfFifths';

describe('circleOfFifths', () => {
  it('orders major keys clockwise from C with correct accidental counts', () => {
    const entries = getCircleKeyEntries();
    expect(entries.map((entry) => entry.major)).toEqual([
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      'D#',
      'A#',
      'F',
    ]);
    expect(entries[0].sharpCount).toBe(0);
    expect(entries[1].sharpCount).toBe(1);
    expect(entries[6].flatCount).toBe(6);
    expect(entries[11].flatCount).toBe(1);
  });

  it('pairs each major key with its relative minor', () => {
    expect(getRelativeMinor('C')).toBe('A');
    expect(getRelativeMinor('G')).toBe('E');
    expect(getRelativeMajor('A')).toBe('C');
    expect(getRelativeMajor('E')).toBe('G');
  });

  it('uses flat spellings on the flat side of the circle', () => {
    const entries = getCircleKeyEntries();
    const fEntry = entries[11];
    const bbEntry = entries[10];

    expect(usesFlatCircleSpelling(fEntry)).toBe(true);
    expect(formatCircleKeyLabel(fEntry.major, fEntry)).toBe('F');
    expect(formatCircleKeyLabel(fEntry.relativeMinor, fEntry)).toBe('D');

    expect(formatCircleKeyLabel(bbEntry.major, bbEntry)).toBe('Bb');
    expect(formatCircleKeyLabel(bbEntry.relativeMinor, bbEntry)).toBe('G');
  });

  it('uses sharp spellings on the sharp side of the circle', () => {
    const entries = getCircleKeyEntries();
    const bEntry = entries[5];

    expect(usesFlatCircleSpelling(bEntry)).toBe(false);
    expect(formatCircleKeyLabel(bEntry.major, bEntry)).toBe('B');
    expect(formatCircleKeyLabel(bEntry.relativeMinor, bEntry)).toBe('G#');
  });

  it('shows textbook enharmonic pairs at the bottom of the circle', () => {
    const entries = getCircleKeyEntries();

    expect(getCircleKeyDisplay(entries[5], 5)).toEqual({
      major: 'B',
      majorAlt: 'C♭',
      minor: 'G♯m',
      minorAlt: 'A♭m',
    });
    expect(getCircleKeyDisplay(entries[6], 6)).toEqual({
      major: 'G♭',
      majorAlt: 'F♯',
      minor: 'E♭m',
      minorAlt: 'D♯m',
    });
    expect(getCircleKeyDisplay(entries[7], 7)).toEqual({
      major: 'D♭',
      majorAlt: 'C♯',
      minor: 'B♭m',
      minorAlt: 'A♯m',
    });
  });

  it('builds key-signature accidentals for sharp, flat, and enharmonic slots', () => {
    const entries = getCircleKeyEntries();

    expect(getCircleKeySignatures(entries[0], 0)).toEqual({});
    expect(getCircleKeySignatures(entries[1], 1)).toEqual({ sharp: ['F♯'] });
    expect(getCircleKeySignatures(entries[11], 11)).toEqual({ flat: ['B♭'] });
    expect(getCircleKeySignatures(entries[6], 6)).toEqual({
      sharp: ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯'],
      flat: ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'],
    });
  });
});
