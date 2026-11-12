import { describe, expect, it } from 'vitest';
import { getKeySpellingMap } from './noteSpelling';
import { getDiatonicRoot } from './diatonic';
import { getRelativeMajor, getRelativeMinor } from './circleOfFifths';
import { formatChordName, resolveProgressionStep } from './progressions';

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

describe('black-key roots take the name with fewer accidentals', () => {
  it('spells the A# key as Bb major even with sharps preferred', () => {
    const spell = getKeySpellingMap('A#', 'major', 'sharps');
    expect([...spell.values()]).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
  });

  it('keeps C# minor as C# minor even with flats preferred', () => {
    const spell = getKeySpellingMap('C#', 'minor', 'flats');
    expect([...spell.values()]).toEqual(['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B']);
  });

  it('lets the preference decide a true tie (F# or Gb major)', () => {
    expect(getKeySpellingMap('F#', 'major', 'sharps').get('F#')).toBe('F#');
    expect(getKeySpellingMap('F#', 'major', 'flats').get('F#')).toBe('Gb');
  });

  it('names chords the way they read best', () => {
    expect(formatChordName('A#', 'maj7', 'sharps')).toMatch(/^Bb/);
    expect(formatChordName('G#', 'min7', 'flats')).toMatch(/^G#/);
  });

  it('spells a progression chord by its key', () => {
    // B major's iii is D#m7 even when flats are preferred (Ebm7 would tie).
    const iii = resolveProgressionStep(
      'B',
      'major',
      { degree: 3, quality: 'min7', numeral: 'iii7' },
      'flats',
    );
    expect(iii.chordName).toMatch(/^D#/);
  });
});
