import { describe, expect, it } from 'vitest';
import type { NoteName } from '../../types/music';
import { describeNoteSet, nameNoteSet } from './noteSets';

const set = (...notes: NoteName[]) => new Set(notes);

describe('what a set of notes is', () => {
  it('nothing, one note, two notes', () => {
    expect(describeNoteSet(set(), 'sharps').line).toMatch(/Pick notes/);
    expect(describeNoteSet(set('C'), 'sharps')).toEqual({
      title: 'C',
      line: 'Every C on the neck. The octave is two strings higher and two frets up, three frets up from the D and G strings.',
    });
    expect(describeNoteSet(set('C', 'G'), 'sharps')).toEqual({
      title: '2 notes',
      notes: 'C G',
      line: 'C up to G is a perfect 5th; G up to C is a perfect 4th.',
    });
    expect(describeNoteSet(set('A#', 'D'), 'flats').line).toBe(
      'D up to Bb is a minor 6th; Bb up to D is a major 3rd.',
    );
    expect(describeNoteSet(set('C', 'F#'), 'sharps').line).toMatch(/^A tritone/);
  });

  it('three and four notes are named as chords, under each name they have', () => {
    expect(nameNoteSet(set('C', 'E', 'G'), 'sharps')).toEqual(['C major']);
    expect(nameNoteSet(set('A', 'C', 'E'), 'sharps')).toEqual(['A minor']);
    expect(nameNoteSet(set('B', 'D', 'F'), 'sharps')).toEqual(['B diminished']);
    // Am7 and C6 are the same four notes; the seventh chord is named first.
    expect(nameNoteSet(set('A', 'C', 'E', 'G'), 'sharps')).toEqual(['A minor 7', 'C major 6']);
    // Csus2 and Gsus4 are the same three notes.
    expect(nameNoteSet(set('C', 'D', 'G'), 'sharps')).toEqual(['G sus4', 'C sus2']);
    expect(nameNoteSet(set('G', 'B', 'D', 'F'), 'sharps')).toEqual(['G dominant 7']);
    // An augmented triad is three chords at once.
    expect(nameNoteSet(set('C', 'E', 'G#'), 'sharps')).toEqual(['C augmented', 'E augmented', 'G# augmented']);
    expect(describeNoteSet(set('C', 'E', 'G#'), 'flats').line).toBe(
      'C augmented, or E augmented (and 1 more name).',
    );
  });

  it('five notes and more are named as scales first', () => {
    expect(nameNoteSet(set('C', 'D', 'E', 'G', 'A'), 'sharps').slice(0, 2)).toEqual([
      'C major pentatonic scale',
      'A minor pentatonic scale',
    ]);
    const cMajor = nameNoteSet(set('C', 'D', 'E', 'F', 'G', 'A', 'B'), 'sharps');
    expect(cMajor.slice(0, 2)).toEqual(['C major scale', 'A minor scale']);
    expect(cMajor).toHaveLength(7); // the major scale and its six other modes
    expect(describeNoteSet(set('C', 'D', 'E', 'F', 'G', 'A', 'B'), 'sharps').line).toBe(
      'C major scale, or A minor scale (and 5 more names).',
    );
    expect(nameNoteSet(set('A', 'C', 'D', 'D#', 'E', 'G'), 'sharps')[0]).toBe('C major blues scale');
    expect(nameNoteSet(set('A', 'C', 'D', 'D#', 'E', 'G'), 'sharps')).toContain('A minor blues scale');
  });

  it('says so when the notes are no common chord or scale, and names all twelve', () => {
    expect(describeNoteSet(set('C', 'C#', 'D'), 'sharps')).toEqual({
      title: '3 notes',
      notes: 'C C# D',
      line: 'No common chord or scale has exactly these notes.',
    });
    const all = set('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B');
    expect(describeNoteSet(all, 'sharps').title).toBe('All twelve notes');
  });

  it('every line fits the deck', () => {
    const picks: NoteName[][] = [['C'], ['C', 'G'], ['A', 'C', 'E', 'G'], ['C', 'D', 'E', 'F', 'G', 'A', 'B'], ['C#', 'D#', 'F#', 'G#', 'A#']];
    for (const pick of picks) {
      for (const notation of ['sharps', 'flats'] as const) {
        expect(describeNoteSet(set(...pick), notation).line.length).toBeLessThanOrEqual(125);
      }
    }
  });
});
