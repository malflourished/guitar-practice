import { useEffect, useMemo } from 'react';
import { DEFAULT_TEMPO, type PlaybackMode } from '../components/AudioControls';
import {
  orderScalePositions,
  type ScaleDirection,
  type ScaleOrdering,
} from '../lib/audio/pitch';
import { buildTraversalRun } from '../lib/audio/traversal';
import {
  buildLadderProgressionChordViews,
  getChordIntervals,
  getImpliedChordQuality,
  getProgressionStepPositionScope,
  noteToSemitone,
  type ProgressionLadderDirection,
} from '../lib/music';
import type { StudyMode } from '../types/music';
import type { ProgressionViews } from '../modes/progressions/useProgressionViews';
import type { ProgressionsState } from '../modes/progressions/useProgressionsState';
import type { ScalesState } from '../modes/scales/useScalesState';
import type { TheoryState } from '../modes/theory/useTheoryState';
import type { BoardData } from './useBoardData';
import type { UseInstrument } from './useInstrument';
import type { KeyState } from './useKeyState';
import type { NeckPosition } from './useNeckPosition';
import { isNumber, usePersistentState } from './usePersistentState';

interface PlaybackInput {
  studyMode: StudyMode;
  audio: UseInstrument;
  keyState: KeyState;
  scales: ScalesState;
  progressions: ProgressionsState;
  theory: TheoryState;
  neck: NeckPosition;
  board: BoardData;
  progressionViews: ProgressionViews;
}

/**
 * Tempo and every way the neck plays: strum a chord, run a scale, walk the
 * boxes across the neck, play a progression or its ladder. Returns the props
 * the transport and sound controls take.
 */
export function usePlayback({
  studyMode,
  audio,
  keyState,
  scales,
  progressions,
  theory,
  neck,
  board,
  progressionViews,
}: PlaybackInput) {
  const { rootNote, notation } = keyState;
  const { scaleQuality, scaleSystem, scaleAnchor, setScaleAnchor } = scales;
  const {
    progressionId,
    resolvedProgressionSteps,
    setProgressionStepIndex,
    setLadderAnchor,
  } = progressions;
  const { theoryShowFretboard, theoryScaleQuality } = theory;
  const { displayRegions, positionByScope, setPositionIndex } = neck;
  const { positions } = board;
  const { savedProgressionChordViews, displayProgressionChordViews } =
    progressionViews;

  const [tempo, setTempo] = usePersistentState(
    'tempo',
    DEFAULT_TEMPO,
    isNumber,
  );
  const playbackMode: PlaybackMode =
    studyMode === 'progressions'
      ? 'progression'
      : studyMode === 'chords'
        ? 'strum'
        : 'sequence';
  const effectiveScalePlayback =
    studyMode === 'scales' ||
    (studyMode === 'theory' && theoryShowFretboard);
  const scaleOrdering: ScaleOrdering =
    effectiveScalePlayback && scaleSystem === '3nps' ? 'builtIn' : 'pitch';

  // Pitch class the scale run starts on: the root, or the 3rd/5th of the
  // chord implied by the current scale (so minor scales anchor on the b3).
  const playbackAnchorPc = useMemo(() => {
    const rootPc = noteToSemitone(rootNote);
    if (!effectiveScalePlayback || scaleAnchor === 'root') return rootPc;
    const intervals = getChordIntervals(
      getImpliedChordQuality(
        studyMode === 'theory' ? theoryScaleQuality : scaleQuality,
      ),
    );
    const offset =
      scaleAnchor === 'third'
        ? intervals.find((interval) => interval === 3 || interval === 4)
        : intervals.find((interval) => interval >= 6 && interval <= 8);
    return (rootPc + (offset ?? 0)) % 12;
  }, [
    rootNote,
    effectiveScalePlayback,
    scaleAnchor,
    studyMode,
    theoryScaleQuality,
    scaleQuality,
  ]);

  const handleStrum = () => audio.strum(positions);
  const handlePlayScale = (direction: ScaleDirection) => {
    if (audio.playingId === direction) {
      audio.stopAll();
      return;
    }
    audio.playSequence(
      orderScalePositions(positions, rootNote, direction, {
        ordering: scaleOrdering,
        anchorPc: playbackAnchorPc,
      }),
      tempo,
      direction,
    );
  };

  // Single-string demos build one region, so they're excluded automatically.
  const canTraverse = effectiveScalePlayback && displayRegions.length > 1;

  const traversalActive =
    audio.playingId === 'traverse-ascending' ||
    audio.playingId === 'traverse-descending';

  const handlePlayTraversal = (direction: ScaleDirection) => {
    const playingId = `traverse-${direction}`;
    if (audio.playingId === playingId) {
      audio.stopAll();
      return;
    }
    const run = buildTraversalRun(
      displayRegions,
      rootNote,
      direction,
      scaleOrdering,
      playbackAnchorPc,
    );
    let lastRegion = -1;
    audio.playSequence(run.positions, tempo, playingId, (noteIndex) => {
      const regionIndex = run.regionForNote[noteIndex];
      if (regionIndex !== lastRegion) {
        lastRegion = regionIndex;
        setPositionIndex(regionIndex);
      }
    });
  };
  const handlePlayProgression = () => {
    if (audio.playingId === 'progression') {
      audio.stopAll();
      return;
    }
    audio.stopAll();
    setLadderAnchor(null);
    audio.playProgression(
      savedProgressionChordViews.map((chord) => chord.positions),
      tempo,
      'progression',
      setProgressionStepIndex,
    );
  };

  const handlePlayProgressionLadder = (direction: ProgressionLadderDirection) => {
    const playingId =
      direction === 'ascending' ? 'progression-ascending' : 'progression-descending';
    if (audio.playingId === playingId) {
      audio.stopAll();
      return;
    }

    const step0 = resolvedProgressionSteps[0];
    if (!step0) return;

    audio.stopAll();
    const step0Scope = getProgressionStepPositionScope(
      progressionId,
      0,
      step0.quality,
    );
    const anchor = positionByScope[step0Scope] ?? 0;
    const ladderViews = buildLadderProgressionChordViews(
      resolvedProgressionSteps,
      anchor,
      direction,
      notation,
    );

    setLadderAnchor(anchor);
    setProgressionStepIndex(0);
    audio.playProgression(
      ladderViews.map((chord) => chord.positions),
      tempo,
      playingId,
      setProgressionStepIndex,
    );
  };

  const stopPlayback = audio.stopAll;
  useEffect(() => {
    if (studyMode !== 'practice') stopPlayback();
  }, [studyMode, progressionId, rootNote, stopPlayback]);

  const audioProps = {
    instrument: audio.instrument,
    volume: audio.volume,
    muted: audio.muted,
    loading: audio.loading,
    canPlay:
      studyMode === 'progressions'
        ? displayProgressionChordViews.some((chord) => chord.positions.length > 0)
        : positions.length > 0,
    playbackMode,
    playingId: audio.playingId,
    tempo,
    canTraverse,
    scaleAnchor: effectiveScalePlayback ? scaleAnchor : undefined,
    onScaleAnchorChange: effectiveScalePlayback ? setScaleAnchor : undefined,
    onInstrumentChange: audio.setInstrument,
    onVolumeChange: audio.setVolume,
    onMutedToggle: () => audio.setMuted(!audio.muted),
    onTempoChange: setTempo,
    onStrum: handleStrum,
    onPlayScale: handlePlayScale,
    onPlayTraversal: handlePlayTraversal,
    onPlayProgression: handlePlayProgression,
    onPlayProgressionLadder: handlePlayProgressionLadder,
  };

  return { audioProps, traversalActive };
}
