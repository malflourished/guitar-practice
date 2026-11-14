import { describe, expect, it } from 'vitest';
import {
  DIAL_ALTERNATE,
  DIAL_MAJORS,
  describeKeyDial,
  type KeyDialView,
} from './music/keyDial';
import { NECK_FRETS } from './music/neckChordMap';
import { neckLegend } from './music/neckChordMap';
import {
  FRET_ROOM,
  LEGEND_FONT,
  MARKER_MAX,
  MARKER_MIN,
  fretFraction,
  legendLayout,
  numeralEm,
  numeralFontSize,
  verticalNeckLayout,
  type VerticalNeckLayout,
} from './verticalNeckLayout';

/** The stage the dial fills (and so the neck), measured in the running app. */
const STAGES = [
  { window: '1440×900', width: 633.2, height: 744 },
  { window: '1280×720', width: 518.4, height: 582 },
  { window: '960×640', width: 488, height: 502 },
] as const;

const spaces = (layout: VerticalNeckLayout) =>
  Array.from({ length: NECK_FRETS }, (_, i) => layout.fretY[i + 1] - layout.fretY[i]);

/** The figure's text rows are at most this tall above their baseline or below it. */
const TEXT_ABOVE = 12;

function expectEverythingFits(layout: VerticalNeckLayout) {
  const { width, height, markerR } = layout;
  // Names, open row, nut, fret wires and legend are inside the stage, top to bottom, in order.
  expect(layout.nameY - TEXT_ABOVE).toBeGreaterThanOrEqual(0);
  expect(layout.openY - markerR).toBeGreaterThan(layout.nameY);
  expect(layout.fretY[0] - layout.openY).toBeGreaterThan(markerR);
  expect(layout.fretY[NECK_FRETS]).toBeLessThan(layout.legendY - markerR);
  expect(layout.legendY + markerR).toBeLessThanOrEqual(height);
  for (let n = 1; n <= NECK_FRETS; n++) expect(layout.fretY[n]).toBeGreaterThan(layout.fretY[n - 1]);
  // A marker's whole disc sits in its fret space, with the open row above the nut.
  for (let n = 1; n <= NECK_FRETS; n++) {
    expect(layout.markerY[n]).toBeGreaterThan(layout.fretY[n - 1]);
    expect(layout.markerY[n]).toBeLessThan(layout.fretY[n]);
  }
  // Left to right: fret numbers, the board, the strings, the board's end; all in the stage.
  // (A marker on an outer string may reach past the fret wires' ends, as in the mock-up.)
  expect(layout.numberX - 14).toBeGreaterThanOrEqual(0);
  expect(layout.boardLeft).toBeGreaterThan(layout.numberX);
  expect(layout.stringX[5] - markerR).toBeGreaterThan(layout.numberX + 6);
  expect(layout.stringX[0] + markerR).toBeLessThanOrEqual(width);
  expect(layout.boardRight).toBeLessThanOrEqual(width);
  // Markers on neighbouring strings never touch.
  expect(layout.stringGap).toBeGreaterThan(layout.markerD);
}

describe('fret spacing', () => {
  it('follows a real neck: 0 at the nut, 1 at fret 12, each space 2^(−1/12) of the one before', () => {
    expect(fretFraction(0)).toBe(0);
    expect(fretFraction(12)).toBeCloseTo(1, 12);
    const fractions = Array.from({ length: 13 }, (_, n) => fretFraction(n));
    for (let n = 2; n <= 12; n++) {
      const ratio = (fractions[n] - fractions[n - 1]) / (fractions[n - 1] - fractions[n - 2]);
      expect(ratio).toBeCloseTo(2 ** (-1 / 12), 12);
    }
  });

  it('blends towards even: a half way blend sits between, and 1 is twelve equal spaces', () => {
    for (let n = 1; n < 12; n++) {
      expect(fretFraction(n, 1)).toBeCloseTo(n / 12, 12);
      const low = Math.min(fretFraction(n, 0), fretFraction(n, 1));
      const high = Math.max(fretFraction(n, 0), fretFraction(n, 1));
      expect(fretFraction(n, 0.5)).toBeGreaterThanOrEqual(low);
      expect(fretFraction(n, 0.5)).toBeLessThanOrEqual(high);
    }
    expect(fretFraction(12, 0.3)).toBeCloseTo(1, 12);
  });
});

