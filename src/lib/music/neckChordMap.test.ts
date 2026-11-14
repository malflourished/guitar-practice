import { describe, expect, it } from 'vitest';
import {
  DIAL_ALTERNATE,
  DIAL_MAJORS,
  describeKeyDial,
  parseDialName,
  type KeyDialInfo,
  type KeyDialView,
} from './keyDial';
import {
  NECK_FRETS,
  chordRoot,
  neckAriaLabel,
  neckCaption,
  neckChordMap,
  neckLegend,
  type NeckMarker,
} from './neckChordMap';
import { pitchClassOf } from './noteSpelling';
import { OPEN_STRING_SEMITONES, STRING_COUNT, STRING_LABELS } from './tuning';

const MAJORS = [...DIAL_MAJORS, DIAL_ALTERNATE[6]];
const MODES = ['major', 'minor'] as const;
const VIEWS: KeyDialView[] = ['in-key', 'borrowed', 'dominants'];

const info = (major: string, mode: 'major' | 'minor', view: KeyDialView) =>
  describeKeyDial({ major, mode, view });

const rootPitch = (label: string) => pitchClassOf(parseDialName(chordRoot(label)));

const at = (markers: NeckMarker[], string: number, fret: number) =>
  markers.find((m) => m.string === string && m.fret === fret);

/** Every place a pitch class falls on frets 0 to 12, by brute force. */
function placesOf(pitchClasses: Set<number>): string[] {
  const places: string[] = [];
  for (let string = 0; string < STRING_COUNT; string++) {
    for (let fret = 0; fret <= NECK_FRETS; fret++) {
      if (pitchClasses.has((OPEN_STRING_SEMITONES[string] + fret) % 12)) places.push(`${string}:${fret}`);
    }
  }
  return places;
}

const placeOf = (m: NeckMarker) => `${m.string}:${m.fret}`;

