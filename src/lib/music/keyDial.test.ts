import { describe, expect, it } from 'vitest';
import type { KeyMode } from '../../types/music';
import { getDiatonicRoot } from './diatonic';
import {
  DIAL_ALTERNATE,
  DIAL_MAJORS,
  defaultCellLabel,
  defaultSignature,
  describeKeyDial,
  dialKeyFor,
  dialNameToNote,
  dialPosition,
  keySignature,
  parseDialName,
  type DialCell,
  type KeyDialView,
} from './keyDial';
import { pitchClassOf } from './noteSpelling';
import { CHROMATIC } from './notes';

const MAJOR_NAMES = [...DIAL_MAJORS, DIAL_ALTERNATE[6]];

function chords(cells: DialCell[]): string[] {
  return cells.map((c) => `${c.numeral} ${c.label}`);
}

function describe_(major: string, mode: KeyMode, view: KeyDialView) {
  return describeKeyDial({ major, mode, view });
}

describe('dial positions', () => {
  it('walks the circle of fifths clockwise from C', () => {
    expect(DIAL_MAJORS.map(dialPosition)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(dialPosition('G♭')).toBe(6);
  });

  it('maps a printed name back to the app note by pitch', () => {
    expect(dialNameToNote('G♭')).toBe('F#');
    expect(dialNameToNote('B♭')).toBe('A#');
    expect(dialNameToNote('E♯')).toBe('F');
    expect(dialNameToNote('C')).toBe('C');
  });
});

describe('key signatures on the bezel', () => {
  it('counts sharps clockwise and flats counter-clockwise', () => {
    expect(DIAL_MAJORS.map(keySignature)).toEqual([
      '0', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯', '5♭', '4♭', '3♭', '2♭', '1♭',
    ]);
    expect(keySignature('G♭')).toBe('6♭');
  });

  it('prints both signatures at the six-accidental position', () => {
    expect(defaultSignature(6)).toBe('6♯ 6♭');
    expect(defaultSignature(0)).toBe('0');
  });
});

describe('the app key to the dial key', () => {
  it('follows the key panel: fewer accidentals, preference breaks the tie', () => {
    expect(dialKeyFor('A#', 'major', 'sharps')).toEqual({ major: 'B♭', tonic: 'B♭' });
    expect(dialKeyFor('C#', 'major', 'sharps')).toEqual({ major: 'D♭', tonic: 'D♭' });
    expect(dialKeyFor('C#', 'minor', 'flats')).toEqual({ major: 'E', tonic: 'C♯' });
    expect(dialKeyFor('F#', 'major', 'sharps').major).toBe('F♯');
    expect(dialKeyFor('F#', 'major', 'flats').major).toBe('G♭');
    expect(dialKeyFor('D#', 'minor', 'sharps')).toEqual({ major: 'F♯', tonic: 'D♯' });
    expect(dialKeyFor('D#', 'minor', 'flats')).toEqual({ major: 'G♭', tonic: 'E♭' });
    expect(dialKeyFor('A', 'minor')).toEqual({ major: 'C', tonic: 'A' });
  });

  it('lands every one of the 24 keys on a printed major', () => {
    for (const root of CHROMATIC) {
      for (const mode of ['major', 'minor'] as const) {
        for (const preference of ['sharps', 'flats'] as const) {
          const { major, tonic } = dialKeyFor(root, mode, preference);
          expect(MAJOR_NAMES).toContain(major);
          expect(dialNameToNote(tonic)).toBe(root);
        }
      }
    }
  });
});

describe('the window in all 12 keys, both modes', () => {
  const QUALITY_OF: Record<string, string> = { I: 'M', V: 'M', IV: 'M', ii: 'm', iii: 'm', vi: 'm', 'vii°': '°' };

  for (const major of MAJOR_NAMES) {
    it(`${major} major and its relative minor: seven chords, every degree on its own letter`, () => {
      const rootPitch = pitchClassOf(parseDialName(major));
      const degreePitch = [0, 2, 4, 5, 7, 9, 11].map((s) => (rootPitch + s) % 12);
      const majorInfo = describe_(major, 'major', 'in-key');
      const minorInfo = describe_(major, 'minor', 'in-key');

      for (const info of [majorInfo, minorInfo]) {
        expect(info.main).toHaveLength(7);
        // Order: IV I V ii vi iii vii° → degrees 4 1 5 2 6 3 7.
        const degrees = [3, 0, 4, 1, 5, 2, 6];
        info.main.forEach((cell, i) => {
          const root = parseDialName(cell.label.replace(/[m°]$/, ''));
          expect(pitchClassOf(root)).toBe(degreePitch[degrees[i]]);
          expect(Math.abs(root.accidental)).toBeLessThanOrEqual(1);
        });
        const letters = info.main.map((c) => c.label[0]);
        expect(new Set([letters[1], letters[3], letters[0], letters[4], letters[2], letters[5], letters[6]]).size).toBe(7);
        // Qualities by ring: major outside, minor inside, diminished under V.
        expect(info.main.map((c) => c.ring)).toEqual(['major', 'major', 'major', 'minor', 'minor', 'minor', 'dim']);
        expect(info.main.map((c) => c.label.endsWith('m'))).toEqual([false, false, false, true, true, true, false]);
        expect(info.main[6].label.endsWith('°')).toBe(true);
      }

      expect(majorInfo.main.map((c) => c.numeral)).toEqual(['IV', 'I', 'V', 'ii', 'vi', 'iii', 'vii°']);
      for (const cell of majorInfo.main) expect(QUALITY_OF[cell.numeral]).toBeDefined();
      expect(minorInfo.main.map((c) => c.numeral)).toEqual(['VI', 'III', 'VII', 'iv', 'i', 'v', 'ii°']);

      // Home: I on the outer ring in major, i on the middle ring in minor, both at the key's position.
      const k = dialPosition(major);
      expect(majorInfo.main.filter((c) => c.home).map((c) => c.numeral)).toEqual(['I']);
      expect(majorInfo.main.find((c) => c.home)).toMatchObject({ ring: 'major', pos: k, label: major });
      expect(minorInfo.main.filter((c) => c.home).map((c) => c.numeral)).toEqual(['i']);
      expect(minorInfo.main.find((c) => c.home)).toMatchObject({ ring: 'minor', pos: k });
      expect(minorInfo.tonic).toBe(minorInfo.main.find((c) => c.home)!.label.slice(0, -1));
    });

    it(`${major}: the window agrees with the app's own diatonic roots`, () => {
      const note = dialNameToNote(major);
      const info = describe_(major, 'major', 'in-key');
      const byNumeral = Object.fromEntries(info.main.map((c) => [c.numeral, c.label]));
      ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'].forEach((numeral, i) => {
        const root = byNumeral[numeral].replace(/[m°]$/, '');
        expect(dialNameToNote(root)).toBe(getDiatonicRoot(note, 'major', i + 1));
      });
    });

    it(`${major}: the windows sit three consecutive places, minors one ring in`, () => {
      const k = dialPosition(major);
      const info = describe_(major, 'major', 'in-key');
      expect(info.main.map((c) => c.pos)).toEqual([k - 1, k, k + 1, k - 1, k, k + 1, k + 1].map((p) => (p + 12) % 12));
    });
  }

  it('spells D major: IV G, I D, V A, ii Em, vi Bm, iii F♯m, vii° C♯°', () => {
    expect(chords(describe_('D', 'major', 'in-key').main)).toEqual([
      'IV G', 'I D', 'V A', 'ii Em', 'vi Bm', 'iii F♯m', 'vii° C♯°',
    ]);
  });

  it('spells the chords letter by letter: C♭ in G♭ major, E♯° in F♯ major', () => {
    expect(chords(describe_('G♭', 'major', 'in-key').main)).toEqual([
      'IV C♭', 'I G♭', 'V D♭', 'ii A♭m', 'vi E♭m', 'iii B♭m', 'vii° F°',
    ]);
    expect(describe_('F♯', 'major', 'in-key').main[6].label).toBe('E♯°');
  });

  it('puts the same shape on every key: turning the dial transposes', () => {
    for (const major of MAJOR_NAMES) {
      const k = dialPosition(major);
      const info = describe_(major, 'major', 'in-key');
      expect(info.main.map((c) => [c.ring, (c.pos - k + 12) % 12])).toEqual([
        ['major', 11], ['major', 0], ['major', 1], ['minor', 11], ['minor', 0], ['minor', 1], ['dim', 1],
      ]);
    }
  });
});

