import { useMemo } from 'react';
import {
  buildChordPositions,
  buildScalePositions,
  buildSingleStringScale,
  filterToChordTones,
  followProgressionRegions,
  getChordQualityLabel,
  getProgressionStepPositionScope,
  getQualityLabel,
} from '../lib/music';
import type { HarmonyLayer, StudyMode } from '../types/music';
import type { ChordsState } from '../modes/chords/useChordsState';
import type { ProgressionsState } from '../modes/progressions/useProgressionsState';
import type { ScalesState } from '../modes/scales/useScalesState';
import type { TheoryState } from '../modes/theory/useTheoryState';
import type { KeyState } from './useKeyState';
import { useNeckView } from './useNeckView';

interface NeckPositionInput {
  studyMode: StudyMode;
  keyState: KeyState;
  chords: ChordsState;
  scales: ScalesState;
  progressions: ProgressionsState;
  theory: TheoryState;
  harmonyLayer: HarmonyLayer;
}

/**
 * Which position boxes the current mode offers, which one is active, and how
 * wide a span of them the neck shows. Wraps `useNeckView` with the per-mode
 * rules for what the regions are.
 */
export function useNeckPosition({
  studyMode,
  keyState,
  chords,
  scales,
  progressions,
  theory,
  harmonyLayer,
}: NeckPositionInput) {
  const { rootNote } = keyState;
  const { chordQuality } = chords;
  const { scaleQuality, scaleSystem, impliedChordQuality } = scales;
  const {
    progressionId,
    progressionStepIndex,
    resolvedProgressionSteps,
    activeProgressionStep,
    activeChordRoot,
    activeChordQuality,
  } = progressions;
  const {
    theoryTopicId,
    theoryShowFretboard,
    theoryScaleQuality,
    activeTheoryTopic,
  } = theory;

  const qualityKey =
    studyMode === 'scales'
      ? scaleQuality
      : studyMode === 'theory'
        ? `${theoryTopicId}-${theoryScaleQuality}`
      : studyMode === 'progressions'
        ? `${progressionId}-${progressionStepIndex}-${activeChordQuality}`
        : chordQuality;
  const qualityLabel =
    studyMode === 'scales'
      ? getQualityLabel(scaleQuality)
      : studyMode === 'theory'
        ? getQualityLabel(theoryScaleQuality)
      : studyMode === 'progressions'
        ? (activeProgressionStep?.qualityLabel ?? getChordQualityLabel(chordQuality))
        : getChordQualityLabel(chordQuality);

  const supportsSystemToggle =
    (studyMode === 'scales' &&
    (scaleQuality === 'major' || scaleQuality === 'minor')) ||
    (studyMode === 'theory' &&
      theoryShowFretboard &&
      (theoryScaleQuality === 'major' || theoryScaleQuality === 'minor'));

  const positionScope = `${studyMode}-${qualityKey}-${
    supportsSystemToggle ? scaleSystem : 'fixed'
  }`;

  const positionRegions = useMemo(() => {
    if (studyMode === 'chords' || studyMode === 'progressions') {
      return buildChordPositions(activeChordRoot, activeChordQuality);
    }
    if (studyMode === 'scales') {
      return buildScalePositions(rootNote, scaleQuality, scaleSystem);
    }
    if (
      studyMode === 'theory' &&
      theoryShowFretboard &&
      activeTheoryTopic.fretboardDemo
    ) {
      const demo = activeTheoryTopic.fretboardDemo;
      if (demo.singleString) {
        return buildSingleStringScale(rootNote, demo.scaleQuality);
      }
      return buildScalePositions(rootNote, demo.scaleQuality, scaleSystem);
    }
    return [];
  }, [
    studyMode,
    rootNote,
    activeChordRoot,
    activeChordQuality,
    scaleQuality,
    scaleSystem,
    theoryShowFretboard,
    activeTheoryTopic,
  ]);

  // The arpeggio layer reduces every scale box to its chord tones — same
  // regions, same frets, just the arpeggio living inside the shape.
  const displayRegions = useMemo(() => {
    if (studyMode !== 'scales' || harmonyLayer === 'scale') {
      return positionRegions;
    }
    return positionRegions.map((region) => ({
      ...region,
      positions: filterToChordTones(
        region.positions,
        rootNote,
        impliedChordQuality,
      ),
    }));
  }, [studyMode, harmonyLayer, positionRegions, rootNote, impliedChordQuality]);

  const theoryDemoSupportsNeckView =
    studyMode === 'theory' &&
    theoryShowFretboard &&
    activeTheoryTopic.fretboardDemo !== undefined &&
    !activeTheoryTopic.fretboardDemo.singleString;

  const neckViewEnabled =
    studyMode === 'scales' ||
    studyMode === 'chords' ||
    studyMode === 'progressions' ||
    theoryDemoSupportsNeckView;

  const neckView = useNeckView(positionScope, displayRegions, {
    neckViewEnabled,
  });
  const {
    positionIndex,
    setPositionIndex: setSinglePositionIndex,
    setScopePositions,
    activeRegion: activePositionRegion,
    positionByScope,
  } = neckView;

  // In Progressions the position bar (and its span) moves every chord, not just
  // the selected one: each chord takes the shape nearest the chosen frets.
  const followProgressionPosition = (primary: number, spanEnd: number) => {
    const a = displayRegions[primary];
    const b = displayRegions[spanEnd];
    if (!a || !b) return;
    const primaryTarget = { startFret: a.startFret, endFret: a.endFret };
    const spanTarget = { startFret: b.startFret, endFret: b.endFret };
    const primaries = followProgressionRegions(resolvedProgressionSteps, primaryTarget);
    const ends = followProgressionRegions(resolvedProgressionSteps, spanTarget);
    setScopePositions(
      resolvedProgressionSteps.map((step, index) => ({
        scope: getProgressionStepPositionScope(progressionId, index, step.quality),
        position: index === progressionStepIndex ? primary : primaries[index],
        spanEnd: index === progressionStepIndex ? spanEnd : ends[index],
      })),
    );
  };

  const setPositionIndex = (index: number) => {
    if (studyMode !== 'progressions') {
      setSinglePositionIndex(index);
      return;
    }
    const collapsed = neckView.spanEndIndex === positionIndex;
    followProgressionPosition(index, collapsed ? index : neckView.spanEndIndex);
  };
  const setSpanEndIndex = (index: number) => {
    if (studyMode !== 'progressions') {
      neckView.setSpanEndIndex(index);
      return;
    }
    followProgressionPosition(positionIndex, index);
  };

  return {
    qualityLabel,
    supportsSystemToggle,
    positionRegions,
    displayRegions,
    neckViewEnabled,
    neckView,
    positionIndex,
    activePositionRegion,
    positionByScope,
    setPositionIndex,
    setSpanEndIndex,
  };
}

export type NeckPosition = ReturnType<typeof useNeckPosition>;