describe('the map in key', () => {
  it('C major: the mock-up\'s markers, open strings included (E iii, A vi, D ii, G V, B vii°, e iii)', () => {
    const markers = neckChordMap(info('C', 'major', 'in-key'));
    const open = Object.fromEntries(
      markers.filter((m) => m.fret === 0).map((m) => [STRING_LABELS[m.string], m.numeral]),
    );
    expect(open).toEqual({ E: 'iii', A: 'vi', D: 'ii', G: 'V', B: 'vii°', e: 'iii' });
  });

  it('C major: the low E string reads iii IV . V . vi . vii° I . ii . iii down frets 0 to 12', () => {
    const markers = neckChordMap(info('C', 'major', 'in-key'));
    const lowE = Array.from({ length: NECK_FRETS + 1 }, (_, fret) => at(markers, 5, fret)?.numeral ?? '.');
    expect(lowE).toEqual(['iii', 'IV', '.', 'V', '.', 'vi', '.', 'vii°', 'I', '.', 'ii', '.', 'iii']);
  });

  it('marks every place a root falls on frets 0 to 12, and nothing else, in all 12 keys and both modes', () => {
    for (const major of MAJORS) {
      for (const mode of MODES) {
        const dial = info(major, mode, 'in-key');
        const roots = new Set(dial.main.map((cell) => rootPitch(cell.label)));
        expect(roots.size).toBe(7);
        const markers = neckChordMap(dial);
        expect(markers.map(placeOf).sort()).toEqual(placesOf(roots).sort());
        for (const m of markers) {
          expect(roots.has(m.pitchClass)).toBe(true);
          // The marker's pitch really is what sounds at that string and fret.
          expect((OPEN_STRING_SEMITONES[m.string] + m.fret) % 12).toBe(m.pitchClass);
          // It wears the numeral of the chord rooted there.
          const cell = dial.main.find((c) => rootPitch(c.label) === m.pitchClass)!;
          expect(m.numeral).toBe(cell.numeral);
          expect(m.chord).toBe(cell.label);
          expect(m.dimmed).toBe(false);
        }
      }
    }
  });

  it('styles the chords as the dial rings them: home, major, minor, diminished', () => {
    const kinds = (dial: KeyDialInfo) =>
      Object.fromEntries(
        neckChordMap(dial)
          .filter((m) => m.string === 5)
          .map((m) => [m.numeral, m.kind]),
      );
    expect(kinds(info('C', 'major', 'in-key'))).toEqual({
      iii: 'minor', IV: 'major', V: 'major', vi: 'minor', 'vii°': 'dim', I: 'home', ii: 'minor',
    });
    // A minor shares C major's chords, with home moved to i.
    expect(kinds(info('C', 'minor', 'in-key'))).toEqual({
      v: 'minor', VI: 'major', VII: 'major', i: 'home', 'ii°': 'dim', III: 'major', iv: 'minor',
    });
  });

  it('puts one marker, home, on each place its root falls', () => {
    for (const major of MAJORS) {
      for (const mode of MODES) {
        const dial = info(major, mode, 'in-key');
        const homePitch = rootPitch(dial.main.find((c) => c.home)!.label);
        const homes = neckChordMap(dial).filter((m) => m.kind === 'home');
        expect(homes.length).toBeGreaterThan(0);
        expect(homes.every((m) => m.pitchClass === homePitch)).toBe(true);
        expect(homes.map(placeOf).sort()).toEqual(placesOf(new Set([homePitch])).sort());
      }
    }
  });

  it('titles each marker with its note, numeral and chord', () => {
    const c = neckChordMap(info('C', 'major', 'in-key'));
    expect(at(c, 5, 1)!.title).toBe('F · IV · F major');
    expect(at(c, 5, 8)!.title).toBe('C · I · C major');
    expect(at(c, 5, 10)!.title).toBe('D · ii · D minor');
    expect(at(c, 1, 0)!.title).toBe('B · vii° · B diminished');
    // The dial's spelling, not a sharp-only one: C♭ in G♭ major sits on the B string's open note.
    const gFlat = neckChordMap(info('G♭', 'major', 'in-key'));
    expect(at(gFlat, 1, 0)!.title).toBe('C♭ · IV · C♭ major');
    expect(at(gFlat, 1, 0)!.root).toBe('C♭');
  });
});

/**
 * The chords Borrowed marks, as the spec names them: not the whole parallel
 * window but the few most often borrowed, by numeral. Spelled out here so the
 * tests do not lean on the helper they check.
 */
const BORROWED: Record<'major' | 'minor', string[]> = {
  major: ['♭III', 'iv', '♭VI', '♭VII'],
  minor: ['IV', 'V'],
};

/** The dial's extra cells a view marks on the neck. */
const markedCells = (dial: KeyDialInfo) =>
  dial.state.view === 'borrowed'
    ? dial.extra.filter((cell) => BORROWED[dial.state.mode].includes(cell.numeral))
    : dial.extra;

