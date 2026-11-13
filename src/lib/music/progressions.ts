import type {
  ChordQuality,
  KeyMode,
  NoteName,
  ProgressionDef,
  ProgressionStepDef,
  StudyMode,
} from '../../types/music';
import { getDiatonicRoot } from './diatonic';
import { getChordQualityLabel } from './chords';
import {
  formatChordRoot,
  getKeySpellingMap,
  spellOffsetFromKey,
} from './noteSpelling';
import {
  noteToSemitone,
  semitoneToNote,
  type NotationPreference,
} from './notes';
import { PROGRESSION_LIBRARY, entryToProgressionDef } from './progressionLibrary';

const CHORD_SUFFIX: Partial<Record<ChordQuality, string>> = {
  major: '',
  minor: 'm',
  dim: 'dim',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  m7b5: 'm7♭5',
};

export interface ResolvedProgressionStep {
  root: NoteName;
  quality: ChordQuality;
  numeral: string;
  chordName: string;
  qualityLabel: string;
}

/** Every progression the app plays: the library, in its groups. */
export const PROGRESSIONS: ProgressionDef[] =
  PROGRESSION_LIBRARY.map(entryToProgressionDef);

export const PROGRESSION_GROUPS = [
  ...new Set(PROGRESSIONS.map((p) => p.category)),
].map((category) => ({
  label: category,
  progressions: PROGRESSIONS.filter((p) => p.category === category),
}));

export function getProgressionById(id: string): ProgressionDef | undefined {
  return PROGRESSIONS.find((p) => p.id === id);
}

/** Position-slider scope for one chord within a progression. */
export function getProgressionStepPositionScope(
  progressionId: string,
  stepIndex: number,
  quality: ChordQuality,
): string {
  const qualityKey = `${progressionId}-${stepIndex}-${quality}`;
  const studyMode: StudyMode = 'progressions';
  return `${studyMode}-${qualityKey}-fixed`;
}

export function formatChordName(
  root: NoteName,
  quality: ChordQuality,
  notation: NotationPreference,
  /** Key-aware root spelling; defaults to the spelling the chord reads best in. */
  rootSpelling?: string,
): string {
  const rootLabel = rootSpelling ?? formatChordRoot(root, quality, notation);
  const suffix = CHORD_SUFFIX[quality];
  if (suffix !== undefined) {
    return `${rootLabel}${suffix}`;
  }
  return `${rootLabel} (${getChordQualityLabel(quality)})`;
}

export function resolveProgressionStep(
  keyRoot: NoteName,
  keyMode: KeyMode,
  step: ProgressionStepDef,
  notation: NotationPreference,
): ResolvedProgressionStep {
  const chromatic = step.offset !== undefined;
  const root = chromatic
    ? semitoneToNote(noteToSemitone(keyRoot) + step.offset!)
    : getDiatonicRoot(keyRoot, keyMode, step.degree);
  const rootSpelling = chromatic
    ? spellOffsetFromKey(keyRoot, keyMode, step.offset!, notation)
    : getKeySpellingMap(keyRoot, keyMode, notation).get(root);
  const bassSpelling =
    step.bass !== undefined
      ? spellOffsetFromKey(keyRoot, keyMode, step.bass, notation)
      : undefined;
  const chord = formatChordName(root, step.quality, notation, rootSpelling);
  return {
    root,
    quality: step.quality,
    numeral: step.numeral,
    chordName: bassSpelling ? `${chord}/${bassSpelling}` : chord,
    qualityLabel: getChordQualityLabel(step.quality),
  };
}

export function resolveProgression(
  keyRoot: NoteName,
  progression: ProgressionDef,
  notation: NotationPreference,
): ResolvedProgressionStep[] {
  return progression.steps.map((step) =>
    resolveProgressionStep(keyRoot, progression.keyMode, step, notation),
  );
}

export function formatProgressionChords(
  resolved: ResolvedProgressionStep[],
): string {
  return resolved.map((step) => step.chordName).join(' – ');
}