describe('the plate and the captions', () => {
  it('names the tonic, mode, signature and relative key', () => {
    expect(describe_('D', 'major', 'in-key').plate).toEqual({
      key: 'D', sub: 'MAJOR · 2♯', rel: 'relative B minor',
    });
    expect(describe_('D', 'minor', 'in-key').plate).toEqual({
      key: 'B', sub: 'MINOR · 2♯', rel: 'relative D major',
    });
    expect(describe_('C', 'major', 'in-key').plate.sub).toBe('MAJOR');
  });

  it('gives every key in every view a two-line caption', () => {
    for (const major of MAJOR_NAMES) {
      for (const mode of ['major', 'minor'] as const) {
        for (const view of ['in-key', 'borrowed', 'dominants'] as const) {
          const caption = describe_(major, mode, view).caption;
          expect(caption).toHaveLength(2);
          for (const line of caption) {
            expect(line.length).toBeGreaterThan(10);
            expect(line).not.toMatch(/undefined|NaN|[♯♭]{2}|##|bb/);
          }
        }
      }
    }
  });
});

describe('Borrowed', () => {
  it('B minor: the parallel major sits three steps clockwise (IV E, I B, V F♯ …)', () => {
    const info = describe_('D', 'minor', 'borrowed');
    expect(info.tonic).toBe('B');
    expect(info.ghost).toBe(90);
    expect(chords(info.extra)).toEqual([
      'IV E', 'I B', 'V F♯', 'ii C♯m', 'vi G♯m', 'iii D♯m', 'vii° A♯°',
    ]);
    expect(info.caption[0]).toBe('Three steps clockwise is B major, the same home in daylight.');
  });

  it('G♭ major: the parallel minor is respelled F♯ minor', () => {
    const info = describe_('G♭', 'major', 'borrowed');
    expect(info.ghost).toBe(-90);
    expect(chords(info.extra)).toEqual([
      '♭VI D', '♭III A', '♭VII E', 'iv Bm', 'i F♯m', 'v C♯m', 'ii° G♯°',
    ]);
    expect(info.caption[0]).toBe('Three steps counter-clockwise is F♯ minor: the same home, in the dark.');
    expect(info.caption[1]).toContain('F♯ – D – E – F♯');
  });

  it('D♭ major: the parallel minor is written C♯ minor', () => {
    const info = describe_('D♭', 'major', 'borrowed');
    expect(info.caption[0]).toContain('C♯ minor');
    expect(chords(info.extra)).toEqual([
      '♭VI A', '♭III E', '♭VII B', 'iv F♯m', 'i C♯m', 'v G♯m', 'ii° D♯°',
    ]);
  });

  it('C major: the parallel minor is C minor, three places counter-clockwise (E♭ major\'s window)', () => {
    const info = describe_('C', 'major', 'borrowed');
    expect(chords(info.extra)).toEqual([
      '♭VI A♭', '♭III E♭', '♭VII B♭', 'iv Fm', 'i Cm', 'v Gm', 'ii° D°',
    ]);
    expect(info.extra.find((c) => c.numeral === 'i')!.pos).toBe(9);
  });

  it('is always the window three steps away, with no double accidentals', () => {
    for (const major of MAJOR_NAMES) {
      const k = dialPosition(major);
      for (const mode of ['major', 'minor'] as const) {
        const info = describe_(major, mode, 'borrowed');
        const home = info.extra.find((c) => c.numeral === (mode === 'major' ? 'i' : 'I'))!;
        expect(home.pos).toBe(mode === 'major' ? (k + 9) % 12 : (k + 3) % 12);
        // The borrowed home is the key's own tonic, by pitch.
        const tonicPitch = pitchClassOf(parseDialName(info.tonic));
        expect(pitchClassOf(parseDialName(home.label.replace(/m$/, '')))).toBe(tonicPitch);
        for (const cell of info.extra) {
          expect(Math.abs(parseDialName(cell.label.replace(/[m°]$/, '')).accidental)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('Dominants', () => {
  it('F♯ major: V/V G♯7, V/ii D♯7, V/vi A♯7, V/iii E♯7', () => {
    const info = describe_('F♯', 'major', 'dominants');
    expect(info.ghost).toBe('dominants');
    expect(chords(info.extra)).toEqual(['V/V G♯7', 'V/ii D♯7', 'V/vi A♯7', 'V/iii E♯7']);
  });

  it('C major: D7, A7, E7, B7 on the four places clockwise of V', () => {
    const info = describe_('C', 'major', 'dominants');
    expect(chords(info.extra)).toEqual(['V/V D7', 'V/ii A7', 'V/vi E7', 'V/iii B7']);
    expect(info.extra.map((c) => c.pos)).toEqual([2, 3, 4, 5]);
    expect(info.caption[1]).toBe(
      'Walk them back, B7 → E7 → A7 → D7 → G7 → C, and each chord falls a fifth into the next.',
    );
  });

  it('A minor: V/VII D7, V/iv A7, V E7, V/v B7', () => {
    const info = describe_('C', 'minor', 'dominants');
    expect(chords(info.extra)).toEqual(['V/VII D7', 'V/iv A7', 'V E7', 'V/v B7']);
  });

  it('each dominant sits a fifth above the chord it leads to, in every key', () => {
    for (const major of MAJOR_NAMES) {
      const info = describe_(major, 'major', 'dominants');
      const scale = describe_(major, 'major', 'in-key').main;
      const target: Record<string, string> = {
        'V/V': scale[2].label,
        'V/ii': scale[3].label,
        'V/vi': scale[4].label,
        'V/iii': scale[5].label,
      };
      for (const cell of info.extra) {
        const root = pitchClassOf(parseDialName(cell.label.replace(/7$/, '')));
        const goes = pitchClassOf(parseDialName(target[cell.numeral].replace(/m$/, '')));
        expect((root + 5) % 12).toBe(goes);
      }
    }
  });
});

describe('the unlit dial', () => {
  it('labels each ring at every position', () => {
    expect(defaultCellLabel('major', 0)).toBe('C');
    expect(defaultCellLabel('minor', 0)).toBe('Am');
    expect(defaultCellLabel('dim', 0)).toBe('B°');
    expect(defaultCellLabel('minor', 7)).toBe('B♭m');
    expect(defaultCellLabel('dim', 6)).toBe('E♯°');
  });
});