describe('the map in Borrowed and Dominants', () => {
  it('Borrowed in C major: the borrowed kind sits on exactly the E♭, F, A♭ and B♭ roots, and C still reads I', () => {
    const markers = neckChordMap(info('C', 'major', 'borrowed'));
    const borrowed = markers.filter((m) => m.kind === 'extra');
    expect(Object.fromEntries(borrowed.map((m) => [m.root, m.numeral]))).toEqual({
      'E♭': '♭III',
      F: 'iv',
      'A♭': '♭VI',
      'B♭': '♭VII',
    });
    // Every place those four roots fall is marked, in the borrowed style at full strength.
    expect(borrowed.map(placeOf).sort()).toEqual(placesOf(new Set([3, 5, 8, 10])).sort());
    expect(borrowed.every((m) => !m.dimmed)).toBe(true);

    const lowE = Object.fromEntries(markers.filter((m) => m.string === 5).map((m) => [m.fret, m]));
    // F is the root of IV and of iv: the borrowed chord's numeral shows.
    expect(lowE[1]).toMatchObject({ numeral: 'iv', kind: 'extra' });
    expect(lowE[4]).toMatchObject({ numeral: '♭VI', kind: 'extra' });
    expect(lowE[11]).toMatchObject({ numeral: '♭III', kind: 'extra' });
    expect(lowE[6]).toMatchObject({ numeral: '♭VII', kind: 'extra' });
    // Every other root keeps its own in-key numeral and style, stepped back: C stays I, G stays V, D stays ii.
    expect(lowE[8]).toMatchObject({ numeral: 'I', kind: 'home', dimmed: true });
    expect(lowE[3]).toMatchObject({ numeral: 'V', kind: 'major', dimmed: true });
    expect(lowE[10]).toMatchObject({ numeral: 'ii', kind: 'minor', dimmed: true });
    expect(lowE[0]).toMatchObject({ numeral: 'iii', kind: 'minor', dimmed: true });
    expect(lowE[5]).toMatchObject({ numeral: 'vi', kind: 'minor', dimmed: true });
    expect(lowE[7]).toMatchObject({ numeral: 'vii°', kind: 'dim', dimmed: true });
    // Nothing else of C minor: no i, v or ii°.
    expect(new Set(markers.map((m) => m.numeral))).toEqual(
      new Set(['♭III', 'iv', '♭VI', '♭VII', 'I', 'ii', 'iii', 'V', 'vi', 'vii°']),
    );
  });

  it('Borrowed in A minor: only D and E are the borrowed kind, as IV and V', () => {
    // 'C' with mode minor is the relative minor, A minor.
    const dial = info('C', 'minor', 'borrowed');
    expect(dial.tonic).toBe('A');
    const markers = neckChordMap(dial);
    const borrowed = markers.filter((m) => m.kind === 'extra');
    expect(Object.fromEntries(borrowed.map((m) => [m.root, m.numeral]))).toEqual({ D: 'IV', E: 'V' });
    expect(borrowed.map(placeOf).sort()).toEqual(placesOf(new Set([2, 4])).sort());
    expect(borrowed.every((m) => !m.dimmed)).toBe(true);

    const lowE = Object.fromEntries(markers.filter((m) => m.string === 5).map((m) => [m.fret, m]));
    // D and E are the roots of iv and v too: the borrowed numeral shows.
    expect(lowE[10]).toMatchObject({ numeral: 'IV', kind: 'extra' });
    expect(lowE[0]).toMatchObject({ numeral: 'V', kind: 'extra' });
    // The other roots keep the minor key's own numerals, stepped back.
    expect(lowE[5]).toMatchObject({ numeral: 'i', kind: 'home', dimmed: true });
    expect(lowE[7]).toMatchObject({ numeral: 'ii°', kind: 'dim', dimmed: true });
    expect(lowE[8]).toMatchObject({ numeral: 'III', kind: 'major', dimmed: true });
    expect(lowE[1]).toMatchObject({ numeral: 'VI', kind: 'major', dimmed: true });
    expect(lowE[3]).toMatchObject({ numeral: 'VII', kind: 'major', dimmed: true });
    expect(new Set(markers.map((m) => m.numeral))).toEqual(new Set(['IV', 'V', 'i', 'ii°', 'III', 'VI', 'VII']));
  });

  it('Borrowed in all 12 keys and both modes: the borrowed kind sits on exactly the commonly borrowed roots, and home keeps its numeral', () => {
    for (const major of MAJORS) {
      for (const mode of MODES) {
        const dial = info(major, mode, 'borrowed');
        const cells = markedCells(dial);
        expect(cells.map((c) => c.numeral).sort()).toEqual([...BORROWED[mode]].sort());
        const roots = new Set(cells.map((c) => rootPitch(c.label)));
        expect(roots.size).toBe(BORROWED[mode].length);

        const markers = neckChordMap(dial);
        const borrowed = markers.filter((m) => m.kind === 'extra');
        expect(borrowed.map(placeOf).sort()).toEqual(placesOf(roots).sort());
        expect(new Set(borrowed.map((m) => m.numeral))).toEqual(new Set(BORROWED[mode]));
        for (const m of borrowed) {
          expect(roots.has(m.pitchClass)).toBe(true);
          expect(m.dimmed).toBe(false);
        }

        // The key's own home is never one of them: it keeps I (i in minor), stepped back.
        const homePitch = rootPitch(dial.main.find((c) => c.home)!.label);
        expect(roots.has(homePitch)).toBe(false);
        const homes = markers.filter((m) => m.pitchClass === homePitch);
        expect(homes.length).toBeGreaterThan(0);
        for (const m of homes) {
          expect(m).toMatchObject({ numeral: mode === 'major' ? 'I' : 'i', kind: 'home', dimmed: true });
        }

        // Nothing from the rest of the parallel window: only the key's own roots and the borrowed few.
        const own = new Set(dial.main.map((c) => rootPitch(c.label)));
        for (const m of markers) expect(own.has(m.pitchClass) || roots.has(m.pitchClass)).toBe(true);
      }
    }
  });

  it('Dominants in C major: V/V D7, V/ii A7, V/vi E7, V/iii B7 sit on the roots of ii, vi, iii, vii°', () => {
    const markers = neckChordMap(info('C', 'major', 'dominants'));
    const lowE = Object.fromEntries(markers.filter((m) => m.string === 5).map((m) => [m.fret, m]));
    expect(lowE[10]).toMatchObject({ numeral: 'V/V', kind: 'extra', chord: 'D7' });
    expect(lowE[5]).toMatchObject({ numeral: 'V/ii', kind: 'extra', chord: 'A7' });
    expect(lowE[0]).toMatchObject({ numeral: 'V/vi', kind: 'extra', chord: 'E7' });
    expect(lowE[7]).toMatchObject({ numeral: 'V/iii', kind: 'extra', chord: 'B7' });
    // I, IV and V stay, stepped back.
    expect(lowE[8]).toMatchObject({ numeral: 'I', kind: 'home', dimmed: true });
    expect(lowE[1]).toMatchObject({ numeral: 'IV', kind: 'major', dimmed: true });
    expect(lowE[3]).toMatchObject({ numeral: 'V', kind: 'major', dimmed: true });
    expect(at(markers, 5, 10)!.title).toBe('D · V/V · D7');
  });

  it('Dominants in a minor key: V on the root of v, and the rest as the dial names them', () => {
    const markers = neckChordMap(info('C', 'minor', 'dominants'));
    const numerals = new Set(markers.filter((m) => m.kind === 'extra').map((m) => m.numeral));
    expect(numerals).toEqual(new Set(['V/VII', 'V/iv', 'V', 'V/v']));
    // E is the root of v (Em) and of V (E7): the extra's V shows.
    expect(at(markers, 5, 0)).toMatchObject({ numeral: 'V', kind: 'extra' });
  });

  it('in every key, both modes: each marked extra wears all its places, and the key\'s own chords fill the rest', () => {
    for (const major of MAJORS) {
      for (const mode of MODES) {
        for (const view of ['borrowed', 'dominants'] as const) {
          const dial = info(major, mode, view);
          const markers = neckChordMap(dial);
          const extraRoots = new Map(markedCells(dial).map((cell) => [rootPitch(cell.label), cell]));
          const mainRoots = new Map(dial.main.map((cell) => [rootPitch(cell.label), cell]));

          expect(extraRoots.size).toBeGreaterThan(0);
          const all = new Set([...extraRoots.keys(), ...mainRoots.keys()]);
          expect(markers.map(placeOf).sort()).toEqual(placesOf(all).sort());

          for (const m of markers) {
            const extra = extraRoots.get(m.pitchClass);
            if (extra) {
              expect(m.kind).toBe('extra');
              expect(m.numeral).toBe(extra.numeral);
              expect(m.chord).toBe(extra.label);
              expect(m.dimmed).toBe(false);
            } else {
              const main = mainRoots.get(m.pitchClass)!;
              expect(m.kind).not.toBe('extra');
              expect(m.numeral).toBe(main.numeral);
              expect(m.dimmed).toBe(true);
            }
          }
        }
      }
    }
  });

  it('Borrowed in a respelled parallel key keeps the dial\'s spelling (G♭ major borrows D, A, E and B from F♯ minor)', () => {
    const markers = neckChordMap(info('G♭', 'major', 'borrowed'));
    const borrowed = Object.fromEntries(
      markers.filter((m) => m.kind === 'extra').map((m) => [m.numeral, m.root]),
    );
    expect(borrowed).toEqual({ '♭VI': 'D', '♭III': 'A', '♭VII': 'E', iv: 'B' });
  });
});

