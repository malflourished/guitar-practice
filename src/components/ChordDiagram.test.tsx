import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildChordPositionViews } from '../lib/music';
import { ChordDiagram } from './ChordDiagram';
import { ChordPositionStrip } from './ChordPositionStrip';

/** The text of every dot label in the markup, in order. */
const labels = (html: string) => [...html.matchAll(/<text[^>]*dotLabel[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('ChordDiagram', () => {
  const [open] = buildChordPositionViews('C', 'dom7', 'sharps');
  const draw = (props: Partial<Parameters<typeof ChordDiagram>[0]>) =>
    renderToStaticMarkup(
      <ChordDiagram
        positions={open.positions}
        mutedStrings={open.mutedStrings}
        startFret={open.startFret}
        endFret={open.endFret}
        notation="sharps"
        noteLabels={open.noteLabels}
        rootNote="C"
        chordQuality="dom7"
        {...props}
      />,
    );

  it('names the notes by default', () => {
    expect(new Set(labels(draw({})))).toEqual(new Set(['C', 'E', 'Bb']));
  });

  it('Labels = Intervals: the dots read R, 3 and ♭7 above the root', () => {
    expect(new Set(labels(draw({ showIntervals: true })))).toEqual(new Set(['R', '3', '♭7']));
  });

  it('Labels = Fingers still wins where a shape has fingers, and None shows nothing', () => {
    expect(labels(draw({ showFingers: true, showIntervals: false })).every((l) => /^[1-4]$|^E$/.test(l))).toBe(true);
    expect(labels(draw({ showNoteLabels: false, showIntervals: true }))).toEqual([]);
  });
});

describe('ChordPositionStrip', () => {
  it('names each diagram by its shape: the five CAGED letters for C major', () => {
    const html = renderToStaticMarkup(
      <ChordPositionStrip
        wrap
        positions={buildChordPositionViews('C', 'major', 'sharps')}
        activeIndex={0}
        notation="sharps"
        showFingers={false}
        showNoteLabels
        fullDotOpacity={false}
        showChordTones={false}
        rootNote="C"
        chordQuality="major"
        onSelectPosition={() => {}}
      />,
    );
    for (const name of ['Open C shape', 'A shape', 'G shape', 'E shape', 'D shape']) {
      expect(html).toContain(`>${name}<`);
    }
  });

  it('small triads are named by their inversion', () => {
    const views = buildChordPositionViews('C', 'minor', 'flats', 'triads', 'dgb');
    expect(views.map((v) => v.shapeLabel).slice(0, 3).sort()).toEqual([
      '1st inversion',
      '2nd inversion',
      'Root position',
    ]);
    // A seventh chord has no small triads: it keeps its shapes.
    expect(buildChordPositionViews('C', 'dom7', 'flats', 'triads', 'dgb')[0].shapeLabel).toBe('Open C shape');
  });
});
