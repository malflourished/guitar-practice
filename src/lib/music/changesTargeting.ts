import type {
  ChordQuality,
  FretPosition,
  KeyMode,
  NoteName,
} from '../../types/music';
import { getDiatonicRoot } from './diatonic';
import { getNoteAt } from './fretboard';
import { getIntervalLabel } from './intervals';
import { noteToSemitone, semitoneToNote } from './notes';
import { getShellDef } from './shellVoicings';
import { FRET_COUNT } from './tuning';

interface ChangesStepDef {
  degree: number;
  quality: ChordQuality;
  numeral: string;
}

export interface ChangesProgressionDef {
  id: string;
  label: string;
  keyMode: KeyMode;
  steps: ChangesStepDef[];
}

/**
 * Seventh-chord progressions used for guide-tone (3rd + 7th) targeting — the
 * "headline payoff" of intervallic thinking. Every chord carries a real 3rd and
 * 7th so the two color tones can be tracked as they voice-lead across changes.
 */
export const CHANGES_PROGRESSIONS: ChangesProgressionDef[] = [
  {
    id: 'major-251',
    label: 'ii–V–I (major)',
    keyMode: 'major',
    steps: [
      { degree: 2, quality: 'min7', numeral: 'ii7' },
      { degree: 5, quality: 'dom7', numeral: 'V7' },
      { degree: 1, quality: 'maj7', numeral: 'Imaj7' },
    ],
  },
  {
    id: 'minor-251',
    label: 'ii–V–i (minor)',
    keyMode: 'minor',
    steps: [
      { degree: 2, quality: 'm7b5', numeral: 'iiø7' },
      { degree: 5, quality: 'dom7', numeral: 'V7' },
      { degree: 1, quality: 'min7', numeral: 'i7' },
    ],
  },
  {
    id: 'turnaround-1625',
    label: 'I–vi–ii–V',
    keyMode: 'major',
    steps: [
      { degree: 1, quality: 'maj7', numeral: 'Imaj7' },
      { degree: 6, quality: 'min7', numeral: 'vi7' },
      { degree: 2, quality: 'min7', numeral: 'ii7' },
      { degree: 5, quality: 'dom7', numeral: 'V7' },
    ],
  },
];

export interface ChangesStepView {
  root: NoteName;
  quality: ChordQuality;
  numeral: string;
  /** The 3rd's semitone offset from the chord root (3 or 4). */
  third: number;
  /** The 7th's semitone offset from the chord root (10 or 11). */
  seventh: number;
  thirdNote: NoteName;
  seventhNote: NoteName;
  thirdLabel: string;
  seventhLabel: string;
}

/** Resolve one progression step against a key root into its guide tones. */
export function buildChangesStepView(
  keyRoot: NoteName,
  keyMode: KeyMode,
  step: ChangesStepDef,
): ChangesStepView {
  const root = getDiatonicRoot(keyRoot, keyMode, step.degree);
  const shell = getShellDef(step.quality);
  const rootPc = noteToSemitone(root);
  return {
    root,
    quality: step.quality,
    numeral: step.numeral,
    third: shell.third,
    seventh: shell.seventh,
    thirdNote: semitoneToNote(rootPc + shell.third),
    seventhNote: semitoneToNote(rootPc + shell.seventh),
    thirdLabel: getIntervalLabel(shell.third, 'function'),
    seventhLabel: getIntervalLabel(shell.seventh, 'function'),
  };
}

/** Resolve every step of a changes progression for a key root. */
export function buildChangesProgression(
  keyRoot: NoteName,
  progression: ChangesProgressionDef,
): ChangesStepView[] {
  return progression.steps.map((step) =>
    buildChangesStepView(keyRoot, progression.keyMode, step),
  );
}

/** Look up a changes progression by id. */
export function getChangesProgression(id: string): ChangesProgressionDef {
  return (
    CHANGES_PROGRESSIONS.find((p) => p.id === id) ?? CHANGES_PROGRESSIONS[0]
  );
}

/** The two adjacent strings the guide tones live on: D (3) and G (2). */
const GUIDE_STRINGS = [3, 2] as const;

