import {
  parseDialName,
  type DialCell,
  type KeyDialInfo,
  type KeyDialView,
} from './keyDial';
import { pitchClassOf } from './noteSpelling';
import { OPEN_STRING_SEMITONES, STRING_COUNT } from './tuning';

/*
 * The key's chords on the neck (Theory › Neck, roadmap package H2).
 *
 * Everything comes from `describeKeyDial`, so the dial and the neck cannot
 * disagree: a chord's label gives its root, its ring gives its quality, and
 * the numerals are the dial's own. The neck marks every place a chord's root
 * falls on frets 0 to 12.
 */

/** The vertical neck always shows one octave: frets 0 (open) to 12. */
export const NECK_FRETS = 12;

/**
 * How a marker is drawn. `home` is I (i in minor); `major`, `minor` and `dim`
 * follow the chord's ring; `extra` is a borrowed chord or a secondary
 * dominant, which the Borrowed and Dominants views draw in a style of their own.
 */
export type NeckMarkerKind = 'home' | 'major' | 'minor' | 'dim' | 'extra';

export interface NeckMarker {
  /** String index as everywhere in the app: 0 is the high e, 5 the low E. */
  string: number;
  /** 0 is the open string. */
  fret: number;
  pitchClass: number;
  numeral: string;
  kind: NeckMarkerKind;
  /** The root as the dial spells it: "F", "B♭". */
  root: string;
  /** The chord as the dial prints it: "F", "Dm", "B°", "D7". */
  chord: string;
  /** What a hover says: "F · IV · F major". */
  title: string;
  /** The key's own chords step back while a view is about the extras. */
  dimmed: boolean;
}

/** The chord symbol's last letter says its quality: m, ° or 7. */
const QUALITY_SUFFIX = /[m°7]$/;

/** "B♭m" → "B♭". */
export function chordRoot(label: string): string {
  return label.replace(QUALITY_SUFFIX, '');
}

function chordWords(cell: DialCell, root: string): string {
  if (cell.label.endsWith('°')) return `${root} diminished`;
  if (cell.label.endsWith('7')) return cell.label;
  if (cell.label.endsWith('m')) return `${root} minor`;
  return `${root} major`;
}

function kindOf(cell: DialCell, extra: boolean): NeckMarkerKind {
  if (extra) return 'extra';
  if (cell.home) return 'home';
  return cell.ring;
}

/**
 * Every marker the neck draws for a dial state, string by string. One marker
 * per place: where an extra chord shares a root with one of the key's own
 * (iv and IV on F in C major), the extra wins, because the view is about it.
 */
export function neckChordMap(info: KeyDialInfo): NeckMarker[] {
  const byPitch = new Map<number, { cell: DialCell; extra: boolean }>();
  for (const cell of info.main) {
    byPitch.set(pitchClassOf(parseDialName(chordRoot(cell.label))), { cell, extra: false });
  }
  for (const cell of info.extra) {
    byPitch.set(pitchClassOf(parseDialName(chordRoot(cell.label))), { cell, extra: true });
  }
  const dimMain = info.extra.length > 0;

  const markers: NeckMarker[] = [];
  for (let string = 0; string < STRING_COUNT; string++) {
    for (let fret = 0; fret <= NECK_FRETS; fret++) {
      const pitchClass = (OPEN_STRING_SEMITONES[string] + fret) % 12;
      const entry = byPitch.get(pitchClass);
      if (!entry) continue;
      const { cell, extra } = entry;
      const root = chordRoot(cell.label);
      markers.push({
        string,
        fret,
        pitchClass,
        numeral: cell.numeral,
        kind: kindOf(cell, extra),
        root,
        chord: cell.label,
        title: `${root} · ${cell.numeral} · ${chordWords(cell, root)}`,
        dimmed: dimMain && !extra,
      });
    }
  }
  return markers;
}

/** What the legend line under the neck shows: the styles, in this view. */
export interface NeckLegendItem {
  kind: NeckMarkerKind;
  word: string;
  /** A numeral of this key, to show the style on. */
  numeral: string;
  /** Dimmed like the key's own chords while a view is about the extras. */
  dimmed: boolean;
}

/**
 * The marker styles of this view in one line: home, major, minor and
 * diminished always, plus the extra style in Borrowed and Dominants.
 */
export function neckLegend(info: KeyDialInfo): NeckLegendItem[] {
  const view: KeyDialView = info.state.view;
  const dimmed = view !== 'in-key';
  const sample = (ring: DialCell['ring']) =>
    info.main.find((cell) => cell.ring === ring && !cell.home)?.numeral ?? '';
  const items: NeckLegendItem[] = [
    { kind: 'home', word: 'home', numeral: info.main.find((cell) => cell.home)?.numeral ?? 'I', dimmed },
    { kind: 'major', word: 'major', numeral: sample('major'), dimmed },
    { kind: 'minor', word: 'minor', numeral: sample('minor'), dimmed },
    { kind: 'dim', word: 'diminished', numeral: sample('dim'), dimmed },
  ];
  if (view !== 'in-key' && info.extra.length > 0) {
    items.push({
      kind: 'extra',
      word: view === 'borrowed' ? 'borrowed' : 'dominant',
      numeral: info.extra[0].numeral,
      dimmed: false,
    });
  }
  return items;
}

/** "C minor" or "A major": the key the Borrowed view takes its chords from. */
function borrowedFrom(info: KeyDialInfo): string {
  const minorKey = info.state.mode === 'minor';
  const home = info.extra.find((cell) => cell.numeral === (minorKey ? 'I' : 'i'));
  const root = home ? chordRoot(home.label) : info.tonic;
  return `${root} ${minorKey ? 'major' : 'minor'}`;
}

/**
 * The caption that follows the view while Neck is on, one paragraph. Each
 * claim was checked on the neck in standard tuning (docs/specs/H2); check a
 * changed line again.
 */
export function neckCaption(info: KeyDialInfo): string[] {
  const minorKey = info.state.mode === 'minor';
  if (info.state.view === 'borrowed') {
    return [
      minorKey
        ? `Borrowed from ${borrowedFrom(info)}: IV and V sit on the same roots as iv and v. Only their 3rds move, a fret up.`
        : `Borrowed from ${borrowedFrom(info)}: ♭VII sits two frets below any I on the same string, ♭III three frets above it, ♭VI four below.`,
    ];
  }
  if (info.state.view === 'dominants') {
    return [
      "Each secondary dominant sits a 5th above the chord it leads to. Find the target's root: its V7 is one string lower at the same fret, or a fret lower when the target is on the B string.",
    ];
  }
  return [
    minorKey
      ? 'The same seven chords, by root, across the whole neck. Find any i: iv and v are always one string away.'
      : 'The same seven chords, by root, across the whole neck. Find any I: IV and V are always one string away.',
  ];
}

/** The figure's name for a screen reader: "C major's seven chords by root, frets 0 to 12". */
export function neckAriaLabel(info: KeyDialInfo): string {
  const key = `${info.tonic} ${info.state.mode}`;
  const tail = `by root, frets 0 to ${NECK_FRETS}`;
  if (info.state.view === 'borrowed') {
    return `${key}'s seven chords and the chords borrowed from ${borrowedFrom(info)}, ${tail}`;
  }
  if (info.state.view === 'dominants') {
    return `${key}'s seven chords and its secondary dominants, ${tail}`;
  }
  return `${key}'s seven chords ${tail}`;
}
