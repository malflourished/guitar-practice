import type {
  ChordQuality,
  FretPosition,
  NoteName,
  ScaleQuality,
  ScaleSystem,
} from '../../types/music';
import { getNoteAt } from './fretboard';
import { noteToSemitone } from './notes';
import { MINOR_PENT_SHAPES } from './scaleBoxTemplates';
import { MINOR_PENTATONIC, getScaleIntervals, isPentatonic } from './scales';
import { FRET_COUNT, OPEN_STRING_MIDI, OPEN_STRING_SEMITONES, midiAt } from './tuning';

export interface Position {
  /** 1-based position number for the slider. */
  number: number;
  startFret: number;
  endFret: number;
  /** Notes to render for this position. */
  positions: FretPosition[];
  /** String indices (0 = high e … 5 = low E) that are not played. */
  mutedStrings: number[];
  /** CAGED (or voicing) shape name, e.g. "G shape" / "Open C shape", when known. */
  shapeLabel?: string;
  /** A short form of the label for the letters under the neck ("1st" for "1st inversion"). */
  badge?: string;
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
 * CAGED chord-shape letters by pentatonic ordinal of the box anchor.
 *
 * Minor-rooted scales read their boxes against minor barre forms: the root box
 * (ord 0) is the Em-form barre, so A minor at fret 5 is the "E shape".
 * Major-rooted scales share the same physical boxes via the relative-minor
 * frame, shifting the letters by one: C major across frets 5–8 is the
 * "G shape" of the C chord.
 */
const MINOR_FRAME_CAGED = ['E', 'D', 'C', 'A', 'G'] as const;
const MAJOR_FRAME_CAGED = ['G', 'E', 'D', 'C', 'A'] as const;

function cagedLetterForOrdinal(
  quality: ScaleQuality,
  ordinal: number,
): string | undefined {
  if (
    quality === 'minorPentatonic' ||
    quality === 'minorBlues' ||
    quality === 'minor'
  ) {
    return MINOR_FRAME_CAGED[ordinal];
  }
  if (
    quality === 'majorPentatonic' ||
    quality === 'majorBlues' ||
    quality === 'major'
  ) {
    return MAJOR_FRAME_CAGED[ordinal];
  }
  return undefined;
}

/**
 * A diatonic box must hold every scale note between its lowest and highest
 * notes, or a run up the box skips a step. In every key one passing tone falls
 * just outside the pentatonic frame of two boxes: the 7th in the major G shape
 * (C major's B, on the G string at fret 4) and the 4th in the major A shape
 * (its F, on the B string at fret 6). The relative minor's E and G shapes are
 * the same boxes, missing its 2nd and ♭6. Each missing note goes at most one
 * fret outside the frame, on the string where it sits closest to that string's
 * own notes, which is where the standard CAGED fingerings put it.
 */
function fillScaleGaps(
  notes: Omit<FretPosition, 'finger'>[],
  scalePcs: Set<number>,
  lo: number,
  hi: number,
  add: (string: number, fret: number) => void,
) {
  const pitches = new Set(notes.map((n) => midiAt(n.string, n.fret)));
  const low = Math.min(...pitches);
  const high = Math.max(...pitches);
  for (let midi = low + 1; midi < high; midi++) {
    if (!scalePcs.has(midi % 12) || pitches.has(midi)) continue;
    let best: { string: number; fret: number; stretch: number } | null = null;
    for (let string = HIGH_E_STRING; string <= LOW_E_STRING; string++) {
      const fret = midi - OPEN_STRING_MIDI[string];
      if (fret < Math.max(0, lo - 1) || fret > Math.min(FRET_COUNT, hi + 1)) continue;
      const own = notes.filter((n) => n.string === string).map((n) => n.fret);
      if (own.length === 0) continue;
      const stretch = Math.min(...own.map((f) => Math.abs(f - fret)));
      if (!best || stretch < best.stretch) best = { string, fret, stretch };
    }
    if (best) {
      add(best.string, best.fret);
      pitches.add(midi);
    }
  }
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
      if (quality === 'major' || quality === 'minor') {
        const scalePcs = new Set([...MINOR_PENTATONIC.map((i) => (framePc + i) % 12), ...extras]);
        fillScaleGaps(notes, scalePcs, lo, hi, add);
      }
    }

    const letter = cagedLetterForOrdinal(quality, ord);
    boxes.push({
      ...finalizeBox(notes),
      shapeLabel: letter ? `${letter} shape` : undefined,
    });
  }

  boxes.sort((a, b) => a.startFret - b.startFret);
  return boxes.map((box, index) => ({ ...box, number: index + 1 }));
}