describe('the layout at the stage sizes of the three windows', () => {
  for (const stage of STAGES) {
    describe(stage.window, () => {
      const layout = verticalNeckLayout(stage.height, stage.width);

      it('shows frets 0 to 12 and six strings, low E on the left', () => {
        expect(layout.fretY).toHaveLength(NECK_FRETS + 1);
        expect(layout.markerY).toHaveLength(NECK_FRETS + 1);
        expect(layout.stringX).toHaveLength(6);
        // String 5 is the low E: the leftmost. String 0 is the high e: the rightmost.
        for (let string = 1; string < 6; string++) {
          expect(layout.stringX[string]).toBeLessThan(layout.stringX[string - 1]);
        }
        const gaps = layout.stringX.slice(1).map((x, i) => layout.stringX[i] - x);
        for (const gap of gaps) expect(gap).toBeCloseTo(layout.stringGap, 9);
      });

      it('keeps every fret space at least 1.15 × the marker diameter', () => {
        for (const space of spaces(layout)) {
          expect(space).toBeGreaterThanOrEqual(FRET_ROOM * layout.markerD - 1e-9);
        }
      });

      it('has markers from 27 px down to 20 px', () => {
        expect(layout.markerD).toBeLessThanOrEqual(MARKER_MAX);
        expect(layout.markerD).toBeGreaterThanOrEqual(MARKER_MIN);
        expect(layout.markerR * 2).toBe(layout.markerD);
      });

      it('fits everything in the stage', () => {
        expectEverythingFits(layout);
      });

      it('lays the legend\'s five items in a row inside the stage', () => {
        const words = neckLegend(describeKeyDial({ major: 'C', mode: 'major', view: 'borrowed' })).map((item) => item.word);
        const row = legendLayout(words, layout.markerD, layout.width);
        expect(row.markerX[0] - layout.markerR).toBeGreaterThanOrEqual(0);
        const last = words.length - 1;
        expect(row.wordX[last] + words[last].length * LEGEND_FONT * 0.62).toBeLessThanOrEqual(layout.width);
        for (let i = 1; i < words.length; i++) {
          const wordEnd = row.wordX[i - 1] + words[i - 1].length * LEGEND_FONT * 0.62;
          expect(wordEnd).toBeLessThan(row.markerX[i] - layout.markerR);
        }
      });
    });
  }

  it('1440×900: full size markers and the real spacing of a neck', () => {
    const layout = verticalNeckLayout(744, 633.2);
    expect(layout.markerD).toBe(MARKER_MAX);
    expect(layout.blend).toBe(0);
    const s = spaces(layout);
    for (let i = 1; i < s.length; i++) expect(s[i] / s[i - 1]).toBeCloseTo(2 ** (-1 / 12), 9);
  });

  it('1280×720: smaller markers, still the real spacing', () => {
    const layout = verticalNeckLayout(582, 518.4);
    expect(layout.markerD).toBeLessThan(MARKER_MAX);
    expect(layout.markerD).toBeGreaterThan(MARKER_MIN);
    expect(layout.blend).toBe(0);
  });

  it('960×640: the markers reach 20 px and the spacing blends a little towards even', () => {
    const layout = verticalNeckLayout(502, 488);
    expect(layout.markerD).toBe(MARKER_MIN);
    expect(layout.blend).toBeGreaterThan(0);
    expect(layout.blend).toBeLessThan(0.15);
    // Still graduated: each space is shorter than the one above.
    const s = spaces(layout);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThan(s[i - 1]);
  });
});

