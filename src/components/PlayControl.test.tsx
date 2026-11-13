import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayControl, PlayMenu, type PlayControlProps } from './PlayControl';
import { DEFAULT_PLAY_OPTIONS } from '../lib/audio/playOptions';

const base: PlayControlProps = {
  mode: 'scales',
  playing: false,
  loading: false,
  disabled: false,
  tempo: 96,
  options: DEFAULT_PLAY_OPTIONS,
  onOptionsChange: () => {},
  scaleAnchor: 'root',
  onScaleAnchorChange: () => {},
  canCrossNeck: false,
  onToggle: () => {},
  onOpenTempo: () => {},
};

const menu = (patch: Partial<PlayControlProps>) =>
  renderToStaticMarkup(<PlayMenu {...base} {...patch} />);

describe('PlayControl', () => {
  it('shows Play and the tempo, and Stop while playing', () => {
    const idle = renderToStaticMarkup(<PlayControl {...base} />);
    expect(idle).toContain('>Play<');
    expect(idle).toContain('96');
    expect(idle).toContain('Open Settings');
    expect(renderToStaticMarkup(<PlayControl {...base} playing />)).toContain('>Stop<');
  });

  it('offers only what applies in each mode', () => {
    const notes = menu({ mode: 'notes' });
    expect(notes).toContain('Direction');
    expect(notes).toContain('Up and down');
    expect(notes).not.toContain('Start on');
    expect(notes).not.toContain('Strum');

    const scales = menu({ mode: 'scales' });
    expect(scales).toContain('Start on');
    expect(scales).not.toContain('Whole neck');
    expect(menu({ mode: 'scales', canCrossNeck: true })).toContain('Whole neck');

    const chords = menu({ mode: 'chords' });
    expect(chords).toContain('Strum');
    expect(chords).toContain('Arpeggio');
    expect(chords).not.toContain('Direction');
    expect(chords).not.toContain('Start on');
    expect(
      menu({
        mode: 'chords',
        options: { ...DEFAULT_PLAY_OPTIONS, articulation: 'arpeggio' },
      }),
    ).toContain('Direction');

    const progressions = menu({ mode: 'progressions' });
    expect(progressions).toContain('Up the neck');
    expect(progressions).not.toContain('Start on');
  });

  it('Progressions: Guitar is Whole, Half or Quarter with no Off; the Pad group is gone', () => {
    const html = menu({ mode: 'progressions' });
    const guitar = /aria-label="Guitar".*?<\/div><\/div>/.exec(html)?.[0] ?? '';
    expect(guitar).toContain('>Whole<');
    expect(guitar).toContain('>Half<');
    expect(guitar).toContain('>Quarter<');
    expect(guitar).not.toContain('>Off<');
    expect(html).not.toContain('>Pad<');
    expect(html).not.toContain('soft pad');
    // the Guitar rhythm shows the chosen one
    expect(menu({ mode: 'progressions', options: { ...DEFAULT_PLAY_OPTIONS, guitar: 'quarter' } })).toMatch(
      /aria-checked="true"[^>]*>Quarter</,
    );
  });

  it('Progressions: the groups come in the order Guitar, Feel, Click, Loop, Move along the neck', () => {
    const html = menu({ mode: 'progressions' });
    const order = ['Guitar', 'Feel', 'Click', 'Loop', 'Move along the neck'].map((title) =>
      html.indexOf(`>${title}<`),
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shows Loop in every mode and marks the chosen options', () => {
    for (const mode of ['notes', 'scales', 'chords', 'progressions'] as const) {
      expect(menu({ mode })).toContain('Loop');
    }
    const html = menu({ mode: 'notes', options: { ...DEFAULT_PLAY_OPTIONS, loop: true } });
    expect(html).toMatch(/aria-pressed="true"[^>]*>On</);
  });
});