/** Where one chord's guide tones sit on the neck. */
export interface GuideTonePlacement {
  third: FretPosition;
  /** Null when the chord has no 7th. */
  seventh: FretPosition | null;
}

export interface GuideToneInput {
  thirdNote: NoteName;
  seventhNote?: NoteName | null;
}

function fretsFor(string: number, note: NoteName): number[] {
  const frets: number[] = [];
  for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
    if (noteToSemitone(getNoteAt(string, fret)) === noteToSemitone(note)) {
      frets.push(fret);
    }
  }
  return frets;
}

function candidatePlacements(step: GuideToneInput): GuideTonePlacement[] {
  const pos = (string: number, fret: number): FretPosition => ({
    string,
    fret,
    note: getNoteAt(string, fret),
  });
  const out: GuideTonePlacement[] = [];
  const seventhNote = step.seventhNote ?? null;
  for (const thirdString of GUIDE_STRINGS) {
    const otherString = thirdString === 3 ? 2 : 3;
    for (const thirdFret of fretsFor(thirdString, step.thirdNote)) {
      if (seventhNote === null) {
        out.push({ third: pos(thirdString, thirdFret), seventh: null });
        continue;
      }
      for (const seventhFret of fretsFor(otherString, seventhNote)) {
        out.push({
          third: pos(thirdString, thirdFret),
          seventh: pos(otherString, seventhFret),
        });
      }
    }
  }
  return out;
}

function fretOnString(p: GuideTonePlacement, string: number): number | null {
  if (p.third.string === string) return p.third.fret;
  if (p.seventh?.string === string) return p.seventh.fret;
  return null;
}

/** Total fret movement of a placement from a reference, summed over strings. */
function fretDistance(
  p: GuideTonePlacement,
  reference: (string: number) => number | null,
): number {
  let total = 0;
  for (const string of GUIDE_STRINGS) {
    const fret = fretOnString(p, string);
    const ref = reference(string);
    if (fret !== null && ref !== null) total += Math.abs(fret - ref);
  }
  return total;
}

function placementFretSum(p: GuideTonePlacement): number {
  return p.third.fret + (p.seventh?.fret ?? 0);
}

