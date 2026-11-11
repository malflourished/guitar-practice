import { describe, expect, it } from 'vitest';
import { getKeySpellingMap } from './noteSpelling';
import { getDiatonicRoot } from './diatonic';
import { getRelativeMajor, getRelativeMinor } from './circleOfFifths';
import { formatChordName } from './progressions';

describe('getKeySpellingMap (key panel spelling)', () => {
  it('spells C minor with flats whatever the global preference', () => {
    const spell = getKeySpellingMap('C', 'minor', 'sharps');
    const name = (degree: number) =>
      spell.get(getDiatonicRoot('C', 'minor', degree))!;
    expect([name(3), name(6), name(7)]).toEqual(['Eb', 'Ab', 'Bb']);
    expect(spell.get(getRelativeMajor('C'))).toBe('Eb');
    expect(
      formatChordName('D#', 'maj7', 'sharps', spell.get('D#')),
    ).toBe('Ebmaj7');
  });

  it('spells E major with sharps whatever the global preference', () => {
    const spell = getKeySpellingMap('E', 'major', 'flats');
    const name = (degree: number) =>
      spell.get(getDiatonicRoot('E', 'major', degree))!;
    expect([name(2), name(3), name(6)]).toEqual(['F#', 'G#', 'C#']);
    expect(spell.get(getRelativeMinor('E'))).toBe('C#');
  });
});
