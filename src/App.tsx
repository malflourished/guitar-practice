import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Fretboard } from './components/Fretboard';
import { PositionSlider } from './components/PositionSlider';
import { AudioControls, DEFAULT_TEMPO } from './components/AudioControls';
import { DebugPanel } from './components/DebugPanel';
import { AmbientBackground } from './components/AmbientBackground';
import { KeySelector } from './components/KeySelector';
import { KeyContext } from './components/KeyContext';
import { useInstrument } from './hooks/useInstrument';
import { useUiTheme } from './hooks/useUiTheme';
import { useNeckView } from './hooks/useNeckView';
import { oneOf, usePersistentState } from './hooks/usePersistentState';
import { UiThemeSelector } from './components/UiThemeSelector';
import {
  orderScalePositions,
  type ScaleAnchor,
  type ScaleDirection,
  type ScaleOrdering,
} from './lib/audio/pitch';
import { buildTraversalRun } from './lib/audio/traversal';
import { ALL_NOTES, NOTE_COLORS } from './lib/colors';
import {
  getFretboardSubtitle,
  getFretboardTitle,
  getRootNote,
} from './lib/displayTitle';
import {
  getBackgroundKeyForMode,
  getKeyBackgroundStyle,
  type KeyBackgroundStyle,
} from './lib/keyPalette';
import { getAmbientShape } from './lib/ambientShapes';
import {
  buildChordPositionViews,
  buildChordPositions,
  buildLadderProgressionChordViews,
  buildScalePositions,
  buildSavedProgressionChordViews,
  buildSingleStringScale,
  buildSpellingMap,
  filterToChordTones,
  getChordIntervals,
  getChordQualityLabel,
  getImpliedChordQuality,
  getPositionsForNotes,
  getQualityLabel,
  getProgressionById,
  getProgressionStepPositionScope,
  getSpelledChordNotes,
  getSpelledScaleNotes,
  noteToSemitone,
  CHORD_QUALITIES,
  PROGRESSIONS,
  SCALE_QUALITIES,
  resolveProgression,
  spelledRootFromNoteName,
  DEFAULT_THEORY_TOPIC_ID,
  THEORY_TOPICS,
  getTheoryTopicById,
  type NotationPreference,
  type ProgressionLadderDirection,
} from './lib/music';
import type {
  ChordQuality,
  HarmonyLayer,
  KeyMode,
  NoteName,
  ScaleQuality,
  ScaleSystem,
  StudyMode,
} from './types/music';
import {
  StudyModeControls,
  StudyModeSelector,
} from './components/StudyModeControls';
import {
  SettingsList,
  SettingsSection,
  SettingsRow,
} from './components/SettingsList';
import { ChordPositionStrip } from './components/ChordPositionStrip';
import { ProgressionStrip } from './components/ProgressionStrip';
import { TheoryPanel } from './components/TheoryPanel';
import { TheoryNavigator } from './components/TheoryNavigator';
import { TheoryStage } from './components/TheoryStage';
import { APP_NAME } from './lib/brand';
import glass from './styles/glass.module.css';
import { useColorBoundary } from './hooks/useColorBoundary';
import { useDebugSettings } from './hooks/useDebugSettings';
import './App.css';

/** Vibrato dark canvas: shell uses dark type over these vivid keys (Db = C#). */
const SHELL_DARK_TEXT_KEYS = new Set<NoteName>(['C', 'C#']);

function isSingleRootMode(mode: StudyMode): boolean {
  return (
    mode === 'chords' ||
    mode === 'scales' ||
    mode === 'progressions' ||
    mode === 'theory'
  );
}

const STUDY_MODES = [
  'notes',
  'chords',
  'scales',
  'progressions',
  'theory',
] as const;

/** Scales whose tonal center reads as minor (for key-context derivation). */
const MINOR_FAMILY_SCALES = new Set<ScaleQuality>([
  'minor',
  'minorPentatonic',
  'minorBlues',
  'dorian',
  'phrygian',
  'locrian',
  'harmonicMinor',
  'melodicMinor',
]);

/** Relative-key counterpart for scale qualities that have one. */
const RELATIVE_SCALE_QUALITY: Partial<Record<ScaleQuality, ScaleQuality>> = {
  major: 'minor',
  minor: 'major',
  majorPentatonic: 'minorPentatonic',
  minorPentatonic: 'majorPentatonic',
  majorBlues: 'minorBlues',
  minorBlues: 'majorBlues',
};

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isNoteArray = (value: unknown): value is NoteName[] =>
  Array.isArray(value) &&
  value.every(
    (note) => typeof note === 'string' && (ALL_NOTES as string[]).includes(note),
  );

