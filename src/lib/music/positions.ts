import type {
  ChordQuality,
  FretPosition,
  NoteName,
  ScaleQuality,
  ScaleSystem,
} from '../../types/music';
import { getArpeggioIntervals } from './arpeggios';
import { getNoteAt, getPositionsForIntervals } from './fretboard';
import { noteToSemitone } from './notes';
import { MINOR_PENT_SHAPES } from './scaleBoxTemplates';
import { MINOR_PENTATONIC, getScaleIntervals, isPentatonic } from './scales';
import { FRET_COUNT, OPEN_STRING_MIDI, OPEN_STRING_SEMITONES } from './tuning';

export interface Position {
  /** 1-based position number for the slider. */
  number: number;
  startFret: number;
  endFret: number;
  /** Notes to render for this position. */
  positions: FretPosition[];
  /** String indices (0 = high e … 5 = low E) that are not played. */
  mutedStrings: number[];
}

export function ordinalPosition(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const LOW_E_STRING = 5;
const HIGH_E_STRING = 0;
/**
 * Fret span of a position window above its anchor (inclusive), i.e. the box
 * covers frets [anchor, anchor + REACH]. 4 keeps the open box reaching fret 4
 * so the open-position G# (and the symmetric two-E-string shape) is included.
 */
const REACH = 4;

/**
 * Build playable scale positions for a key/quality.
 *
 * - Pentatonic & blues — the five canonical box shapes (`buildBoxPositions`),
 *   anchored on the low-E pentatonic tones. Blues layers its blue note onto the
 *   pentatonic frame.
 * - Major / natural minor — `caged` (the same five boxes plus the two diatonic
 *   passing tones, the default) or `3nps` on request.
 * - Modes, harmonic/melodic minor — `3nps` only; a naive fret window drops
 *   notes and yields uneven shapes for these.
 *
 * `3nps` is three notes per string walking the degrees in pitch order: seven
 * positions, gap-free by construction.
 */
export function buildScalePositions(
  root: NoteName,
  quality: ScaleQuality,
  system: ScaleSystem = 'caged',
): Position[] {
  // Pentatonic & blues: five box shapes from the (relative) pentatonic frame.
  if (
    isPentatonic(quality) ||
    quality === 'majorBlues' ||
    quality === 'minorBlues'
  ) {
    return buildBoxPositions(root, quality);
  }

  // Major / natural minor: CAGED boxes by default, 3NPS on request.
  if (quality === 'major' || quality === 'minor') {
    return system === 'caged'
      ? buildBoxPositions(root, quality)
      : buildThreeNotesPerString(root, getScaleIntervals(quality));
  }

  // Modes, harmonic/melodic minor: 3NPS only.
  return buildThreeNotesPerString(root, getScaleIntervals(quality));
}

/** String indices ordered low E (5) → high e (0) for ascending pitch walks. */
const STRINGS_LOW_TO_HIGH = [5, 4, 3, 2, 1, 0] as const;

/**
 * Walk the scale degrees in ascending pitch, placing `notesPerString` notes on
 * each string from the low E up. Pitch is tracked absolutely, so crossing to a
 * higher string (including the major-third G→B gap) is handled automatically —
 * the shape stays in position with a consistent note count and no gaps. The
 * first note sits at `startFretLowE` on the low E string.
 */
function walkScaleShape(
  steps: number[],
  startDegree: number,
  notesPerString: number,
  startFretLowE: number,
): Omit<FretPosition, 'finger'>[] {
  const n = steps.length;
  const lowEOpen = OPEN_STRING_MIDI[5];
  let pitch = lowEOpen + startFretLowE;
  const notes: Omit<FretPosition, 'finger'>[] = [];

  for (let j = 0; j < 6 * notesPerString; j++) {
    if (j > 0) {
      const prevDegree = (startDegree + j - 1) % n;
      const stepUp = (steps[(prevDegree + 1) % n] - steps[prevDegree] + 12) % 12;
      pitch += stepUp;
    }
    const string = STRINGS_LOW_TO_HIGH[Math.floor(j / notesPerString)];
    const fret = pitch - OPEN_STRING_MIDI[string];
    notes.push({ string, fret, note: getNoteAt(string, fret) });
  }

  return notes;
}

function finalizeBox(
  notes: Omit<FretPosition, 'finger'>[],
): Omit<Position, 'number'> {
  const startFret = Math.min(...notes.map((p) => p.fret));
  const endFret = Math.max(...notes.map((p) => p.fret));
  const positions: FretPosition[] = notes.map((p) => ({
    ...p,
    finger: p.fret === 0 ? 0 : Math.min(4, p.fret - startFret + 1),
  }));
  return { startFret, endFret, positions, mutedStrings: [] };
}

/** Three-notes-per-string system: 7 positions, one per starting scale degree. */
function buildThreeNotesPerString(root: NoteName, steps: number[]): Position[] {
  const rootSemitone = noteToSemitone(root);
  const lowEOpenPc = OPEN_STRING_MIDI[5] % 12;

  const boxes: Omit<Position, 'number'>[] = [];

  for (let startDegree = 0; startDegree < steps.length; startDegree++) {
    const firstPc = (rootSemitone + steps[startDegree]) % 12;
    let startFret = ((firstPc - lowEOpenPc) % 12 + 12) % 12;

    let notes = walkScaleShape(steps, startDegree, 3, startFret);
    // Guard against any negative fret on higher strings (shift up an octave).
    while (notes.some((p) => p.fret < 0) && startFret + 12 <= FRET_COUNT) {
      startFret += 12;
      notes = walkScaleShape(steps, startDegree, 3, startFret);
    }

    boxes.push(finalizeBox(notes));
  }

  boxes.sort((a, b) => a.startFret - b.startFret);
  return boxes.map((box, index) => ({ ...box, number: index + 1 }));
}

/** Pitch class (0–11) of the low E open string — the frame for box anchors. */
const LOW_E_OPEN_PC = OPEN_STRING_SEMITONES[LOW_E_STRING];

interface BoxConfig {
  /**
   * Pitch class of the relative-minor root whose pentatonic frames the boxes.
   * Major-rooted scales (major pentatonic / blues / CAGED) share their boxes
   * with the relative minor, so they resolve to `root - 3 semitones`.
   */
  framePc: number;
  /**
   * Extra pitch classes layered onto the pentatonic frame wherever they fall
   * inside a box: the blue note for blues, the two passing tones for CAGED.
   */
  extras: number[];
}

function getBoxConfig(root: NoteName, quality: ScaleQuality): BoxConfig {
  const rootPc = noteToSemitone(root);
  const relativeMinorPc = (rootPc + 9) % 12; // major root → relative minor (−3)
  switch (quality) {
    case 'minorPentatonic':
      return { framePc: rootPc, extras: [] };
    case 'majorPentatonic':
      return { framePc: relativeMinorPc, extras: [] };
    case 'minorBlues':
      return { framePc: rootPc, extras: [(rootPc + 6) % 12] }; // ♭5
    case 'majorBlues':
      return { framePc: relativeMinorPc, extras: [(rootPc + 3) % 12] }; // ♭3
    case 'minor':
      return { framePc: rootPc, extras: [(rootPc + 2) % 12, (rootPc + 8) % 12] }; // 2, ♭6
    case 'major':
      return {
        framePc: relativeMinorPc,
        extras: [(rootPc + 5) % 12, (rootPc + 11) % 12], // 4, 7
      };
    default:
      return { framePc: rootPc, extras: [] };
  }
}

/** Pitch class (0–11) sounded at a fretboard location. */
function pitchClassAt(string: number, fret: number): number {
  return (OPEN_STRING_SEMITONES[string] + fret) % 12;
}

/**
 * Build the five canonical box shapes for a pentatonic / blues / CAGED scale.
 *
 * The five low-E anchors are the pentatonic tones of the (relative) minor key.
 * Crucially, each anchor is assigned the shape for **its scale degree** —
 * `MINOR_PENT_SHAPES` is keyed by pentatonic ordinal from the root, not by
 * sorted fret order — so the boxes come out correct in every key, not just the
 * ones whose open-string cut happens to line up with A-minor / C-major.
 *
 * Blue notes (blues) and diatonic passing tones (CAGED) are then added wherever
 * they fall inside the resulting box's fret span, keeping each box tight to its
 * pentatonic frame instead of a loose fret window.
 */
function buildBoxPositions(root: NoteName, quality: ScaleQuality): Position[] {
  const { framePc, extras } = getBoxConfig(root, quality);
  const boxes: Omit<Position, 'number'>[] = [];

  for (let ord = 0; ord < MINOR_PENT_SHAPES.length; ord++) {
    const shape = MINOR_PENT_SHAPES[ord];
    const anchorPc = (framePc + MINOR_PENTATONIC[ord]) % 12;
    let anchor = (((anchorPc - LOW_E_OPEN_PC) % 12) + 12) % 12;

    // Keep the whole shape on the neck: if its lowest note would fall below the
    // nut, take the box an octave up (mirrors the 3NPS octave guard).
    const minOffset = Math.min(...shape.map((cell) => cell.offset));
    if (anchor + minOffset < 0) anchor += 12;

    const seen = new Set<string>();
    const notes: Omit<FretPosition, 'finger'>[] = [];
    const add = (string: number, fret: number) => {
      if (fret < 0 || fret > FRET_COUNT) return;
      const key = `${string}:${fret}`;
      if (seen.has(key)) return;
      seen.add(key);
      notes.push({ string, fret, note: getNoteAt(string, fret) });
    };

    for (const cell of shape) add(cell.string, anchor + cell.offset);

    if (extras.length > 0 && notes.length > 0) {
      const lo = Math.min(...notes.map((n) => n.fret));
      const hi = Math.max(...notes.map((n) => n.fret));
      for (let string = HIGH_E_STRING; string <= LOW_E_STRING; string++) {
        for (let fret = lo; fret <= hi; fret++) {
          if (extras.includes(pitchClassAt(string, fret))) add(string, fret);
        }
      }
    }

    boxes.push(finalizeBox(notes));
  }

  boxes.sort((a, b) => a.startFret - b.startFret);
  return boxes.map((box, index) => ({ ...box, number: index + 1 }));
}

/**
 * Arpeggio positions reuse the same hand-box algorithm as scales, but with the
 * chord's 3–5 tones instead of a full scale. Each box is a playable region that
 * the sequential player walks root-up through the chord tones.
 */
export function buildArpeggioPositions(
  root: NoteName,
  quality: ChordQuality,
): Position[] {
  return buildIntervalPositions(root, getArpeggioIntervals(quality));
}

/**
 * Build playable "hand boxes" for an arbitrary set of intervals from the root.
 * Each box is anchored to a root-set tone on the low E string (one octave's
 * worth) and is a fret window [anchor, anchor + REACH] showing every target tone
 * that falls inside that window on every string, so the shapes come out
 * symmetric (the two E strings mirror each other) and include all the notes
 * reachable without shifting the hand. Shared by scales and arpeggios.
 */
function buildIntervalPositions(
  root: NoteName,
  intervals: number[],
): Position[] {
  const all = getPositionsForIntervals(root, intervals);

  const fretsByString: number[][] = Array.from({ length: 6 }, () => []);
  for (const p of all) fretsByString[p.string].push(p.fret);
  for (const frets of fretsByString) frets.sort((a, b) => a - b);

  // Anchor a position at each low-E scale tone in the first octave, but collapse
  // half-step-adjacent anchors: scale degrees a fret apart (e.g. the E/F and B/C
  // pairs in a major scale) would spawn boxes shifted by a single fret that read
  // as the same position. Keep the lower of each such pair. Pentatonic tones are
  // never a half step apart, so its positions are unaffected.
  const rawAnchors = [...new Set(fretsByString[LOW_E_STRING])]
    .filter((fret) => fret < 12)
    .sort((a, b) => a - b);
  const anchors: number[] = [];
  for (const fret of rawAnchors) {
    const prev = anchors[anchors.length - 1];
    if (prev === undefined || fret - prev > 1) anchors.push(fret);
  }

  interface Candidate {
    startFret: number;
    endFret: number;
    positions: FretPosition[];
    cells: Set<string>;
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const anchor of anchors) {
    const boxNotes: Omit<FretPosition, 'finger'>[] = [];
    const windowTop = Math.min(anchor + REACH, FRET_COUNT);

    for (let string = LOW_E_STRING; string >= HIGH_E_STRING; string--) {
      const onString = fretsByString[string].filter(
        (fret) => fret >= anchor && fret <= windowTop,
      );
      for (const fret of onString)
        boxNotes.push({ string, fret, note: getNoteAt(string, fret) });
    }

    if (boxNotes.length === 0) continue;

    const cells = new Set(boxNotes.map((p) => `${p.string}:${p.fret}`));
    const key = [...cells].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const startFret = Math.min(...boxNotes.map((p) => p.fret));
    const endFret = Math.max(...boxNotes.map((p) => p.fret));
    const positions: FretPosition[] = boxNotes.map((p) => ({
      ...p,
      finger: p.fret === 0 ? 0 : Math.min(4, p.fret - startFret + 1),
    }));

    candidates.push({ startFret, endFret, positions, cells });
  }

  // Drop redundant positions whose notes are fully contained in another box.
  // (Anchoring at every low-E scale tone yields half-step-adjacent anchors whose
  // boxes converge; the smaller one adds nothing.)
  const isSubset = (a: Set<string>, b: Set<string>) => {
    if (a.size >= b.size) return false;
    for (const cell of a) if (!b.has(cell)) return false;
    return true;
  };
  const distinct = candidates.filter(
    (c) => !candidates.some((other) => isSubset(c.cells, other.cells)),
  );

  return distinct.map((c, index) => ({
    number: index + 1,
    startFret: c.startFret,
    endFret: c.endFret,
    positions: c.positions,
    mutedStrings: [],
  }));
}

type StringOffset = number | 'x';

interface ChordShape {
  /** Offsets per string index 0 (high e) … 5 (low E); 'x' = muted. */
  offsets: StringOffset[];
  /** Fretting finger per string (1–4, 0 = open/none), parallel to offsets. */
  fingers: number[];
  /** Which string carries the root (used to anchor the shape up the neck). */
  rootStringIndex: number;
}

/**
 * Movable voicings per quality. Each is anchored to its root string; placed at
 * every root location up the neck. Offsets may be negative for close voicings
 * (low positions that fall below fret 0 are skipped). At base 0 the major/minor
 * E/A shapes reduce to the open E/A/Em/Am chords.
 */
const CHORD_SHAPES: Record<ChordQuality, ChordShape[]> = {
  major: [
    { offsets: [0, 0, 1, 2, 2, 0], fingers: [1, 1, 2, 4, 3, 1], rootStringIndex: 5 },
    { offsets: [0, 2, 2, 2, 0, 'x'], fingers: [1, 4, 3, 2, 1, 0], rootStringIndex: 4 },
  ],
  minor: [
    { offsets: [0, 0, 0, 2, 2, 0], fingers: [1, 1, 1, 4, 3, 1], rootStringIndex: 5 },
    { offsets: [0, 1, 2, 2, 0, 'x'], fingers: [1, 2, 4, 3, 1, 0], rootStringIndex: 4 },
  ],
  dom7: [
    { offsets: [0, 0, 1, 0, 2, 0], fingers: [1, 1, 2, 1, 3, 1], rootStringIndex: 5 },
    { offsets: [0, 2, 0, 2, 0, 'x'], fingers: [1, 3, 1, 2, 1, 0], rootStringIndex: 4 },
  ],
  maj7: [
    { offsets: [0, 0, 1, 1, 2, 0], fingers: [1, 1, 2, 3, 4, 1], rootStringIndex: 5 },
    { offsets: [0, 2, 1, 2, 0, 'x'], fingers: [1, 4, 2, 3, 1, 0], rootStringIndex: 4 },
  ],
  min7: [
    { offsets: [0, 0, 0, 0, 2, 0], fingers: [1, 1, 1, 1, 3, 1], rootStringIndex: 5 },
    { offsets: [0, 1, 0, 2, 0, 'x'], fingers: [1, 2, 1, 3, 1, 0], rootStringIndex: 4 },
  ],
  m7b5: [
    { offsets: ['x', 1, 0, 1, 0, 'x'], fingers: [0, 3, 1, 2, 1, 0], rootStringIndex: 4 },
  ],
  dim7: [
    { offsets: [2, 1, 'x', 1, 0, 'x'], fingers: [4, 3, 0, 2, 1, 0], rootStringIndex: 4 },
  ],
  dim: [
    { offsets: ['x', 1, 'x', 1, 0, 'x'], fingers: [0, 3, 0, 2, 1, 0], rootStringIndex: 4 },
  ],
  aug: [
    { offsets: ['x', 1, 1, 2, 'x', 0], fingers: [0, 3, 2, 4, 0, 1], rootStringIndex: 5 },
  ],
  sus2: [
    { offsets: [0, 0, 2, 2, 0, 'x'], fingers: [1, 1, 3, 2, 1, 0], rootStringIndex: 4 },
  ],
  sus4: [
    { offsets: [0, 0, 2, 2, 2, 0], fingers: [1, 1, 4, 3, 2, 1], rootStringIndex: 5 },
    { offsets: [0, 3, 2, 2, 0, 'x'], fingers: [1, 4, 3, 2, 1, 0], rootStringIndex: 4 },
  ],
  // 6th and extended chords: canonical movable voicings (with the usual tone
  // omissions). Offsets may be negative; low positions below the nut are skipped.
  maj6: [
    { offsets: [2, 2, 2, 2, 0, 'x'], fingers: [3, 3, 3, 3, 1, 0], rootStringIndex: 4 },
  ],
  min6: [
    { offsets: [2, 1, 2, 2, 0, 'x'], fingers: [4, 2, 3, 3, 1, 0], rootStringIndex: 4 },
  ],
  dom9: [
    { offsets: [0, 0, 0, -1, 0, 'x'], fingers: [3, 3, 3, 1, 2, 0], rootStringIndex: 4 },
  ],
  maj9: [
    { offsets: ['x', 0, 1, -1, 0, 'x'], fingers: [0, 3, 4, 1, 2, 0], rootStringIndex: 4 },
  ],
  min9: [
    { offsets: ['x', 0, 0, -2, 0, 'x'], fingers: [0, 3, 4, 1, 2, 0], rootStringIndex: 4 },
  ],
  dom11: [
    { offsets: [0, 0, 0, 0, 0, 'x'], fingers: [1, 1, 1, 1, 1, 0], rootStringIndex: 4 },
  ],
  min11: [
    { offsets: [0, 0, 0, 0, 0, 0], fingers: [1, 1, 1, 1, 1, 1], rootStringIndex: 5 },
  ],
  dom13: [
    { offsets: [2, 0, 0, -1, 0, 'x'], fingers: [4, 3, 3, 1, 2, 0], rootStringIndex: 4 },
  ],
  maj13: [
    { offsets: [2, 0, 1, -1, 0, 'x'], fingers: [4, 2, 3, 1, 2, 0], rootStringIndex: 4 },
  ],
  min13: [
    { offsets: [2, 0, 0, -2, 0, 'x'], fingers: [4, 3, 3, 1, 2, 0], rootStringIndex: 4 },
  ],
};

/**
 * Standard open-position voicings (absolute frets, index 0 high e … 5 low E;
 * 'x' = muted) for qualities/roots where a common open chord exists.
 */
interface OpenChord {
  frets: (number | 'x')[];
  fingers: number[];
}

const OPEN_CHORDS: Partial<
  Record<ChordQuality, Partial<Record<NoteName, OpenChord>>>
> = {
  major: {
    C: { frets: [0, 1, 0, 2, 3, 'x'], fingers: [0, 1, 0, 2, 3, 0] },
    A: { frets: [0, 2, 2, 2, 0, 'x'], fingers: [0, 3, 2, 1, 0, 0] },
    G: { frets: [3, 0, 0, 0, 2, 3], fingers: [3, 0, 0, 0, 1, 2] },
    E: { frets: [0, 0, 1, 2, 2, 0], fingers: [0, 0, 1, 3, 2, 0] },
    D: { frets: [2, 3, 2, 0, 'x', 'x'], fingers: [2, 3, 1, 0, 0, 0] },
  },
  minor: {
    A: { frets: [0, 1, 2, 2, 0, 'x'], fingers: [0, 1, 3, 2, 0, 0] },
    E: { frets: [0, 0, 0, 2, 2, 0], fingers: [0, 0, 0, 3, 2, 0] },
    D: { frets: [1, 3, 2, 0, 'x', 'x'], fingers: [1, 3, 2, 0, 0, 0] },
  },
  dom7: {
    C: { frets: [0, 1, 3, 2, 3, 'x'], fingers: [0, 1, 3, 2, 4, 0] },
    A: { frets: [0, 2, 0, 2, 0, 'x'], fingers: [0, 3, 0, 2, 0, 0] },
    G: { frets: [1, 0, 0, 0, 2, 3], fingers: [1, 0, 0, 0, 2, 3] },
    E: { frets: [0, 0, 1, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
    D: { frets: [2, 1, 2, 0, 'x', 'x'], fingers: [3, 1, 2, 0, 0, 0] },
  },
  maj7: {
    C: { frets: [0, 0, 0, 2, 3, 'x'], fingers: [0, 0, 0, 2, 3, 0] },
    A: { frets: [0, 2, 1, 2, 0, 'x'], fingers: [0, 3, 1, 2, 0, 0] },
    G: { frets: [2, 0, 0, 0, 2, 3], fingers: [3, 0, 0, 0, 1, 2] },
    E: { frets: [0, 0, 1, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    D: { frets: [2, 2, 2, 0, 'x', 'x'], fingers: [3, 2, 1, 0, 0, 0] },
  },
  min7: {
    A: { frets: [0, 1, 0, 2, 0, 'x'], fingers: [0, 1, 0, 2, 0, 0] },
    E: { frets: [0, 0, 0, 0, 2, 0], fingers: [0, 0, 0, 0, 2, 0] },
    D: { frets: [1, 1, 2, 0, 'x', 'x'], fingers: [1, 1, 3, 0, 0, 0] },
  },
};

function buildOpenPlacement(chord: OpenChord): Omit<Position, 'number'> {
  const sounded: FretPosition[] = [];
  const mutedStrings: number[] = [];
  let maxFret = 0;

  for (let stringIndex = 0; stringIndex < chord.frets.length; stringIndex++) {
    const fret = chord.frets[stringIndex];
    if (fret === 'x') {
      mutedStrings.push(stringIndex);
      continue;
    }
    sounded.push({
      string: stringIndex,
      fret,
      note: getNoteAt(stringIndex, fret),
      finger: chord.fingers[stringIndex],
    });
    maxFret = Math.max(maxFret, fret);
  }

  return { startFret: 0, endFret: maxFret, positions: sounded, mutedStrings };
}

export function buildChordPositions(
  root: NoteName,
  quality: ChordQuality,
): Position[] {
  const rootPitch = noteToSemitone(root);
  const placements: Omit<Position, 'number'>[] = [];

  const openVoicing = OPEN_CHORDS[quality]?.[root];
  if (openVoicing) {
    placements.push(buildOpenPlacement(openVoicing));
  }

  for (const shape of CHORD_SHAPES[quality]) {
    const openPitch = OPEN_STRING_SEMITONES[shape.rootStringIndex];
    const firstFret = ((rootPitch - openPitch) % 12 + 12) % 12;

    for (let base = firstFret; base <= FRET_COUNT; base += 12) {
      const sounded: FretPosition[] = [];
      const mutedStrings: number[] = [];
      let valid = true;
      let minFret = Number.POSITIVE_INFINITY;
      let maxFret = 0;
      let hasOpenVoicingClash = false;

      for (let stringIndex = 0; stringIndex < shape.offsets.length; stringIndex++) {
        const offset = shape.offsets[stringIndex];
        if (offset === 'x') {
          mutedStrings.push(stringIndex);
          continue;
        }
        const fret = base + offset;
        if (fret < 0 || fret > FRET_COUNT) {
          valid = false;
          break;
        }
        sounded.push({
          string: stringIndex,
          fret,
          note: getNoteAt(stringIndex, fret),
          finger: shape.fingers[stringIndex],
        });
        if (fret > 0) {
          minFret = Math.min(minFret, fret);
          maxFret = Math.max(maxFret, fret);
        }
      }

      if (!valid) continue;

      // Skip a movable shape at base 0 when an open voicing already covers it.
      if (base === 0 && openVoicing) hasOpenVoicingClash = true;
      if (hasOpenVoicingClash) continue;

      placements.push({
        startFret: Number.isFinite(minFret) ? minFret : 0,
        endFret: maxFret,
        positions: sounded,
        mutedStrings,
      });
    }
  }

  placements.sort((a, b) => a.startFret - b.startFret || a.endFret - b.endFret);

  return placements.map((placement, index) => ({
    ...placement,
    number: index + 1,
  }));
}
