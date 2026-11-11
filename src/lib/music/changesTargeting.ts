import type { ChordQuality, KeyMode, NoteName } from '../../types/music';
import { getDiatonicRoot } from './diatonic';
import { getIntervalLabel } from './intervals';
import { noteToSemitone, semitoneToNote } from './notes';
import { getShellDef } from './shellVoicings';

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

export interface GuideToneMotion {
  /** Smallest semitone move from one of `prev`'s color tones to a `curr` tone. */
  semitones: number;
  fromLabel: string;
  toLabel: string;
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
): GuideToneMotion {
  const fromTones = [
    { pc: noteToSemitone(prev.thirdNote), label: prev.thirdLabel },
    { pc: noteToSemitone(prev.seventhNote), label: prev.seventhLabel },
  ];
  const toTones = [
    { pc: noteToSemitone(curr.thirdNote), label: curr.thirdLabel },
    { pc: noteToSemitone(curr.seventhNote), label: curr.seventhLabel },
  ];

  let best: GuideToneMotion | null = null;
  for (const from of fromTones) {
    for (const to of toTones) {
      const semitones = pitchClassDistance(from.pc, to.pc);
      if (best === null || semitones < best.semitones) {
        best = { semitones, fromLabel: from.label, toLabel: to.label };
      }
    }
  }
  return best ?? { semitones: 0, fromLabel: '3', toLabel: '3' };
}