function toSingleRoot(notes: Set<NoteName>): Set<NoteName> {
  const selected = ALL_NOTES.filter((note) => notes.has(note));
  return new Set(selected.length > 0 ? [selected[0]] : ['C']);
}

const COLOR_STORAGE_KEY = 'guitar-fretboard-note-colors';

function loadNoteColors(): Record<NoteName, string> {
  try {
    const raw = localStorage.getItem(COLOR_STORAGE_KEY);
    if (raw) {
      return { ...NOTE_COLORS, ...(JSON.parse(raw) as Record<NoteName, string>) };
    }
  } catch {
    // ignore malformed storage
  }
  return { ...NOTE_COLORS };
}

function App() {
  const fretboardAnchorRef = useRef<HTMLDivElement>(null);
  const colorBoundary = useColorBoundary(fretboardAnchorRef);
  const [activeNoteList, setActiveNoteList] = usePersistentState<NoteName[]>(
    'active-notes',
    ['C'],
    isNoteArray,
  );
  const activeNotes = useMemo(() => new Set(activeNoteList), [activeNoteList]);
  const setActiveNotes = (
    updater: Set<NoteName> | ((prev: Set<NoteName>) => Set<NoteName>),
  ) => {
    setActiveNoteList((prevList) => {
      const next =
        typeof updater === 'function' ? updater(new Set(prevList)) : updater;
      return ALL_NOTES.filter((note) => next.has(note));
    });
  };
  const [notation, setNotation] = usePersistentState<NotationPreference>(
    'notation',
    'sharps',
    oneOf(['sharps', 'flats'] as const),
  );
  const [studyMode, setStudyMode] = usePersistentState<StudyMode>(
    'study-mode',
    'notes',
    oneOf(STUDY_MODES),
  );
  const [scaleQuality, setScaleQuality] = usePersistentState<ScaleQuality>(
    'scale-quality',
    'minorPentatonic',
    oneOf(SCALE_QUALITIES),
  );
  const [chordQuality, setChordQuality] = usePersistentState<ChordQuality>(
    'chord-quality',
    'major',
    oneOf(CHORD_QUALITIES),
  );
  const [progressionId, setProgressionId] = usePersistentState(
    'progression-id',
    PROGRESSIONS[0].id,
    oneOf(PROGRESSIONS.map((progression) => progression.id)),
  );
  const [progressionStepIndex, setProgressionStepIndex] = useState(0);
  const [scaleSystem, setScaleSystem] = usePersistentState<ScaleSystem>(
    'scale-system',
    'caged',
    oneOf(['caged', '3nps'] as const),
  );
  const [theoryTopicId, setTheoryTopicId] = usePersistentState(
    'theory-topic',
    DEFAULT_THEORY_TOPIC_ID,
    oneOf(THEORY_TOPICS.map((topic) => topic.id)),
  );
  const [keyMode, setKeyMode] = usePersistentState<KeyMode>(
    'key-mode',
    'major',
    oneOf(['major', 'minor'] as const),
  );
  // The key center is the app's tonal home. It only moves on explicit key
  // changes (Key row, theory wheel, relative-key link) — never while browsing
  // chords inside the key — so the ambient background stays put.
  const [keyCenter, setKeyCenter] = usePersistentState<NoteName>(
    'key-center',
    'C',
    oneOf(ALL_NOTES),
  );
  const [scaleAnchor, setScaleAnchor] = usePersistentState<ScaleAnchor>(
    'scale-anchor',
    'root',
    oneOf(['root', 'third', 'fifth'] as const),
  );
  const [harmonyLayer, setHarmonyLayer] = usePersistentState<HarmonyLayer>(
    'harmony-layer',
    'scale',
    oneOf(['scale', 'arpeggio'] as const),
  );
  const [theoryShowFretboard, setTheoryShowFretboard] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showFingers, setShowFingers] = usePersistentState(
    'show-fingers',
    false,
    isBoolean,
  );
  const [showNoteLabels, setShowNoteLabels] = usePersistentState(
    'show-note-labels',
    true,
    isBoolean,
  );
  const [fullDotOpacity, setFullDotOpacity] = usePersistentState(
    'full-dot-opacity',
    false,
    isBoolean,
  );
  const [showChordTones, setShowChordTones] = usePersistentState(
    'show-chord-tones',
    false,
    isBoolean,
  );
  const [noteColors, setNoteColors] = useState<Record<NoteName, string>>(
    loadNoteColors,
  );

  const debug = useDebugSettings();
  const { uiTheme, vibratoCanvas, selectUiTheme } = useUiTheme();

  useEffect(() => {
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(noteColors));
    } catch {
      // ignore storage write failures
    }
  }, [noteColors]);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  const rootNote = useMemo(() => getRootNote(activeNotes), [activeNotes]);

  // One-time alignment: older sessions persisted a root but no key center.
  useEffect(() => {
    if (isSingleRootMode(studyMode) && rootNote !== keyCenter) {
      setKeyCenter(rootNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const activeTheoryTopic = useMemo(
    () => getTheoryTopicById(theoryTopicId) ?? getTheoryTopicById(DEFAULT_THEORY_TOPIC_ID)!,
    [theoryTopicId],
  );

  const theoryScaleQuality = activeTheoryTopic.fretboardDemo?.scaleQuality ?? 'major';

  const activeProgression = useMemo(
    () => getProgressionById(progressionId) ?? PROGRESSIONS[0],
    [progressionId],
  );

  const resolvedProgressionSteps = useMemo(
    () => resolveProgression(rootNote, activeProgression, notation),
    [rootNote, activeProgression, notation],
  );

  const [ladderAnchor, setLadderAnchor] = useState<number | null>(null);

  const activeProgressionStep =
    resolvedProgressionSteps[
      Math.min(progressionStepIndex, resolvedProgressionSteps.length - 1)
    ];

  const activeChordRoot =
    studyMode === 'progressions'
      ? (activeProgressionStep?.root ?? rootNote)
      : rootNote;

  const activeChordQuality =
    studyMode === 'progressions'
      ? (activeProgressionStep?.quality ?? chordQuality)
      : chordQuality;

  const highlightRoot =
    studyMode === 'progressions' ? activeChordRoot : rootNote;

  const impliedChordQuality = getImpliedChordQuality(scaleQuality);

  const highlightChordQuality =
    studyMode === 'progressions'
      ? activeChordQuality
      : studyMode === 'scales'
        ? impliedChordQuality
        : chordQuality;

  const supportsChordTones =
    studyMode === 'chords' ||
    studyMode === 'scales' ||
    studyMode === 'progressions';

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
    theoryDemoSupportsNeckView;

  const neckView = useNeckView(positionScope, displayRegions, {
    neckViewEnabled,
  });
  const {
    positionIndex,
    setPositionIndex,
    activeRegion: activePositionRegion,
    positionByScope,
  } = neckView;

  const savedProgressionChordViews = useMemo(() => {
    if (studyMode !== 'progressions') return [];
    return buildSavedProgressionChordViews(
      resolvedProgressionSteps,
      progressionId,
      positionByScope,
      notation,
    );
  }, [
    studyMode,
    resolvedProgressionSteps,
    notation,
    progressionId,
    positionByScope,
  ]);

  const audio = useInstrument();

  const ladderDirection: ProgressionLadderDirection | null =
    audio.playingId === 'progression-ascending'
      ? 'ascending'
      : audio.playingId === 'progression-descending'
        ? 'descending'
        : null;

  const ladderActive = ladderDirection !== null && ladderAnchor !== null;

  const chordPositionViews = useMemo(() => {
    if (studyMode !== 'chords') return [];
    return buildChordPositionViews(rootNote, chordQuality, notation);
  }, [studyMode, rootNote, chordQuality, notation]);

  const displayProgressionChordViews = useMemo(() => {
    if (studyMode !== 'progressions') return [];
    if (ladderActive && ladderDirection && ladderAnchor !== null) {
      return buildLadderProgressionChordViews(
        resolvedProgressionSteps,
        ladderAnchor,
        ladderDirection,
        notation,
      );
    }
    return savedProgressionChordViews;
  }, [
    studyMode,
    ladderActive,
    ladderDirection,
    ladderAnchor,
    resolvedProgressionSteps,
    notation,
    savedProgressionChordViews,
  ]);

  const activeDisplayChord =
    displayProgressionChordViews[
      Math.min(progressionStepIndex, displayProgressionChordViews.length - 1)
    ];

  const ladderPositionRegion = useMemo(() => {
    if (!ladderActive || !activeDisplayChord) return undefined;
    return {
      number: activeDisplayChord.positionNumber,
      startFret: activeDisplayChord.startFret,
      endFret: activeDisplayChord.endFret,
      positions: activeDisplayChord.positions,
      mutedStrings: activeDisplayChord.mutedStrings,
    };
  }, [ladderActive, activeDisplayChord]);

  const positions = useMemo(() => {
    if (studyMode === 'notes') {
      return getPositionsForNotes(activeNotes);
    }
    if (studyMode === 'theory' && !theoryShowFretboard) {
      return [];
    }
    if (studyMode === 'progressions' && ladderActive && activeDisplayChord) {
      return activeDisplayChord.positions;
    }
    return activePositionRegion ? activePositionRegion.positions : [];
  }, [
    activeNotes,
    studyMode,
    theoryShowFretboard,
    ladderActive,
    activeDisplayChord,
    activePositionRegion,
  ]);

  const mutedStrings = useMemo(() => {
    if (studyMode === 'progressions' && ladderActive && activeDisplayChord) {
      return activeDisplayChord.mutedStrings;
    }
    return activePositionRegion?.mutedStrings ?? [];
  }, [studyMode, ladderActive, activeDisplayChord, activePositionRegion]);
  const [tempo, setTempo] = usePersistentState(
    'tempo',
    DEFAULT_TEMPO,
    isNumber,
  );
  const playbackMode =
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

  useEffect(() => {
    if (
      audio.playingId !== 'progression-ascending' &&
      audio.playingId !== 'progression-descending'
    ) {
      setLadderAnchor(null);
    }
  }, [audio.playingId]);

  useEffect(() => {
    audio.stopAll();
    setLadderAnchor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop playback on progression context change only
  }, [studyMode, progressionId, rootNote, audio.stopAll]);

  const spellingMap = useMemo(() => {
    if (studyMode === 'notes' || (studyMode === 'theory' && !theoryShowFretboard)) {
      return null;
    }
    if (studyMode === 'progressions' && ladderActive && activeDisplayChord) {
      return activeDisplayChord.noteLabels;
    }
    const spellingRoot =
      studyMode === 'progressions' ? activeChordRoot : rootNote;
    const spelledRoot = spelledRootFromNoteName(spellingRoot, notation);
    const spelled =
      studyMode === 'scales' || studyMode === 'theory'
        ? getSpelledScaleNotes(
            spelledRoot,
            studyMode === 'theory' ? theoryScaleQuality : scaleQuality,
          )
        : getSpelledChordNotes(
            spelledRoot,
            studyMode === 'progressions'
              ? activeChordQuality
              : chordQuality,
          );
    return buildSpellingMap(spelled);
  }, [
    studyMode,
    rootNote,
    activeChordRoot,
    scaleQuality,
    theoryScaleQuality,
    theoryShowFretboard,
    chordQuality,
    activeChordQuality,
    notation,
    ladderActive,
    activeDisplayChord,
  ]);

  const title = useMemo(
    () => {
      if (studyMode === 'theory' && !theoryShowFretboard) {
        return activeTheoryTopic.title;
      }
      if (studyMode === 'theory' && theoryShowFretboard) {
        return getFretboardTitle(
          activeNotes,
          'scales',
          qualityLabel,
          notation,
          activePositionRegion,
        );
      }
      return getFretboardTitle(
        activeNotes,
        studyMode,
        qualityLabel,
        notation,
        ladderActive ? ladderPositionRegion : activePositionRegion,
        studyMode === 'progressions' && activeProgressionStep
          ? {
              progressionId,
              stepIndex: progressionStepIndex,
              chordName: activeProgressionStep.chordName,
              numeral: activeProgressionStep.numeral,
            }
          : undefined,
      );
    },
    [
      activeNotes,
      studyMode,
      qualityLabel,
      notation,
      ladderActive,
      ladderPositionRegion,
      activePositionRegion,
      progressionId,
      progressionStepIndex,
      activeProgressionStep,
      theoryShowFretboard,
      activeTheoryTopic,
    ],
  );

  const subtitle = useMemo(() => {
    const base = getFretboardSubtitle(
      studyMode,
      studyMode === 'progressions'
        ? activeProgression.theory
        : studyMode === 'theory'
          ? activeTheoryTopic.theory
          : null,
    );
    if (ladderActive && ladderDirection) {
      const hint =
        ladderDirection === 'ascending'
          ? "Ladder playback climbs the neck from the I chord's position."
          : 'Ladder playback starts at the highest position and works down from the I chord.';
      return `${base} ${hint}`;
    }
    return base;
  }, [studyMode, activeProgression, activeTheoryTopic, ladderActive, ladderDirection]);

  const currentStepRole = useMemo(() => {
    if (studyMode !== 'progressions' || !activeProgressionStep) return undefined;
    return activeProgression.theory.functions?.find(
      (fn) => fn.numeral === activeProgressionStep.numeral,
    )?.role;
  }, [studyMode, activeProgression, activeProgressionStep]);

  // The mode the current key reads as — drives the key-context panel and the
  // ambient background tint.
  const effectiveKeyMode: KeyMode =
    studyMode === 'scales'
      ? MINOR_FAMILY_SCALES.has(scaleQuality)
        ? 'minor'
        : 'major'
      : studyMode === 'progressions'
        ? activeProgression.keyMode
        : keyMode;

  // The ambient background tracks only the top-level key (center + mode), so
  // stepping through chords, positions, or progression steps never recolors it.
  const backgroundKey = useMemo(
    () => getBackgroundKeyForMode(studyMode, activeNotes, keyCenter),
    [studyMode, activeNotes, keyCenter],
  );

  const ambientShape = useMemo(
    () => getAmbientShape(backgroundKey),
    [backgroundKey],
  );

  const ambientStyle = useMemo(
    () =>
      getKeyBackgroundStyle(
        backgroundKey,
        effectiveKeyMode === 'minor' ? 'minor' : 'major',
        noteColors,
      ),
    [backgroundKey, effectiveKeyMode, noteColors],
  );

  const [committedAmbientStyle, setCommittedAmbientStyle] =
    useState<KeyBackgroundStyle>(ambientStyle);

  const [committedBackgroundKey, setCommittedBackgroundKey] = useState(
    backgroundKey,
  );

  const backgroundKeyRef = useRef(backgroundKey);
  backgroundKeyRef.current = backgroundKey;

  const handleAmbientCommit = (style: CSSProperties) => {
    setCommittedAmbientStyle(style as KeyBackgroundStyle);
    setCommittedBackgroundKey(backgroundKeyRef.current);
  };

  const rootContrastMode =
    uiTheme === 'scholar' || (uiTheme === 'vibrato' && vibratoCanvas === 'light')
      ? 'light'
      : 'dark';

  const shellContrastMode =
    uiTheme === 'vibrato' &&
    vibratoCanvas === 'dark' &&
    committedBackgroundKey !== null &&
    SHELL_DARK_TEXT_KEYS.has(committedBackgroundKey)
      ? 'light'
      : undefined;

  const handleApplyKey = (note: NoteName, action: 'select' | 'deselect' | 'set') => {
    if (action === 'set') {
      setActiveNotes(new Set([note]));
      setKeyCenter(note);
      return;
    }

    setActiveNotes((prev) => {
      const next = new Set(prev);
      if (action === 'select') {
        next.add(note);
      } else {
        next.delete(note);
      }
      return next;
    });
  };

  const handleStudyModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
    if (isSingleRootMode(mode)) {
      if (studyMode === 'chords' && mode !== 'chords' && rootNote !== keyCenter) {
        // Browsing a diatonic chord borrowed the root; coming out of Chords
        // returns home to the key center.
        setActiveNotes(new Set([keyCenter]));
      } else {
        const next = toSingleRoot(activeNotes);
        setActiveNotes(next);
        const nextRoot = ALL_NOTES.find((note) => next.has(note));
        if (nextRoot && nextRoot !== keyCenter) setKeyCenter(nextRoot);
      }
    }
    if (mode === 'progressions') {
      setProgressionStepIndex(0);
    }
    if (mode !== 'theory') {
      setTheoryShowFretboard(false);
    }
  };

  const handleTheoryTopicChange = (topicId: string) => {
    setTheoryTopicId(topicId);
    setTheoryShowFretboard(false);
  };

  const handleTheoryKeySelect = (note: NoteName, mode: KeyMode) => {
    setActiveNotes(new Set([note]));
    setKeyCenter(note);
    setKeyMode(mode);
  };

  const handleTheoryShowFretboard = (show: boolean) => {
    setTheoryShowFretboard(show);
    const demoView = activeTheoryTopic.fretboardDemo?.neckView;
    if (show && demoView) {
      neckView.setViewMode(demoView);
    }
  };

  const handleTheoryPracticeLink = () => {
    const link = activeTheoryTopic.practiceLink;
    if (!link) return;
    setStudyMode(link.mode);
    if (link.scaleQuality) {
      setScaleQuality(link.scaleQuality);
    }
    if (link.neckView) {
      neckView.setViewMode(link.neckView);
    }
    setTheoryShowFretboard(false);
  };

  // --- Key context (the spine): every mode reachable from the current key ---

  const keyModeLocked =
    studyMode === 'scales' || studyMode === 'progressions';

  const handleContextSelectChord = (
    root: NoteName,
    quality: ChordQuality,
  ) => {
    setStudyMode('chords');
    setActiveNotes(new Set([root]));
    setChordQuality(quality);
    setTheoryShowFretboard(false);
  };

  const handleContextSelectScale = () => {
    setStudyMode('scales');
    setActiveNotes(new Set([keyCenter]));
    if (studyMode !== 'scales') {
      setScaleQuality(effectiveKeyMode === 'minor' ? 'minor' : 'major');
    }
    setTheoryShowFretboard(false);
  };

  const handleContextSelectProgressions = () => {
    setStudyMode('progressions');
    setActiveNotes(new Set([keyCenter]));
    const current = getProgressionById(progressionId);
    if (current?.keyMode !== effectiveKeyMode) {
      const match = PROGRESSIONS.find(
        (progression) => progression.keyMode === effectiveKeyMode,
      );
      if (match) setProgressionId(match.id);
    }
    setProgressionStepIndex(0);
    setTheoryShowFretboard(false);
  };

  const handleContextSelectRelative = (root: NoteName, mode: KeyMode) => {
    setActiveNotes(new Set([root]));
    setKeyCenter(root);
    setKeyMode(mode);
    if (studyMode === 'scales') {
      const counterpart = RELATIVE_SCALE_QUALITY[scaleQuality];
      if (counterpart) setScaleQuality(counterpart);
    }
    if (studyMode === 'progressions') {
      const match = PROGRESSIONS.find(
        (progression) => progression.keyMode === mode,
      );
      if (match) {
        setProgressionId(match.id);
        setProgressionStepIndex(0);
      }
    }
  };

  const handleContextExplainChords = () => {
    setStudyMode('theory');
    setTheoryTopicId('diatonic-chords');
    setTheoryShowFretboard(false);
  };

  const handleProgressionChange = (id: string) => {
    setProgressionId(id);
    setProgressionStepIndex(0);
  };

  const handleSelectAll = () => {
    if (!isSingleRootMode(studyMode)) {
      setActiveNotes(new Set(ALL_NOTES));
    }
  };

  const handleClearAll = () => {
    if (!isSingleRootMode(studyMode)) {
      setActiveNotes(new Set());
    }
  };

  const singleRootMode = isSingleRootMode(studyMode);
  const showPositionSlider =
    singleRootMode &&
    positionRegions.length > 0 &&
    (studyMode !== 'theory' || theoryShowFretboard);
  const showTheoryStage = studyMode === 'theory';
  const showFretboard =
    studyMode !== 'theory' || theoryShowFretboard;

  return (
    <div
      className="themeRoot"
      data-ui-theme={uiTheme}
      data-vibrato-canvas={vibratoCanvas}
      data-contrast={rootContrastMode}
      data-debug-bg={debug.enabled && debug.whiteBackground ? 'white' : undefined}
      data-debug-text={
        debug.enabled ? (debug.whiteText ? 'white' : 'black') : undefined
      }
      style={
        uiTheme === 'vibrato'
          ? (committedAmbientStyle as CSSProperties)
          : undefined
      }
    >
      <AmbientBackground
        style={ambientStyle as CSSProperties}
        colorBoundary={colorBoundary}
        family={ambientShape.family}
        onCommit={handleAmbientCommit}
      />
      <UiThemeSelector
        uiTheme={uiTheme}
        vibratoCanvas={vibratoCanvas}
        onUiThemeChange={selectUiTheme}
      />
      <div className="app" data-focus={focusMode ? 'true' : undefined}>
        <div
          className="shell"
          data-contrast={shellContrastMode}
        >
          <p className="wordmark" aria-label={APP_NAME.slice(0, -1)}>
            {APP_NAME.slice(0, -1)}
            <span className="wordmarkWave">{APP_NAME.at(-1)}</span>
          </p>
          <SettingsList>
            <SettingsSection>
              <SettingsRow label="Mode">
                <StudyModeSelector
                  studyMode={studyMode}
                  onStudyModeChange={handleStudyModeChange}
                />
              </SettingsRow>

              <SettingsRow label="Key">
                <KeySelector
                  activeNotes={activeNotes}
                  notation={notation}
                  singleRootMode={singleRootMode}
                  onApplyKey={handleApplyKey}
                  onNotationChange={setNotation}
                />
              </SettingsRow>

              <StudyModeControls
                studyMode={studyMode}
                chordQuality={chordQuality}
                scaleQuality={scaleQuality}
                scaleSystem={scaleSystem}
                showSystemToggle={supportsSystemToggle}
                progressionId={progressionId}
                progressionStepIndex={progressionStepIndex}
                resolvedSteps={resolvedProgressionSteps}
                onChordQualityChange={setChordQuality}
                onScaleQualityChange={setScaleQuality}
                onScaleSystemChange={setScaleSystem}
                onProgressionChange={handleProgressionChange}
                onProgressionStepChange={setProgressionStepIndex}
              />

              {!singleRootMode && (
                <SettingsRow label="Selection">
                  <div className="shortcuts">
                    <button
                      type="button"
                      className={glass.pill}
                      onClick={handleSelectAll}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={glass.pill}
                      onClick={handleClearAll}
                    >
                      Clear
                    </button>
                  </div>
                </SettingsRow>
              )}
            </SettingsSection>

            {singleRootMode && (
              <SettingsSection title="This key">
                <KeyContext
                  keyRoot={keyCenter}
                  keyMode={effectiveKeyMode}
                  notation={notation}
                  keyModeLocked={keyModeLocked}
                  onKeyModeChange={setKeyMode}
                  onSelectChord={handleContextSelectChord}
                  onSelectScale={handleContextSelectScale}
                  onSelectProgressions={handleContextSelectProgressions}
                  onSelectRelative={handleContextSelectRelative}
                  onExplainChords={handleContextExplainChords}
                />
              </SettingsSection>
            )}

            {studyMode === 'theory' && (
              <SettingsSection title="Topics">
                <TheoryNavigator
                  activeTopicId={theoryTopicId}
                  onTopicChange={handleTheoryTopicChange}
                />
              </SettingsSection>
            )}

            {studyMode === 'progressions' && (
              <SettingsSection title="About">
                <TheoryPanel
                  theory={activeProgression.theory}
                  currentStepLabel={
                    activeProgressionStep
                      ? `${activeProgressionStep.chordName} (${activeProgressionStep.numeral})`
                      : undefined
                  }
                  currentStepRole={currentStepRole}
                  resolvedChords={resolvedProgressionSteps
                    .map((step) => step.chordName)
                    .join(' – ')}
                />
              </SettingsSection>
            )}

            {studyMode === 'theory' && (
              <SettingsSection title="About">
                <TheoryPanel
                  theory={activeTheoryTopic.theory}
                  defaultOpen
                />
              </SettingsSection>
            )}

          </SettingsList>
        </div>

        <div className="fretboardStage" ref={fretboardAnchorRef}>
          {showFretboard && (
            <div className="focusRow">
              <button
                type="button"
                className={glass.pill}
                aria-pressed={focusMode}
                title={
                  focusMode
                    ? 'Show the sidebar (Esc)'
                    : 'Hide the sidebar and fill the screen with the fretboard'
                }
                onClick={() => setFocusMode((prev) => !prev)}
              >
                {focusMode ? 'Exit focus' : 'Focus'}
              </button>
            </div>
          )}
          {showTheoryStage ? (
            <TheoryStage
              topic={activeTheoryTopic}
              selectedRoot={rootNote}
              keyMode={keyMode}
              showFretboard={theoryShowFretboard}
              onSelectKey={handleTheoryKeySelect}
              onShowFretboardChange={handleTheoryShowFretboard}
              onPracticeLink={
                activeTheoryTopic.practiceLink
                  ? handleTheoryPracticeLink
                  : undefined
              }
            />
          ) : null}
          {showFretboard ? (
            <>
              <Fretboard
                positions={positions}
                title={title}
                subtitle={subtitle}
                subtitleVariant={
                  studyMode === 'progressions' || studyMode === 'theory'
                    ? 'theory'
                    : 'default'
                }
                notation={notation}
                noteLabels={spellingMap}
                mutedStrings={mutedStrings}
                showFingers={showFingers}
                showNoteLabels={showNoteLabels}
                fullDotOpacity={fullDotOpacity}
                showChordTones={supportsChordTones && showChordTones}
                rootNote={highlightRoot}
                chordQuality={
                  supportsChordTones ? highlightChordQuality : null
                }
                noteColors={noteColors}
                onPlayNote={audio.muted ? undefined : audio.playPosition}
                activePosition={audio.playingPosition}
                ghostLayers={neckView.layers.ghosts}
                overlapKeys={neckView.layers.overlapKeys}
                regionBadges={neckView.badges}
                onSelectRegion={
                  traversalActive ? undefined : setPositionIndex
                }
              />
              {showPositionSlider && (
                <PositionSlider
                  regions={displayRegions}
                  selectedIndex={positionIndex}
                  onChange={setPositionIndex}
                  showFingers={showFingers}
                  onFingersToggle={() => setShowFingers((prev) => !prev)}
                  showNoteLabels={showNoteLabels}
                  fullDotOpacity={fullDotOpacity}
                  onNoteLabelsToggle={() => setShowNoteLabels((prev) => !prev)}
                  onFullDotOpacityToggle={() =>
                    setFullDotOpacity((prev) => !prev)
                  }
                  showChordTones={supportsChordTones ? showChordTones : undefined}
                  onChordTonesToggle={
                    supportsChordTones
                      ? () => setShowChordTones((prev) => !prev)
                      : undefined
                  }
                  viewMode={neckViewEnabled ? neckView.viewMode : undefined}
                  onViewModeChange={
                    neckViewEnabled ? neckView.setViewMode : undefined
                  }
                  harmonyLayer={
                    studyMode === 'scales' ? harmonyLayer : undefined
                  }
                  onHarmonyLayerChange={
                    studyMode === 'scales' ? setHarmonyLayer : undefined
                  }
                  disabled={ladderActive || traversalActive}
                />
              )}
              <div className="soundRow">
                <AudioControls
                  instrument={audio.instrument}
                  volume={audio.volume}
                  muted={audio.muted}
                  loading={audio.loading}
                  canPlay={
                    studyMode === 'progressions'
                      ? displayProgressionChordViews.some(
                          (chord) => chord.positions.length > 0,
                        )
                      : positions.length > 0
                  }
                  playbackMode={playbackMode}
                  playingId={audio.playingId}
                  tempo={tempo}
                  canTraverse={canTraverse}
                  scaleAnchor={
                    effectiveScalePlayback ? scaleAnchor : undefined
                  }
                  onScaleAnchorChange={
                    effectiveScalePlayback ? setScaleAnchor : undefined
                  }
                  onInstrumentChange={audio.setInstrument}
                  onVolumeChange={audio.setVolume}
                  onMutedToggle={() => audio.setMuted(!audio.muted)}
                  onTempoChange={setTempo}
                  onStrum={handleStrum}
                  onPlayScale={handlePlayScale}
                  onPlayTraversal={handlePlayTraversal}
                  onPlayProgression={handlePlayProgression}
                  onPlayProgressionLadder={handlePlayProgressionLadder}
                />
              </div>
              {studyMode === 'chords' && chordPositionViews.length > 0 && (
                <ChordPositionStrip
                  positions={chordPositionViews}
                  activeIndex={positionIndex}
                  notation={notation}
                  showFingers={showFingers}
                  showNoteLabels={showNoteLabels}
                  fullDotOpacity={fullDotOpacity}
                  showChordTones={showChordTones}
                  rootNote={rootNote}
                  chordQuality={chordQuality}
                  onSelectPosition={setPositionIndex}
                />
              )}
              {studyMode === 'progressions' &&
                displayProgressionChordViews.length > 0 && (
                  <ProgressionStrip
                    chords={displayProgressionChordViews}
                    activeIndex={progressionStepIndex}
                    notation={notation}
                    showFingers={showFingers}
                    showNoteLabels={showNoteLabels}
                    fullDotOpacity={fullDotOpacity}
                    showChordTones={showChordTones}
                    onSelectStep={setProgressionStepIndex}
                  />
                )}
            </>
          ) : null}
        </div>

        {debug.enabled && (
          <DebugPanel
            whiteBackground={debug.whiteBackground}
            whiteText={debug.whiteText}
            showColorEditor={debug.showColorEditor}
            noteColors={noteColors}
            onWhiteBackgroundChange={debug.setWhiteBackground}
            onWhiteTextChange={debug.setWhiteText}
            onColorChange={(note, color) =>
              setNoteColors((prev) => ({ ...prev, [note]: color }))
            }
            onColorReset={() => setNoteColors({ ...NOTE_COLORS })}
          />
        )}
      </div>
    </div>
  );
}

export default App;
