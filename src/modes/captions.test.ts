import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, SCALE_QUALITIES } from '../lib/music';
import type { NoteName } from '../types/music';
import { chordCaption, scaleCaption } from './captions';

const ROOTS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

describe('deck captions', () => {
  it('name the chord, its formula and its notes in the key', () => {
    expect(chordCaption('C', 'major', 'sharps')).toMatchObject({
      name: 'C major',
      formula: '1 3 5',
      notes: 'C E G',
    });
    expect(chordCaption('A', 'min7', 'sharps')).toMatchObject({
      name: 'A minor 7',
      formula: '1 ♭3 5 ♭7',
      notes: 'A C E G',
    });
    expect(chordCaption('A#', 'dom7', 'flats').notes).toBe('Bb D F Ab');
    expect(chordCaption('B', 'dim7', 'sharps').notes).toBe('B D F Ab');
  });

  it('name the scale, with its other name where it has one', () => {
    expect(scaleCaption('C', 'major', 'sharps')).toMatchObject({
      name: 'C major (Ionian)',
      formula: '1 2 3 4 5 6 7',
      notes: 'C D E F G A B',
    });
    expect(scaleCaption('A', 'minor', 'sharps').name).toBe('A minor (Aeolian)');
    expect(scaleCaption('E', 'harmonicMinor', 'sharps').name).toBe('E harmonic minor');
    expect(scaleCaption('D', 'dorian', 'sharps')).toMatchObject({
      name: 'D Dorian',
      notes: 'D E F G A B C',
    });
    expect(scaleCaption('A', 'minorBlues', 'sharps').notes).toBe('A C D Eb E G');
  });

  it('in every key the notes match the formula, one for one', () => {
    for (const root of ROOTS) {
      for (const quality of CHORD_QUALITIES) {
        const caption = chordCaption(root, quality, 'flats');
        expect(caption.notes.split(' ').length, `${root} ${quality}`).toBe(caption.formula.split(' ').length);
        expect(caption.name.length).toBeLessThan(26);
      }
      for (const quality of SCALE_QUALITIES) {
        const caption = scaleCaption(root, quality, 'sharps');
        expect(caption.notes.split(' ').length, `${root} ${quality}`).toBe(caption.formula.split(' ').length);
      }
    }
  });
});
