import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayControl, type PlayControlProps } from '../components/PlayControl';
import { DEFAULT_PLAY_OPTIONS } from '../lib/audio/playOptions';
import { ChordsControls, ChordsOptions } from './chords/ChordsControls';
import { NeckBar } from './ModePicker';
import { ScalesControls, ScalesFootnote, ScalesOptions } from './scales/ScalesControls';
import { deckGrowFor } from './useDeckGrow';

const play: PlayControlProps = {
  mode: 'chords',
  playing: false,
  loading: false,
  disabled: false,
  tempo: 90,
  options: DEFAULT_PLAY_OPTIONS,
  onOptionsChange: () => {},
  scaleAnchor: 'root',
  onScaleAnchorChange: () => {},
  canCrossNeck: false,
  onToggle: () => {},
  onOpenTempo: () => {},
};

/** The text of every button with this role state. */
const checked = (html: string) =>
  [...html.matchAll(/<button[^>]*aria-checked="true"[^>]*>([^<]*)</g)].map((m) => m[1]);
const groupOrder = (html: string) =>
  [...html.matchAll(/role="group" aria-label="([^"]+)"/g)].map((m) => m[1]);

describe('the Chords deck', () => {
  const chords = (quality: 'major' | 'min7' | 'dom11') =>
    renderToStaticMarkup(
      <ChordsControls rootNote="C" notation="sharps" chordQuality={quality} onChordQualityChange={() => {}} />,
    );

  it('is a menu of triads, sevenths and extended chords, every chord one click away', () => {
    const html = chords('major');
    expect(groupOrder(html)).toEqual(['Triads', 'Sevenths', 'Extended']);
    expect((html.match(/role="radio"/g) ?? []).length).toBe(21);
    expect(checked(html)).toEqual(['Major']);
    // Chord symbols keep their case: m7 is not M7.
    for (const symbol of ['>m7<', '>maj7<', '>m7♭5<', '>dim7<', '>13<']) expect(html).toContain(symbol);
  });

  it('says one line about the chosen chord: its formula, its notes, its sound', () => {
    const html = chords('min7');
    expect(checked(html)).toEqual(['m7']);
    expect(html).toContain('C minor 7');
    expect(html).toContain('1 ♭3 5 ♭7');
    expect(html).toContain('C Eb G Bb');
    expect(html).toContain('Smooth and mellow');
    // Every other chord's line is on its button, for the mouse.
    expect(html).toContain('title="Dominant 7: 1 3 5 ♭7. Restless and bluesy');
  });

  it('offers small triads for the four triad qualities only, with the string set', () => {
    const options = (quality: 'minor' | 'dom7', voicing: 'shapes' | 'triads') =>
      renderToStaticMarkup(
        <ChordsOptions
          chordQuality={quality}
          chordVoicing={voicing}
          setChordVoicing={() => {}}
          triadStrings="dgb"
          setTriadStrings={() => {}}
          triadsShown={voicing === 'triads' && quality === 'minor'}
        />,
      );
    const triads = options('minor', 'triads');
    expect(checked(triads)).toEqual(['Triads', 'D G B']);
    for (const set of ['G B e', 'D G B', 'A D G', 'E A D']) expect(triads).toContain(`>${set}<`);
    // A seventh chord shows its shapes, and says why Triads is not offered.
    const seventh = options('dom7', 'triads');
    expect(checked(seventh)).toEqual(['Shapes']);
    expect(seventh).toContain('disabled=""');
    expect(seventh).toContain('Small triads are major, minor, diminished and augmented');
    expect(seventh).not.toContain('D G B');
  });
});

describe('the Scales deck', () => {
  it('is a menu with the modes in order, and one line on the chosen scale', () => {
    const html = renderToStaticMarkup(
      <ScalesControls rootNote="D" notation="sharps" scaleQuality="dorian" onScaleQualityChange={() => {}} />,
    );
    expect(groupOrder(html)).toEqual(['Pentatonic', 'Blues', 'Minor', 'Major and its modes']);
    expect((html.match(/role="radio"/g) ?? []).length).toBe(13);
    expect(checked(html)).toEqual(['Dorian']);
    expect(html).toContain('D Dorian');
    expect(html).toContain('1 2 ♭3 4 5 6 ♭7');
    expect(html).toContain('D E F G A B C');
    expect(html).toContain('Minor with a raised 6th');
    const modes = html.slice(html.indexOf('Major and its modes'));
    const order = ['Major', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Minor', 'Locrian'].map((m) => modes.indexOf(`>${m}<`));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
  });

  it('System puts CAGED first, with the line under it, and the drone names its note', () => {
    const options = (canSwitch: boolean, shown: 'caged' | '3nps', droneOn = false) =>
      renderToStaticMarkup(
        <>
          <ScalesOptions
            scaleSystem="caged"
            shownSystem={shown}
            canSwitchSystem={canSwitch}
            onScaleSystemChange={() => {}}
            rootLabel="Bb"
            droneOn={droneOn}
            onDroneToggle={() => {}}
          />
          <ScalesFootnote />
        </>,
      );
    const major = options(true, 'caged');
    expect(major.indexOf('>CAGED<')).toBeLessThan(major.indexOf('>3 per string<'));
    expect(checked(major)).toEqual(['CAGED']);
    expect(major).not.toContain('disabled=""');
    expect(major).toContain(
      'CAGED: five shapes tied to the chord shapes, for knowing where you are. 3 per string: longer runs, faster.',
    );
    // A mode is only laid out 3 per string: it shows that, and CAGED is not offered.
    const mode = options(false, '3nps');
    expect(checked(mode)).toEqual(['3 per string']);
    expect(mode).toContain('Only major and minor are laid out both ways');
    expect((mode.match(/disabled=""/g) ?? []).length).toBe(1);
    // The drone: off, then on.
    expect(major).toContain('aria-pressed="false" aria-label="Drone on Bb"');
    expect(options(true, 'caged', true)).toContain('aria-pressed="true" aria-label="Drone on Bb, sounding"');
    expect(major).toContain('Drone Bb');
  });
});

describe('Play above the neck', () => {
  it('sits to the left of the position bar and opens its menu downward', () => {
    const html = renderToStaticMarkup(
      <NeckBar play={<PlayControl {...play} menuBelow />}>
        <span>position bar</span>
      </NeckBar>,
    );
    expect(html.indexOf('>Play<')).toBeLessThan(html.indexOf('position bar'));
    expect(html).toContain('data-play-options-icon="down"');
  });

  it('the Play options button has its own icon: a chevron, not the Settings sliders', () => {
    const deck = renderToStaticMarkup(<PlayControl {...play} />);
    expect(deck).toContain('data-play-options-icon="up"');
    expect(deck).toContain('aria-label="Play options"');
    // The Settings icon is two slider tracks with knobs (circles).
    expect(deck).not.toContain('<circle');
  });
});

describe('how far the deck rises under the board', () => {
  it('takes the empty band under the board, less a margin, and never goes negative', () => {
    expect(deckGrowFor(656, 586)).toBe(60);
    expect(deckGrowFor(488, 477.5)).toBe(0);
    expect(deckGrowFor(400, 420)).toBe(0);
  });
});