function pickClosest(
  candidates: GuideTonePlacement[],
  reference: (string: number) => number | null,
): GuideTonePlacement {
  let best = candidates[0];
  let bestCost = fretDistance(best, reference);
  for (const c of candidates.slice(1)) {
    const cost = fretDistance(c, reference);
    if (
      cost < bestCost ||
      (cost === bestCost && placementFretSum(c) < placementFretSum(best))
    ) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * No voice should move further than this between chords. The search relaxes it
 * one fret at a time only when a progression cannot be voiced that tightly: the
 * guide tones E and B of Cmaj7 reach Am7's C and G only by a 3-semitone move.
 */
const MAX_VOICE_MOVE = 2;
const WIDEST_VOICE_MOVE = 12;

function maxVoiceMove(prev: GuideTonePlacement, next: GuideTonePlacement): number {
  let max = 0;
  for (const string of GUIDE_STRINGS) {
    const a = fretOnString(prev, string);
    const b = fretOnString(next, string);
    if (a !== null && b !== null) max = Math.max(max, Math.abs(a - b));
  }
  return max;
}

/** The greedy walk: each chord takes the smallest total movement from the last. */
function greedyPlan(
  candidates: GuideTonePlacement[][],
  firstAnchorFret: number,
): GuideTonePlacement[] {
  const plan: GuideTonePlacement[] = [];
  candidates.forEach((options, index) => {
    const previous = plan[index - 1];
    plan.push(
      pickClosest(
        options,
        previous ? (string) => fretOnString(previous, string) : () => firstAnchorFret,
      ),
    );
  });
  return plan;
}

/**
 * Place every chord's 3rd and 7th on the D and G strings so the guide tones
 * barely move. The first chord sits closest to `firstAnchorFret` (the fret of
 * its root anchor); each later chord takes the placement with the smallest total
 * fret movement from the chord before it.
 *
 * Choosing greedily can strand a later chord (Cmaj7 to Am7 in the I–vi–ii–V
 * turnaround would need a 3-fret move), so the whole progression is searched
 * for the walk in which no voice moves more than two frets (or as few as the
 * progression allows), preferring the first chord nearest its anchor and then
 * the smallest total movement.
 */
export function planGuideTones(
  steps: GuideToneInput[],
  firstAnchorFret: number,
): GuideTonePlacement[] {
  const candidates = steps.map(candidatePlacements);
  if (candidates.length === 0) return [];

  let best: GuideTonePlacement[] | null = null;
  let bestCost: [number, number, number] = [Infinity, Infinity, Infinity];
  let limit = MAX_VOICE_MOVE;
  const path: GuideTonePlacement[] = [];

  const visit = (index: number, total: number) => {
    if (index === candidates.length) {
      const cost: [number, number, number] = [
        fretDistance(path[0], () => firstAnchorFret),
        total,
        path.reduce((sum, p) => sum + placementFretSum(p), 0),
      ];
      if (
        cost[0] < bestCost[0] ||
        (cost[0] === bestCost[0] &&
          (cost[1] < bestCost[1] ||
            (cost[1] === bestCost[1] && cost[2] < bestCost[2])))
      ) {
        best = [...path];
        bestCost = cost;
      }
      return;
    }
    for (const option of candidates[index]) {
      const previous = path[index - 1];
      if (previous && maxVoiceMove(previous, option) > limit) continue;
      path[index] = option;
      visit(
        index + 1,
        total +
          (previous
            ? fretDistance(option, (string) => fretOnString(previous, string))
            : 0),
      );
    }
    path.length = index;
  };
  for (; limit <= WIDEST_VOICE_MOVE && best === null; limit += 1) visit(0, 0);

  return best ?? greedyPlan(candidates, firstAnchorFret);
}

export interface GuideToneMotion {
  /** Smallest semitone move from one of `prev`'s color tones to a `curr` tone. */
  semitones: number;
  fromLabel: string;
  toLabel: string;
  /** True only when the tone stays on the same string and fret. */
  held: boolean;
}

function pitchClassDistance(fromPc: number, toPc: number): number {
  const up = (toPc - fromPc + 12) % 12;
  return Math.min(up, 12 - up);
}

/**
 * The tightest voice-leading move between two chords' guide tones: usually the
 * 7th of one chord falls a semitone to the 3rd of the next (and vice versa).
 * Returns the minimal motion among the four color-tone pairings.
 */
export function getGuideToneMotion(
  prev: ChangesStepView,
  curr: ChangesStepView,
  prevPlacement?: GuideTonePlacement,
  currPlacement?: GuideTonePlacement,
): GuideToneMotion {
  const fromTones = [
    {
      pc: noteToSemitone(prev.thirdNote),
      label: prev.thirdLabel,
      pos: prevPlacement?.third,
    },
    {
      pc: noteToSemitone(prev.seventhNote),
      label: prev.seventhLabel,
      pos: prevPlacement?.seventh ?? undefined,
    },
  ];
  const toTones = [
    {
      pc: noteToSemitone(curr.thirdNote),
      label: curr.thirdLabel,
      pos: currPlacement?.third,
    },
    {
      pc: noteToSemitone(curr.seventhNote),
      label: curr.seventhLabel,
      pos: currPlacement?.seventh ?? undefined,
    },
  ];

  let best: GuideToneMotion | null = null;
  for (const from of fromTones) {
    for (const to of toTones) {
      const semitones = pitchClassDistance(from.pc, to.pc);
      const held =
        semitones === 0 &&
        from.pos !== undefined &&
        to.pos !== undefined &&
        from.pos.string === to.pos.string &&
        from.pos.fret === to.pos.fret;
      if (
        best === null ||
        semitones < best.semitones ||
        (semitones === best.semitones && held && !best.held)
      ) {
        best = { semitones, fromLabel: from.label, toLabel: to.label, held };
      }
    }
  }
  return best ?? { semitones: 0, fromLabel: '3', toLabel: '3', held: false };
}
