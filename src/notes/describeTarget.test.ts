import { describe, expect, it } from 'vitest';
import {
  describeTarget,
  localClassNames,
  pickTarget,
  targetSummary,
  type ElementLike,
} from './describeTarget';

/** A stand-in for a DOM element: a tag, some attributes, text and a parent. */
function el(
  tagName: string,
  attributes: Record<string, string> = {},
  parent: ElementLike | null = null,
  text = '',
): ElementLike {
  return {
    tagName,
    parentElement: parent,
    textContent: text,
    getAttribute: (name) => attributes[name] ?? null,
  };
}

// The practice screen's neck: a note on the board, as the Fretboard draws it.
const frame = el('DIV', { 'data-frame': '', class: 'app _frame_ab12c_1' });
const neck = el('SECTION', { 'data-region': 'neck', 'aria-label': 'Neck', class: 'fretboardStage _neck_ab12c_40' }, frame);
const board = el('svg', { 'aria-label': 'E minor pentatonic', role: 'img', class: '_board_9x8y7_3' }, neck);
const noteGroup = el('g', { 'aria-label': 'G, G string, fret 3' }, board);
const dot = el('circle', { class: '_marker_1pzvq_1' }, noteGroup);
const fretLine = el('line', { class: '_fret_9x8y7_20' }, board);
const bareLine = el('line', {}, board);

// The deck: a chord in the progression strip.
const deck = el('SECTION', { 'data-region': 'deck', 'aria-label': 'Practice block', class: '_deck_ab12c_80' }, frame);
const chords = el('DIV', { class: '_chordStrip_k3k3k_12' }, deck);
const chord = el('BUTTON', { class: '_chord_k3k3k_20 _current_k3k3k_31' }, chords, 'i · 4 beats Em');
const chordName = el('SPAN', {}, chord, 'Em');

describe('localClassNames', () => {
  it('gives a CSS-module class the name it has in the stylesheet', () => {
    expect(localClassNames('_markerRoot_1pzvq_8 fretboardStage')).toEqual(['markerRoot', 'fretboardStage']);
  });

  it('keeps a name with underscores of its own', () => {
    expect(localClassNames('_chord_tone_1pzvq_8')).toEqual(['chord_tone']);
  });

  it('has none for no class', () => {
    expect(localClassNames(null)).toEqual([]);
    expect(localClassNames('  ')).toEqual([]);
  });
});

describe('pickTarget', () => {
  it('takes the labelled note, not the circle the pointer is on', () => {
    expect(pickTarget(dot)).toBe(noteGroup);
  });

  it('takes a part of the drawing that has a class of its own', () => {
    expect(pickTarget(fretLine)).toBe(fretLine);
  });

  it('takes the whole drawing when the part has no name', () => {
    expect(pickTarget(bareLine)).toBe(board);
  });

  it('takes the button around a bare span', () => {
    expect(pickTarget(chordName)).toBe(chord);
  });

  it('keeps an element that is already a thing', () => {
    expect(pickTarget(chords)).toBe(chords);
    expect(pickTarget(deck)).toBe(deck);
  });
});

describe('describeTarget', () => {
  it('says where a note on the neck is', () => {
    expect(describeTarget(noteGroup)).toEqual({
      region: 'neck',
      path: ['Neck', 'E minor pentatonic'],
      label: 'G, G string, fret 3',
      tag: 'g',
      classes: ['board', 'fretboardStage', 'neck', 'app', 'frame'],
      text: '',
    });
  });

  it('names a button by its text and lists its classes first', () => {
    const target = describeTarget(chord);
    expect(target.region).toBe('deck');
    expect(target.path).toEqual(['Practice block']);
    expect(target.label).toBe('i · 4 beats Em');
    expect(target.classes.slice(0, 3)).toEqual(['chord', 'current', 'chordStrip']);
    expect(target.text).toBe('i · 4 beats Em');
  });

  it('names a region by itself', () => {
    const target = describeTarget(deck);
    expect(target.region).toBe('deck');
    expect(target.label).toBe('Practice block');
  });

  it('cuts long text short', () => {
    const long = el('P', { class: '_instruction_aaaaa_1' }, neck, 'word '.repeat(80));
    const target = describeTarget(long);
    expect(target.label.length).toBeLessThanOrEqual(70);
    expect(target.text.length).toBeLessThanOrEqual(160);
    expect(target.text.endsWith('…')).toBe(true);
  });

  it('reads text the way it is laid out, so blocks do not run together', () => {
    const block: ElementLike = {
      ...el('LI', { class: '_planBlock_aaaaa_9' }, neck, '023 MINConnect the notes'),
      innerText: '02\n3 MIN\nConnect the notes',
    };
    expect(describeTarget(block).label).toBe('02 3 MIN Connect the notes');
  });

  it('names a field by what it is for', () => {
    const slider = el('INPUT', { type: 'range', 'aria-label': 'Practice volume' }, deck);
    expect(describeTarget(slider).label).toBe('Practice volume');
    expect(describeTarget(el('INPUT', { type: 'checkbox' }, deck)).label).toBe('checkbox');
  });
});

describe('targetSummary', () => {
  it('reads region, then the nearest label, then the thing', () => {
    expect(targetSummary(describeTarget(noteGroup))).toBe('Neck › E minor pentatonic › G, G string, fret 3');
    expect(targetSummary(describeTarget(chord))).toBe('Deck › Practice block › i · 4 beats Em');
  });

  it('drops a long label in the middle before it cuts the thing itself', () => {
    const titled = el('svg', { 'aria-label': 'C Minor Pentatonic Scale — 1st Position (C shape) on the Guitar Fretboard' }, neck);
    const note = el('g', { 'aria-label': 'D#, B string, fret 4' }, titled);
    expect(targetSummary(describeTarget(note))).toBe('Neck › D#, B string, fret 4');
  });

  it('leaves out a group the thing already names', () => {
    const group = el('DIV', { role: 'group', 'aria-label': 'Major and its modes' }, deck);
    const pill = el('BUTTON', { 'aria-label': 'Major and its modes: Mixolydian' }, group, 'Mixolydian');
    expect(targetSummary(describeTarget(pill))).toBe('Deck › Major and its modes: Mixolydian');
  });

  it('does not say the same thing twice', () => {
    expect(targetSummary(describeTarget(neck))).toBe('Neck');
  });

  it('has words for nothing in particular', () => {
    expect(targetSummary(null)).toBe('The whole screen');
  });
});
