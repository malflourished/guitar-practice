import { describe, expect, it } from 'vitest';
import { getChordToneForNote } from './chordTones';

describe('getChordToneForNote', () => {
  it('identifies root, third, and fifth in a major triad', () => {
    expect(getChordToneForNote('C', 'C', 'major')).toMatchObject({
      label: 'R',
      shape: 'circle',
      isRoot: true,
    });
    expect(getChordToneForNote('C', 'E', 'major')).toMatchObject({
      label: '3',
      shape: 'triangle-up',
    });
    expect(getChordToneForNote('C', 'G', 'major')).toMatchObject({
      label: '5',
      shape: 'square',
    });
  });

  it('uses a downward triangle for the minor third', () => {
    expect(getChordToneForNote('A', 'C', 'minor')).toMatchObject({
      label: '♭3',
      shape: 'triangle-down',
    });
  });

  it('labels sus2 and sus4 chord tones', () => {
    expect(getChordToneForNote('D', 'E', 'sus2')).toMatchObject({ label: '2' });
    expect(getChordToneForNote('D', 'G', 'sus4')).toMatchObject({ label: '4' });
  });

  it('prefers the ninth over the second pitch class in extended chords', () => {
    expect(getChordToneForNote('C', 'D', 'dom9')).toMatchObject({
      interval: 14,
      label: '9',
      shape: 'ring',
    });
  });

  it('returns null for notes outside the chord', () => {
    expect(getChordToneForNote('C', 'F', 'major')).toBeNull();
  });
});