type StringOffset = number | 'x';

interface ChordShape {
  /** Offsets per string index 0 (high e) … 5 (low E); 'x' = muted. */
  offsets: StringOffset[];
  /** Fretting finger per string (1–4, 0 = open/none), parallel to offsets. */
  fingers: number[];
  /** Which string carries the root (used to anchor the shape up the neck). */
  rootStringIndex: number;
  /** CAGED form name when the voicing derives from an open shape. */
  label?: string;
}

/**
 * Movable voicings per quality. Each is anchored to its root string; placed at
 * every root location up the neck. Offsets may be negative for close voicings
 * (low positions that fall below fret 0 are skipped). At base 0 the major/minor
 * E/A shapes reduce to the open E/A/Em/Am chords.
 *
 * The five main qualities carry the CAGED shapes in the forms guitarists play:
 * - E and A are the full barre chords.
 * - C is the open C chord moved up: five strings for major and maj7, four
 *   (no high e) for minor and dom7, and the top four strings for min7, where
 *   the full form cannot be fingered.
 * - G is the top four strings for major, dom7 and maj7 (the full six-string
 *   form is a stretch nobody strums), the low four for minor (the top four of
 *   a G-shape minor hold no third). There is no practical G-shape min7.
 * - D is the open D chord moved up, on the top four strings.
 * The anchor string of a G or C shape may itself be muted: it only places the
 * shape. Every shape spans at most four frets.
 */
