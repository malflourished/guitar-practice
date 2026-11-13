import { describe, expect, it } from 'vitest';
import type { FretPosition } from '../../types/music';
import {
  DEFAULT_PLAY_OPTIONS,
  arpeggioNotes,
  arpeggioProgressionPattern,
  joinUpAndDown,
  orderScaleRun,
  playMenuOptions,
} from './playOptions';
import { positionToMidi } from './pitch';
import { joinTraversals } from './traversal';

const at = (string: number, fret: number, note = 'C'): FretPosition =>
  ({ string, fret, note }) as FretPosition;
const midis = (positions: FretPosition[]) => positions.map(positionToMidi);

describe('playMenuOptions', () => {
  const plain = { articulation: 'strum', canCrossNeck: false } as const;

  it('Notes: direction and loop only', () => {
    expect(playMenuOptions('notes', plain)).toEqual(['direction', 'loop']);
  });

  it('Scales: direction, start on, loop; whole neck only with several boxes', () => {
    expect(playMenuOptions('scales', plain)).toEqual(['direction', 'anchor', 'loop']);
    expect(playMenuOptions('scales', { ...plain, canCrossNeck: true })).toEqual([
      'direction',
      'anchor',
      'reach',
      'loop',
    ]);
  });

  it('Chords: strum or arpeggio, with direction only for an arpeggio', () => {
    expect(playMenuOptions('chords', plain)).toEqual(['articulation', 'loop']);
    expect(
      playMenuOptions('chords', { ...plain, articulation: 'arpeggio' }),
    ).toEqual(['articulation', 'direction', 'loop']);
  });

  it('Progressions: adds moving along the neck; never Start on', () => {
    const strum = playMenuOptions('progressions', plain);
    expect(strum).toEqual(['articulation', 'ladder', 'loop']);
    expect(
      playMenuOptions('progressions', { ...plain, articulation: 'arpeggio' }),
    ).toEqual(['articulation', 'direction', 'ladder', 'loop']);
    for (const mode of ['notes', 'chords', 'progressions'] as const) {
      expect(playMenuOptions(mode, plain)).not.toContain('anchor');
    }
  });
});

describe('runs', () => {
  // C D E F G on the A string, then the C an octave up on the D string.
  const scale = [at(4, 3), at(4, 5), at(4, 7), at(4, 8), at(4, 10), at(3, 10)];

  it('up and down plays the top note once', () => {
    const run = orderScaleRun(scale, 'C', 'updown', { ordering: 'pitch', anchorPc: 0 });
    const up = orderScaleRun(scale, 'C', 'up', { ordering: 'pitch', anchorPc: 0 });
    expect(midis(run).slice(0, up.length)).toEqual(midis(up));
    const top = Math.max(...midis(run));
    expect(midis(run).filter((m) => m === top)).toHaveLength(1);
    expect(run.length).toBe(2 * up.length - 1);
  });

  it('down is the reverse of the way up', () => {
    const up = orderScaleRun(scale, 'C', 'up', { ordering: 'pitch', anchorPc: 0 });
    const down = orderScaleRun(scale, 'C', 'down', { ordering: 'pitch', anchorPc: 0 });
    expect(midis(down)).toEqual(midis(up).reverse());
  });

  it('joins two runs without repeating the turn-around note', () => {
    expect(
      joinUpAndDown([{ midi: 1 }, { midi: 2 }], [{ midi: 2 }, { midi: 1 }]).map((n) => n.midi),
    ).toEqual([1, 2, 1]);
    const up = { positions: [at(5, 3), at(5, 5)], regionForNote: [0, 0] };
    const down = { positions: [at(5, 5), at(5, 3)], regionForNote: [1, 1] };
    expect(joinTraversals(up, down).regionForNote).toEqual([0, 0, 1]);
  });

  it('arpeggiates a chord low to high, high to low, or both', () => {
    const chord = [at(2, 2), at(5, 3), at(3, 2)];
    const up = midis(arpeggioNotes(chord, 'up'));
    expect(up).toEqual([...up].sort((a, b) => a - b));
    expect(midis(arpeggioNotes(chord, 'down'))).toEqual([...up].reverse());
    expect(arpeggioNotes(chord, 'updown')).toHaveLength(5);
  });

  it('spreads an arpeggiated progression over four beats a chord', () => {
    const pattern = arpeggioProgressionPattern(
      [[at(5, 3), at(4, 2), at(3, 0)], [at(5, 1), at(4, 3)]],
      'up',
    );
    expect(pattern.beats).toBe(8);
    expect(pattern.events.map((e) => e.beat)).toEqual([0, 0.5, 1, 4, 4.5]);
    expect(pattern.events.map((e) => e.index)).toEqual([0, 0, 0, 1, 1]);
  });

  it('starts as before: up, strum, no loop, this position', () => {
    expect(DEFAULT_PLAY_OPTIONS).toEqual({
      direction: 'up',
      articulation: 'strum',
      loop: false,
      reach: 'position',
      ladder: 'off',
    });
  });
});
