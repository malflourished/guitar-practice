import { useEffect, useMemo } from 'react';
import { DEFAULT_TEMPO } from '../lib/audio/tempo';
import type { ScaleDirection, ScaleOrdering } from '../lib/audio/pitch';
import {
  arpeggioNotes,
  orderScaleRun,
  type PlayMode,
} from '../lib/audio/playOptions';
import { buildTraversalRun, joinTraversals } from '../lib/audio/traversal';
import {
  getChordIntervals,
  getImpliedChordQuality,
  getProgressionLibraryEntry,
  getProgressionStepPositionScope,
  progressionFeel,
  noteToSemitone,
  type ProgressionLadderDirection,
} from '../lib/music';
import type { StudyMode } from '../types/music';
import { useJamLoop } from '../modes/progressions/useJamLoop';
import type { ProgressionViews } from '../modes/progressions/useProgressionViews';
import type { ProgressionsState } from '../modes/progressions/useProgressionsState';
import type { ScalesState } from '../modes/scales/useScalesState';
import type { TheoryState } from '../modes/theory/useTheoryState';
import type { BoardData } from './useBoardData';
import type { UseInstrument } from './useInstrument';
import type { KeyState } from './useKeyState';
import type { NeckPosition } from './useNeckPosition';
import { usePlayOptions } from './usePlayOptions';
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
 * Tempo and every way the neck plays: strum or arpeggiate a chord, run a
 * scale (in a box or across the neck), play a progression or climb it up the
 * neck. One `togglePlay` starts what the Play menu says and stops anything
 * playing. Returns the props `PlayControl` takes, and the tempo Settings edits.
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
  const { rootNote } = keyState;
  const { scaleQuality, scaleSystem, scaleAnchor, setScaleAnchor } = scales;
  const {
    progressionId,
    progressionStepIndex,
    resolvedProgressionSteps,
    setProgressionStepIndex,
    setLadderAnchor,
  } = progressions;
  const { theoryShowFretboard, theoryScaleQuality } = theory;
  const { displayRegions, positionByScope, setPositionIndex } = neck;
  const { positions } = board;
  const [tempo, setTempo] = usePersistentState(
    'tempo',
    DEFAULT_TEMPO,
    isNumber,
  );
  const { displayProgressionChordViews } = progressionViews;

  const effectiveScalePlayback =
    studyMode === 'scales' ||
    (studyMode === 'theory' && theoryShowFretboard);
  const playMode: PlayMode =
    studyMode === 'progressions'
      ? 'progressions'
      : studyMode === 'chords'
        ? 'chords'
        : effectiveScalePlayback
          ? 'scales'
          : 'notes';
  const { options: playOptions, setOptions: setPlayOptions } = usePlayOptions({
    id: progressionId,
    feel: progressionFeel(getProgressionLibraryEntry(progressionId)),
  });
  const jam = useJamLoop({
    audio,
    steps: resolvedProgressionSteps,
    chordPositions: displayProgressionChordViews.map((chord) => chord.positions),
    backing: playOptions.backing,
    feel: playOptions.feel,
    click: playOptions.click,
    loop: playOptions.jamLoop,
    tempo,
    progressionId,
    stepIndex: progressionStepIndex,
    setStepIndex: setProgressionStepIndex,
  });
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

  // Single-string demos build one region, so they're excluded automatically.
  const canCrossNeck = effectiveScalePlayback && displayRegions.length > 1;

  const traversalActive = audio.playingId?.startsWith('traverse-') ?? false;

  const playScale = () => {
    const context = { ordering: scaleOrdering, anchorPc: playbackAnchorPc };
    if (playOptions.reach === 'neck' && canCrossNeck) {
      const runFor = (direction: ScaleDirection) =>
        buildTraversalRun(displayRegions, rootNote, direction, scaleOrdering, playbackAnchorPc);
      const up = runFor('ascending');
      const down = runFor('descending');
      const run =
        playOptions.direction === 'up'
          ? up
          : playOptions.direction === 'down'
            ? down
            : joinTraversals(up, down);
      let lastRegion = -1;
      audio.playSequence(
        run.positions,
        tempo,
        `traverse-${playOptions.direction}`,
        (noteIndex) => {
          const regionIndex = run.regionForNote[noteIndex];
          if (regionIndex !== lastRegion) {
            lastRegion = regionIndex;
            setPositionIndex(regionIndex);
          }
        },
        playOptions.loop,
      );
      return;
    }
    audio.playSequence(
      orderScaleRun(positions, rootNote, playOptions.direction, context),
      tempo,
      `run-${playOptions.direction}`,
      undefined,
      playOptions.loop,
    );
  };

  const playChord = () => {
    if (playOptions.articulation === 'arpeggio') {
      audio.playSequence(
        arpeggioNotes(positions, playOptions.direction),
        tempo,
        'arpeggio',
        undefined,
        playOptions.loop,
      );
    } else if (playOptions.loop) {
      audio.playProgression([positions], tempo, 'chord-loop', undefined, true);
    } else {
      audio.strum(positions);
    }
  };

  const playProgression = () => {
    const ladder = playOptions.ladder;
    audio.stopAll();
    let id = 'jam';
    if (ladder === 'off') {
      setLadderAnchor(null);
    } else {
      const step0 = resolvedProgressionSteps[0];
      if (!step0) return;
      const direction: ProgressionLadderDirection =
        ladder === 'up' ? 'ascending' : 'descending';
      const step0Scope = getProgressionStepPositionScope(
        progressionId,
        0,
        step0.quality,
      );
      id = `jam-${direction}`;
      setLadderAnchor(positionByScope[step0Scope] ?? 0);
    }
    jam.start(id);
  };

  /** Play when stopped, Stop while anything plays. */
  const togglePlay = () => {
    if (audio.playingId !== null) {
      audio.stopAll();
      return;
    }
    if (playMode === 'progressions') playProgression();
    else if (playMode === 'chords') playChord();
    else playScale();
  };

  const stopPlayback = audio.stopAll;
  useEffect(() => {
    if (studyMode !== 'practice') stopPlayback();
  }, [studyMode, progressionId, rootNote, stopPlayback]);

  const canPlay =
    studyMode === 'progressions'
      ? displayProgressionChordViews.some((chord) => chord.positions.length > 0)
      : positions.length > 0;
  const playProps = {
    mode: playMode,
    playing: audio.playingId !== null,
    loading: audio.loading,
    disabled: !canPlay || audio.muted,
    disabledReason: audio.muted
      ? 'Sound is muted (Settings)'
      : 'Nothing to play here',
    tempo,
    options: playOptions,
    onOptionsChange: setPlayOptions,
    scaleAnchor,
    onScaleAnchorChange: setScaleAnchor,
    canCrossNeck,
    onToggle: togglePlay,
  };

  return { playProps, togglePlay, traversalActive, tempo, setTempo, jam: jam.state };
}