const CHORD_SHAPES: Record<ChordQuality, ChordShape[]> = {
  major: [
    { offsets: [0, 0, 1, 2, 2, 0], fingers: [1, 1, 2, 4, 3, 1], rootStringIndex: 5, label: 'E shape' },
    { offsets: [0, 2, 2, 2, 0, 'x'], fingers: [1, 4, 3, 2, 1, 0], rootStringIndex: 4, label: 'A shape' },
    { offsets: [-3, -2, -3, -1, 0, 'x'], fingers: [1, 2, 1, 3, 4, 0], rootStringIndex: 4, label: 'C shape' },
    { offsets: [0, -3, -3, -3, 'x', 'x'], fingers: [4, 1, 1, 1, 0, 0], rootStringIndex: 5, label: 'G shape' },
    { offsets: [2, 3, 2, 0, 'x', 'x'], fingers: [3, 4, 2, 1, 0, 0], rootStringIndex: 3, label: 'D shape' },
  ],
  minor: [
    { offsets: [0, 0, 0, 2, 2, 0], fingers: [1, 1, 1, 4, 3, 1], rootStringIndex: 5, label: 'E shape' },
    { offsets: [0, 1, 2, 2, 0, 'x'], fingers: [1, 2, 4, 3, 1, 0], rootStringIndex: 4, label: 'A shape' },
    { offsets: ['x', -2, -3, -2, 0, 'x'], fingers: [0, 3, 1, 2, 4, 0], rootStringIndex: 4, label: 'C shape' },
    { offsets: ['x', 'x', -3, -3, -2, 0], fingers: [0, 0, 1, 1, 2, 4], rootStringIndex: 5, label: 'G shape' },
    { offsets: [1, 3, 2, 0, 'x', 'x'], fingers: [2, 4, 3, 1, 0, 0], rootStringIndex: 3, label: 'D shape' },
  ],
  dom7: [
    { offsets: [0, 0, 1, 0, 2, 0], fingers: [1, 1, 2, 1, 3, 1], rootStringIndex: 5, label: 'E shape' },
    { offsets: [0, 2, 0, 2, 0, 'x'], fingers: [1, 3, 1, 2, 1, 0], rootStringIndex: 4, label: 'A shape' },
    { offsets: ['x', -2, 0, -1, 0, 'x'], fingers: [0, 1, 4, 2, 3, 0], rootStringIndex: 4, label: 'C shape' },
    { offsets: [-2, -3, -3, -3, 'x', 'x'], fingers: [2, 1, 1, 1, 0, 0], rootStringIndex: 5, label: 'G shape' },
    { offsets: [2, 1, 2, 0, 'x', 'x'], fingers: [4, 2, 3, 1, 0, 0], rootStringIndex: 3, label: 'D shape' },
  ],
  maj7: [
    { offsets: [0, 0, 1, 1, 2, 0], fingers: [1, 1, 2, 3, 4, 1], rootStringIndex: 5, label: 'E shape' },
    { offsets: [0, 2, 1, 2, 0, 'x'], fingers: [1, 4, 2, 3, 1, 0], rootStringIndex: 4, label: 'A shape' },
    { offsets: [-3, -3, -3, -1, 0, 'x'], fingers: [1, 1, 1, 3, 4, 0], rootStringIndex: 4, label: 'C shape' },
    { offsets: [-1, -3, -3, -3, 'x', 'x'], fingers: [3, 1, 1, 1, 0, 0], rootStringIndex: 5, label: 'G shape' },
    { offsets: [2, 2, 2, 0, 'x', 'x'], fingers: [3, 3, 3, 1, 0, 0], rootStringIndex: 3, label: 'D shape' },
  ],
  min7: [
    { offsets: [0, 0, 0, 0, 2, 0], fingers: [1, 1, 1, 1, 3, 1], rootStringIndex: 5, label: 'E shape' },
    { offsets: [0, 1, 0, 2, 0, 'x'], fingers: [1, 2, 1, 3, 1, 0], rootStringIndex: 4, label: 'A shape' },
    { offsets: [0, -2, 0, -2, 'x', 'x'], fingers: [4, 1, 3, 1, 0, 0], rootStringIndex: 4, label: 'C shape' },
    { offsets: [1, 1, 2, 0, 'x', 'x'], fingers: [2, 2, 3, 1, 0, 0], rootStringIndex: 3, label: 'D shape' },
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
    { offsets: [0, 0, 2, 2, 2, 0], fingers: [1, 1, 4, 3, 2, 1], rootStringIndex: 5, label: 'E shape' },
    { offsets: [0, 3, 2, 2, 0, 'x'], fingers: [1, 4, 3, 2, 1, 0], rootStringIndex: 4, label: 'A shape' },
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
  // Root, 7th, 3rd and 13th from the low E string: the 13th chords as they
  // are played (C maj13 is 8-x-9-9-10-x, C min13 is 8-x-8-8-10-x). The
  // five-string forms these replace needed five fingers or a five-fret reach.
  maj13: [
    { offsets: ['x', 2, 1, 1, 'x', 0], fingers: [0, 4, 3, 2, 0, 1], rootStringIndex: 5 },
  ],
  min13: [
    { offsets: ['x', 2, 0, 0, 'x', 0], fingers: [0, 4, 1, 1, 0, 1], rootStringIndex: 5 },
  ],
};

/**
 * Standard open-position voicings (absolute frets, index 0 high e … 5 low E;
 * 'x' = muted) for qualities/roots where a common open chord exists. Each is
 * the CAGED shape of its own letter at the nut, so it is labelled with it
 * ("Open C shape") and stands in for that movable shape there.
 */
interface OpenChord {
  frets: (number | 'x')[];
  fingers: number[];
  /** Only offered with the full CAGED set: it replaces a C or G shape at the nut. */
  cagedOnly?: boolean;
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
    C: { frets: ['x', 1, 0, 1, 3, 'x'], fingers: [0, 2, 0, 1, 3, 0], cagedOnly: true },
    A: { frets: [0, 1, 2, 2, 0, 'x'], fingers: [0, 1, 3, 2, 0, 0] },
    G: { frets: [3, 3, 0, 0, 1, 3], fingers: [4, 3, 0, 0, 1, 2], cagedOnly: true },
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
    G: { frets: [2, 0, 0, 0, 2, 3], fingers: [2, 0, 0, 0, 1, 3] },
    E: { frets: [0, 0, 1, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    D: { frets: [2, 2, 2, 0, 'x', 'x'], fingers: [3, 2, 1, 0, 0, 0] },
  },
  min7: {
    A: { frets: [0, 1, 0, 2, 0, 'x'], fingers: [0, 1, 0, 2, 0, 0] },
    E: { frets: [0, 0, 0, 0, 2, 0], fingers: [0, 0, 0, 0, 2, 0] },
    D: { frets: [1, 1, 2, 0, 'x', 'x'], fingers: [1, 1, 3, 0, 0, 0] },
  },
};

/**
 * The fret where each CAGED shape is its open chord: a C shape rooted at the
 * A string's 3rd fret is open C, a G shape rooted at the low E's 3rd is open G.
 */
const SHAPE_HOME_BASE: Record<string, number> = {
  'C shape': 3,
  'A shape': 0,
  'G shape': 3,
  'E shape': 0,
  'D shape': 0,
};

/**
 * Fingers for a movable shape that has landed on open strings (B minor 7 as
 * x20202): the open strings take no finger, and the fretted notes are fingered
 * afresh, lowest fret first and from the low strings up, one finger each and
 * never fewer than one finger per fret.
 */
function refingerAroundOpenStrings(sounded: FretPosition[]): FretPosition[] {
  const fretted = sounded
    .filter((p) => p.fret > 0)
    .sort((a, b) => a.fret - b.fret || b.string - a.string);
  if (fretted.length === sounded.length) return sounded;
  const lowest = fretted[0]?.fret ?? 0;
  const fingers = new Map<FretPosition, number>();
  let previous = 0;
  for (const p of fretted) {
    previous = Math.min(4, Math.max(previous + 1, p.fret - lowest + 1));
    fingers.set(p, previous);
  }
  return sounded.map((p) => ({ ...p, finger: fingers.get(p) ?? 0 }));
}

function buildOpenPlacement(chord: OpenChord, root: NoteName): Omit<Position, 'number'> {
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

  return {
    startFret: 0,
    endFret: maxFret,
    positions: sounded,
    mutedStrings,
    shapeLabel: `Open ${root} shape`,
    badge: root,
  };
}

/**
 * Which movable shapes a chord is offered in.
 * - `caged`: all five CAGED shapes (Chords mode).
 * - `barre`: the E and A shapes and the open chords only. Progressions builds
 *   its regions along the neck from these, and its climb is specified on them
 *   (docs/specs/P3-climb.md), so it stays on this set until that spec moves.
 */
export type ChordShapeSet = 'caged' | 'barre';

const BARRE_SHAPES = new Set(['E shape', 'A shape']);

export function buildChordPositions(
  root: NoteName,
  quality: ChordQuality,
  shapeSet: ChordShapeSet = 'barre',
): Position[] {
  const rootPitch = noteToSemitone(root);
  const placements: Omit<Position, 'number'>[] = [];

  const open = OPEN_CHORDS[quality]?.[root];
  const openVoicing = open && (shapeSet === 'caged' || !open.cagedOnly) ? open : undefined;
  if (openVoicing) {
    placements.push(buildOpenPlacement(openVoicing, root));
  }

  for (const shape of CHORD_SHAPES[quality]) {
    if (shapeSet === 'barre' && shape.label && !BARRE_SHAPES.has(shape.label)) continue;
    const openPitch = OPEN_STRING_SEMITONES[shape.rootStringIndex];
    const firstFret = ((rootPitch - openPitch) % 12 + 12) % 12;

    for (let base = firstFret; base <= FRET_COUNT; base += 12) {
      const sounded: FretPosition[] = [];
      const mutedStrings: number[] = [];
      let valid = true;
      let minFret = Number.POSITIVE_INFINITY;
      let maxFret = 0;

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

      // Skip a movable shape where the open voicing already covers it: at the
      // nut, or where a C or G shape is its own open chord.
      const home = shape.label ? SHAPE_HOME_BASE[shape.label] : 0;
      if (openVoicing && (base === 0 || base === home)) continue;

      placements.push({
        startFret: Number.isFinite(minFret) ? minFret : 0,
        endFret: maxFret,
        positions: refingerAroundOpenStrings(sounded),
        mutedStrings,
        shapeLabel: shape.label,
      });
    }
  }

  placements.sort((a, b) => a.startFret - b.startFret || a.endFret - b.endFret);

  return placements.map((placement, index) => ({
    ...placement,
    number: index + 1,
  }));
}

/**
 * Walk a scale along the low E string only, root to octave. Makes the
 * whole-/half-step construction of a scale literally visible as fret gaps —
 * used by the theory "Half & Whole Steps" demo.
 */
export function buildSingleStringScale(
  root: NoteName,
  quality: ScaleQuality,
): Position[] {
  const rootPc = noteToSemitone(root);
  const rootFret = (((rootPc - LOW_E_OPEN_PC) % 12) + 12) % 12;
  const intervals = [...getScaleIntervals(quality), 12];

  const positions: FretPosition[] = intervals.map((interval) => {
    const fret = rootFret + interval;
    return { string: LOW_E_STRING, fret, note: getNoteAt(LOW_E_STRING, fret) };
  });

  return [
    {
      number: 1,
      startFret: rootFret,
      endFret: rootFret + 12,
      positions,
      mutedStrings: [],
    },
  ];
}