describe('the size rule, in the order the spec gives it', () => {
  const heights = Array.from({ length: 80 }, (_, i) => 280 + i * 9);

  it('shrinks the markers first, and blends the spacing only once they are at 20 px', () => {
    let previous = verticalNeckLayout(heights[heights.length - 1], 600);
    for (const height of [...heights].reverse().slice(1)) {
      const layout = verticalNeckLayout(height, 600);
      // A shorter stage never gives larger markers, or less blend.
      expect(layout.markerD).toBeLessThanOrEqual(previous.markerD);
      expect(layout.blend).toBeGreaterThanOrEqual(previous.blend);
      if (layout.blend > 0) expect(layout.markerD).toBeLessThanOrEqual(MARKER_MIN);
      if (layout.markerD < MARKER_MIN) expect(layout.blend).toBe(1);
      previous = layout;
    }
  });

  it('holds the 1.15 rule and fits at every height from 280 px up, for widths from 230 to 900', () => {
    for (const height of heights) {
      for (const width of [230, 280, 330, 420, 488, 600, 633, 750, 900]) {
        const layout = verticalNeckLayout(height, width);
        expect(layout.fretY).toHaveLength(NECK_FRETS + 1);
        for (const space of spaces(layout)) {
          expect(space).toBeGreaterThanOrEqual(FRET_ROOM * layout.markerD - 1e-9);
        }
        expectEverythingFits(layout);
      }
    }
  });

  it('keeps the markers at 27 px and the spacing real wherever the stage is tall enough', () => {
    for (const height of [700, 744, 900, 1200]) {
      const layout = verticalNeckLayout(height, 633);
      expect(layout.markerD).toBe(MARKER_MAX);
      expect(layout.blend).toBe(0);
    }
  });

  it('spaces the strings with the stage\'s width, 40 to 54 px, and never so tight that markers touch', () => {
    expect(verticalNeckLayout(744, 633.2).stringGap).toBeCloseTo(53.822, 3);
    expect(verticalNeckLayout(744, 2000).stringGap).toBe(54);
    expect(verticalNeckLayout(744, 400).stringGap).toBeGreaterThanOrEqual(40 - 1e-9);
    const narrow = verticalNeckLayout(744, 300);
    expect(narrow.stringGap).toBeGreaterThan(narrow.markerD);
  });
});

describe('the legend in a narrow stage', () => {
  const words = ['home', 'major', 'minor', 'diminished', 'borrowed'];

  it('fits at full size in the three windows\' stages', () => {
    for (const stage of STAGES) {
      const layout = verticalNeckLayout(stage.height, stage.width);
      expect(legendLayout(words, layout.markerD, stage.width).fit).toBe(1);
    }
  });

  it('scales to fit, about the figure\'s middle, in windows between the smallest and about 1200 px wide', () => {
    // The stage is only 230 to 430 px wide there (side panel docked).
    for (const width of [230, 280, 340, 400]) {
      const markerD = 22;
      const row = legendLayout(words, markerD, width);
      expect(row.fit).toBeLessThan(1);
      const middle = width / 2;
      const left = middle - (middle - (row.markerX[0] - markerD / 2)) * row.fit;
      const last = words.length - 1;
      const right = middle + (row.wordX[last] + words[last].length * LEGEND_FONT * 0.62 - middle) * row.fit;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
    }
  });
});

describe('numerals in the markers', () => {
  const numerals = new Set<string>();
  const MAJORS = [...DIAL_MAJORS, DIAL_ALTERNATE[6]];
  for (const major of MAJORS) {
    for (const mode of ['major', 'minor'] as const) {
      for (const view of ['in-key', 'borrowed', 'dominants'] as KeyDialView[]) {
        const info = describeKeyDial({ major, mode, view });
        for (const cell of [...info.main, ...info.extra]) numerals.add(cell.numeral);
      }
    }
  }

  it('fits every numeral the dial uses, up to five characters, at every marker size', () => {
    expect([...numerals].some((n) => n.length === 5)).toBe(true);
    for (const markerD of [MARKER_MAX, 24, 22.75, MARKER_MIN]) {
      for (const label of numerals) {
        const font = numeralFontSize(label, markerD);
        expect(font).toBeGreaterThanOrEqual(6);
        expect(numeralEm(label) * font).toBeLessThanOrEqual(markerD * 0.85);
      }
    }
  });

  it('sets short numerals larger than long ones, and shrinks with the marker', () => {
    expect(numeralFontSize('V', 27)).toBe(11);
    expect(numeralFontSize('vii°', 27)).toBeLessThan(numeralFontSize('V', 27));
    expect(numeralFontSize('V/iii', 27)).toBeLessThanOrEqual(numeralFontSize('vii°', 27));
    // In a small marker the long ones give way further.
    expect(numeralFontSize('V/VII', 20)).toBeLessThan(numeralFontSize('vii°', 20));
    expect(numeralFontSize('V', 20)).toBeLessThan(numeralFontSize('V', 27));
  });
});