describe('the legend', () => {
  it('lists home, major, minor and diminished, plus the extra style in Borrowed and Dominants', () => {
    const words = (view: KeyDialView) => neckLegend(info('C', 'major', view)).map((i) => i.word);
    expect(words('in-key')).toEqual(['home', 'major', 'minor', 'diminished']);
    expect(words('borrowed')).toEqual(['home', 'major', 'minor', 'diminished', 'borrowed']);
    expect(words('dominants')).toEqual(['home', 'major', 'minor', 'diminished', 'dominant']);
  });

  it('shows each style on a numeral of the key: I IV ii vii° in major, i VI iv ii° in minor', () => {
    expect(neckLegend(info('C', 'major', 'in-key')).map((i) => i.numeral)).toEqual(['I', 'IV', 'ii', 'vii°']);
    expect(neckLegend(info('C', 'minor', 'in-key')).map((i) => i.numeral)).toEqual(['i', 'VI', 'iv', 'ii°']);
    expect(neckLegend(info('C', 'major', 'borrowed')).map((i) => i.numeral)[4]).toBe('♭VI');
    expect(neckLegend(info('C', 'major', 'dominants')).map((i) => i.numeral)[4]).toBe('V/V');
  });

  it('steps the key\'s own styles back where the markers are, and keeps the extra at full strength', () => {
    expect(neckLegend(info('C', 'major', 'in-key')).every((i) => !i.dimmed)).toBe(true);
    const borrowed = neckLegend(info('C', 'major', 'borrowed'));
    expect(borrowed.slice(0, 4).every((i) => i.dimmed)).toBe(true);
    expect(borrowed[4]).toMatchObject({ kind: 'extra', dimmed: false });
  });

  it('has a legend in every key, mode and view', () => {
    for (const major of MAJORS) {
      for (const mode of MODES) {
        for (const view of VIEWS) {
          const items = neckLegend(info(major, mode, view));
          expect(items).toHaveLength(view === 'in-key' ? 4 : 5);
          expect(items.every((i) => i.numeral.length > 0)).toBe(true);
        }
      }
    }
  });
});

describe('the words that follow the view', () => {
  it('In key', () => {
    expect(neckCaption(info('C', 'major', 'in-key'))).toEqual([
      'The same seven chords, by root, across the whole neck. Find any I: IV and V are always one string away.',
    ]);
    expect(neckCaption(info('C', 'minor', 'in-key'))).toEqual([
      'The same seven chords, by root, across the whole neck. Find any i: iv and v are always one string away.',
    ]);
  });

  it('Borrowed in a major key names the parallel minor, as the dial spells it', () => {
    expect(neckCaption(info('C', 'major', 'borrowed'))).toEqual([
      "Borrowed from C minor: ♭VII sits two frets below any I on the same string, ♭III three above, ♭VI four below. iv shares IV's root; only its 3rd drops a fret.",
    ]);
    // G♭ major's parallel minor is written F♯ minor, as on the dial.
    expect(neckCaption(info('G♭', 'major', 'borrowed'))[0]).toMatch(/^Borrowed from F♯ minor: /);
    expect(neckCaption(info('D♭', 'major', 'borrowed'))[0]).toMatch(/^Borrowed from C♯ minor: /);
  });

  it('Borrowed in a minor key names the parallel major', () => {
    expect(neckCaption(info('C', 'minor', 'borrowed'))).toEqual([
      'Borrowed from A major: IV and V sit on the same roots as iv and v. Only their 3rds move, a fret up.',
    ]);
    expect(neckCaption(info('D', 'minor', 'borrowed'))[0]).toMatch(/^Borrowed from B major: /);
  });

  it('Dominants', () => {
    const line =
      "Each secondary dominant sits a 5th above the chord it leads to. Find the target's root: its V7 is one string lower at the same fret, or a fret lower when the target is on the B string.";
    expect(neckCaption(info('C', 'major', 'dominants'))).toEqual([line]);
    expect(neckCaption(info('C', 'minor', 'dominants'))).toEqual([line]);
  });

  it('reads well in every key, mode and view', () => {
    for (const major of MAJORS) {
      for (const mode of MODES) {
        for (const view of VIEWS) {
          for (const line of neckCaption(info(major, mode, view))) {
            expect(line.length).toBeGreaterThan(40);
            expect(line).not.toMatch(/undefined|NaN|[♯♭]{2}|##|bb/);
          }
        }
      }
    }
  });

  it('claims of the Borrowed caption hold on the neck: ♭VII two frets below I, ♭III three above, ♭VI four below; iv shares IV\'s root and its 3rd drops a fret', () => {
    for (const major of MAJORS) {
      const dial = info(major, 'major', 'borrowed');
      const pitch = (numeral: string) => rootPitch(dial.extra.find((c) => c.numeral === numeral)!.label);
      const home = pitch('i');
      expect((home - pitch('♭VII') + 12) % 12).toBe(2);
      expect((pitch('♭III') - home + 12) % 12).toBe(3);
      expect((home - pitch('♭VI') + 12) % 12).toBe(4);

      // IV is major and iv is minor on the same root: the 3rd is a fret lower.
      const four = info(major, 'major', 'in-key').main.find((c) => c.numeral === 'IV')!;
      const minorFour = dial.extra.find((c) => c.numeral === 'iv')!;
      expect(rootPitch(minorFour.label)).toBe(rootPitch(four.label));
      expect(four.label.endsWith('m')).toBe(false);
      expect(minorFour.label.endsWith('m')).toBe(true);
    }
  });

  it('claims of the Dominants caption hold: a V7 sits one string lower at the same fret (a fret lower from the B string)', () => {
    for (const major of MAJORS) {
      const dial = info(major, 'major', 'dominants');
      const key = describeKeyDial({ major, mode: 'major', view: 'in-key' });
      const target = { 'V/V': 2, 'V/ii': 3, 'V/vi': 4, 'V/iii': 5 } as const;
      for (const cell of dial.extra) {
        const to = rootPitch(key.main[target[cell.numeral as keyof typeof target]].label);
        const from = rootPitch(cell.label);
        // Standard tuning, string index 0 = e … 5 = E: one string lower is the next index.
        for (let string = 0; string < STRING_COUNT - 1; string++) {
          for (let fret = 1; fret <= NECK_FRETS; fret++) {
            if ((OPEN_STRING_SEMITONES[string] + fret) % 12 !== to) continue;
            const lower = string + 1;
            const lowerFret = string === 1 ? fret - 1 : fret; // the B string is index 1
            expect((OPEN_STRING_SEMITONES[lower] + lowerFret) % 12).toBe(from);
          }
        }
      }
    }
  });
});

describe('the figure\'s name', () => {
  it('says whose chords, by root, over which frets', () => {
    expect(neckAriaLabel(info('C', 'major', 'in-key'))).toBe("C major's seven chords by root, frets 0 to 12");
    expect(neckAriaLabel(info('C', 'minor', 'in-key'))).toBe("A minor's seven chords by root, frets 0 to 12");
    expect(neckAriaLabel(info('C', 'major', 'borrowed'))).toBe(
      "C major's seven chords and the chords borrowed from C minor, by root, frets 0 to 12",
    );
    expect(neckAriaLabel(info('C', 'major', 'dominants'))).toBe(
      "C major's seven chords and its secondary dominants, by root, frets 0 to 12",
    );
  });
});
