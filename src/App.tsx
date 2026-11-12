import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Fretboard } from './components/Fretboard';
import { PositionSlider } from './components/PositionSlider';
import { DisplayToggles } from './components/DisplayToggles';
import {
  AudioControls,
  DEFAULT_TEMPO,
  type PlaybackMode,
} from './components/AudioControls';
import { DebugPanel } from './components/DebugPanel';
import { AmbientBackground, type AmbientMotion } from './components/AmbientBackground';
import { KeySelector } from './components/KeySelector';
import { KeyContext } from './components/KeyContext';
import { useInstrument } from './hooks/useInstrument';
import { useUiTheme } from './hooks/useUiTheme';
import { useNeckView } from './hooks/useNeckView';
import { oneOf, usePersistentState } from './hooks/usePersistentState';
import { UiThemeSelector } from './components/UiThemeSelector';
import { useMediaQuery } from './hooks/useMediaQuery';
import {
  Deck,
  DeckRow,
  Frame,
  Neck,
  SidePanel,
  Strip,
  StripEnd,
} from './components/Frame';
import type { SideState } from './components/frameContext';
import { Popover } from './components/Popover';
import {
  orderScalePositions,
  type ScaleAnchor,
  type ScaleDirection,
  type ScaleOrdering,
} from './lib/audio/pitch';
import { buildTraversalRun } from './lib/audio/traversal';
import { ALL_NOTES, NOTE_COLORS } from './lib/colors';
import { getFretboardTitle, getRootNote } from './lib/displayTitle';
import {
  getBackgroundKeyForMode,
  getKeyBackgroundStyle,
} from './lib/keyPalette';
import { PracticeSession } from './components/PracticeSession';
import {
  buildChordPositionViews,
  buildChordPositions,
  buildLadderProgressionChordViews,
  buildScalePositions,
  buildSavedProgressionChordViews,
  buildSingleStringScale,
  buildSpellingMap,
  filterToChordTones,
  formatNoteDisplay,
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
  TheoryDiagram,
} from './types/music';
import {
  StudyModeControls,
  StudyModeSelector,
} from './components/StudyModeControls';
import { SettingsSection } from './components/SettingsList';
import { ChordPositionStrip } from './components/ChordPositionStrip';
import { ProgressionStrip } from './components/ProgressionStrip';
import { IntervalTrainer } from './components/IntervalTrainer';
import { TheoryPanel } from './components/TheoryPanel';
import { TheoryNavigator } from './components/TheoryNavigator';
import { TheoryActions, TheoryStage } from './components/TheoryStage';
import { APP_NAME } from './lib/brand';
import glass from './styles/glass.module.css';
import { useDebugSettings } from './hooks/useDebugSettings';
import './App.css';

function isSingleRootMode(mode: StudyMode): boolean {
  return (
    mode === 'practice' ||
    mode === 'chords' ||
    mode === 'scales' ||
    mode === 'progressions' ||
    mode === 'intervals' ||
    mode === 'theory'
  );
}

/** Below this the side panel becomes a drawer over the neck. */
const SIDE_DRAWER_QUERY = '(max-width: 1099px), (max-height: 679px)';

const STUDY_MODES = [
  'practice',
  'notes',
  'chords',
  'scales',
  'progressions',
  'intervals',
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
    'practice',
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

  const [ambientMotion, setAmbientMotion] = usePersistentState<AmbientMotion>('ambient-motion', 'flow', oneOf(['flow', 'calm', 'still'] as const));
  const debug = useDebugSettings();
  const { uiTheme, vibratoCanvas, selectUiTheme, selectCanvas } = useUiTheme();

  // Side panel: docked beside the neck on roomy windows (open or closed, as
  // the player left it), a drawer over the neck on small ones.
  const isDrawer = useMediaQuery(SIDE_DRAWER_QUERY);
  const [sidePanelOpen, setSidePanelOpen] = usePersistentState(
    'side-panel-open',
    true,
    isBoolean,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(noteColors));
    } catch {
      // ignore storage write failures
    }
  }, [noteColors]);

  useEffect(() => {
    if (!focusMode && !drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFocusMode(false);
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, drawerOpen]);

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

  // The diagram picked for the current topic; a new topic starts on its own.
  const [diagramChoice, setDiagramChoice] = useState<{
    topicId: string;
    view: TheoryDiagram;
  } | null>(null);
  const theoryDiagramView = activeTheoryTopic.diagram
    ? diagramChoice?.topicId === activeTheoryTopic.id
      ? diagramChoice.view
      : activeTheoryTopic.diagram
    : undefined;

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
    studyMode === 'progressions' ||
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
          undefined,
          spellingMap,
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
        spellingMap,
      );
    },
    [
      spellingMap,
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

  const currentStepRole = useMemo(() => {
    if (studyMode !== 'progressions' || !activeProgressionStep) return undefined;
    return activeProgression.theory.functions?.find(
      (fn) => fn.numeral === activeProgressionStep.numeral,
    )?.role;
  }, [studyMode, activeProgression, activeProgressionStep]);

  // The mode the current key reads as — drives the key-context panel and the
  // ambient background tint.
  const effectiveKeyMode: KeyMode =
    studyMode === 'practice' ? 'minor' : studyMode === 'scales'
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

  const ambientStyle = useMemo(
    () =>
      getKeyBackgroundStyle(
        backgroundKey,
        effectiveKeyMode === 'minor' ? 'minor' : 'major',
        noteColors,
      ),
    [backgroundKey, effectiveKeyMode, noteColors],
  );

  const rootContrastMode =
    uiTheme === 'scholar' || (uiTheme === 'vibrato' && vibratoCanvas === 'light')
      ? 'light'
      : 'dark';

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
    if (mode === studyMode) return;
    audio.stopAll();
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
      neckView.applySpanPreset(demoView);
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
      neckView.applySpanPreset(link.neckView);
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
  // The dial takes the deck's height; its controls move into the stage.
  const theoryDialShown =
    studyMode === 'theory' && !theoryShowFretboard && Boolean(activeTheoryTopic.diagram);
  const showIntervalTrainer = studyMode === 'intervals';
  const showFretboard =
    studyMode !== 'practice' && studyMode !== 'intervals' && (studyMode !== 'theory' || theoryShowFretboard);

  // --- The frame: top strip, neck, deck, side panel ---

  const hasSide = studyMode !== 'notes';
  const sideState: SideState =
    !hasSide || focusMode
      ? 'closed'
      : isDrawer
        ? drawerOpen
          ? 'drawer'
          : 'closed'
        : sidePanelOpen
          ? 'docked'
          : 'closed';
  const sideShown = sideState !== 'closed';
  const toggleSide = () => {
    if (isDrawer) setDrawerOpen((prev) => !prev);
    else setSidePanelOpen((prev) => !prev);
  };

  const keyLabel = formatNoteDisplay(rootNote, notation);

  const strip = (
    <Strip>
      <p className="wordmark" aria-label={APP_NAME.slice(0, -1)}>
        {APP_NAME.slice(0, -1)}
        <span className="wordmarkWave">{APP_NAME.at(-1)}</span>
      </p>
      <StudyModeSelector
        studyMode={studyMode}
        onStudyModeChange={handleStudyModeChange}
      />
      <StripEnd>
        {singleRootMode && studyMode !== 'practice' && (
          <Popover
            label="Key"
            buttonLabel={`Key ${keyLabel}. Change key`}
            button={
              <>
                <span className="stripLabel">Key</span>
                {keyLabel}
              </>
            }
          >
            {(close) => (
              <div className="keyMenu">
                <KeySelector
                  activeNotes={activeNotes}
                  notation={notation}
                  singleRootMode
                  onApplyKey={(note, action) => {
                    handleApplyKey(note, action);
                    if (action === 'set') close();
                  }}
                  onNotationChange={setNotation}
                />
              </div>
            )}
          </Popover>
        )}
        <UiThemeSelector
          uiTheme={uiTheme}
          vibratoCanvas={vibratoCanvas}
          onUiThemeChange={selectUiTheme}
          onCanvasChange={selectCanvas}
          motion={ambientMotion}
          onMotionChange={setAmbientMotion}
        />
        {hasSide && (
          <button
            type="button"
            className={sideShown ? glass.pillSelected : glass.pill}
            aria-pressed={sideShown}
            title={sideShown ? 'Hide the side panel' : 'Show the side panel: this key, chord shapes, reading'}
            onClick={toggleSide}
          >
            Panel
          </button>
        )}
      </StripEnd>
    </Strip>
  );

  const keyContext =
    singleRootMode && studyMode !== 'practice' ? (
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
    ) : null;

  const audioError =
    audio.error && studyMode !== 'practice' ? (
      <p className="audioError" role="alert">
        {audio.error}{' '}
        <button onClick={() => audio.setInstrument(audio.instrument)}>Retry sound</button>
      </p>
    ) : null;

  const focusButton = showFretboard ? (
    <button
      type="button"
      className={focusMode ? glass.pillSelected : glass.pill}
      aria-pressed={focusMode}
      title={
        focusMode
          ? 'Bring back the top bar and side panel (Esc)'
          : 'Hide the top bar and side panel so the neck fills the window'
      }
      onClick={() => setFocusMode((prev) => !prev)}
    >
      {focusMode ? 'Exit focus' : 'Focus'}
    </button>
  ) : null;

  const theoryActions = (
    <TheoryActions
      topic={activeTheoryTopic}
      diagramView={theoryDiagramView}
      onDiagramViewChange={(view) =>
        setDiagramChoice({ topicId: activeTheoryTopic.id, view })
      }
      showFretboard={theoryShowFretboard}
      onShowFretboardChange={handleTheoryShowFretboard}
      onPracticeLink={
        activeTheoryTopic.practiceLink ? handleTheoryPracticeLink : undefined
      }
    />
  );

  const neck = (
    <Neck
      bar={
        showPositionSlider ? (
          <PositionSlider
            regions={displayRegions}
            selectedIndex={positionIndex}
            onChange={setPositionIndex}
            spanEndIndex={neckView.spanEndIndex}
            onSpanEndChange={neckView.setSpanEndIndex}
            allowRange={neckViewEnabled}
            disabled={ladderActive || traversalActive}
          />
        ) : null
      }
      barEnd={focusButton}
    >
      {showFretboard ? (
        <Fretboard
          fill
          positions={positions}
          title={title}
          notation={notation}
          noteLabels={spellingMap}
          mutedStrings={mutedStrings}
          showFingers={showFingers}
          showNoteLabels={showNoteLabels}
          fullDotOpacity={fullDotOpacity}
          showChordTones={supportsChordTones && showChordTones}
          rootNote={highlightRoot}
          chordQuality={supportsChordTones ? highlightChordQuality : null}
          noteColors={noteColors}
          onPlayNote={audio.muted ? undefined : audio.playPosition}
          activePosition={audio.playingPosition}
          ghostLayers={neckView.layers.ghosts}
          overlapKeys={neckView.layers.overlapKeys}
          regionBadges={neckView.badges}
          onSelectRegion={traversalActive ? undefined : setPositionIndex}
        />
      ) : showTheoryStage ? (
        <TheoryStage
          topic={activeTheoryTopic}
          selectedRoot={rootNote}
          keyMode={keyMode}
          diagramView={theoryDiagramView}
          onSelectKey={handleTheoryKeySelect}
          controls={theoryDialShown ? theoryActions : undefined}
        />
      ) : null}
      {audioError}
    </Neck>
  );

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

  const pickers =
    studyMode === 'notes' ? (
      <>
        <KeySelector
          activeNotes={activeNotes}
          notation={notation}
          singleRootMode={false}
          onApplyKey={handleApplyKey}
          onNotationChange={setNotation}
        />
        <div className="shortcuts" role="group" aria-label="Selection">
          <button type="button" className={glass.pill} onClick={handleSelectAll}>
            All
          </button>
          <button type="button" className={glass.pill} onClick={handleClearAll}>
            Clear
          </button>
        </div>
      </>
    ) : studyMode === 'theory' ? (
      theoryActions
    ) : (
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
    );

  const deck = (
    <Deck>
      <DeckRow>{pickers}</DeckRow>
      {showFretboard && (
        <DeckRow>
          <AudioControls part="transport" {...audioProps} />
        </DeckRow>
      )}
      {showFretboard && (
        <DeckRow end>
          <AudioControls part="sound" {...audioProps} />
          {showPositionSlider && (
            <DisplayToggles
              showFingers={showFingers}
              onFingersToggle={() => setShowFingers((prev) => !prev)}
              showNoteLabels={showNoteLabels}
              fullDotOpacity={fullDotOpacity}
              onNoteLabelsToggle={() => setShowNoteLabels((prev) => !prev)}
              onFullDotOpacityToggle={() => setFullDotOpacity((prev) => !prev)}
              showChordTones={supportsChordTones ? showChordTones : undefined}
              onChordTonesToggle={
                supportsChordTones
                  ? () => setShowChordTones((prev) => !prev)
                  : undefined
              }
              harmonyLayer={studyMode === 'scales' ? harmonyLayer : undefined}
              onHarmonyLayerChange={
                studyMode === 'scales' ? setHarmonyLayer : undefined
              }
            />
          )}
        </DeckRow>
      )}
    </Deck>
  );

  const side = (
    <SidePanel label="Side panel">
      {keyContext}

      {studyMode === 'chords' && chordPositionViews.length > 0 && (
        <SettingsSection title="Positions">
          <ChordPositionStrip
            wrap
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
        </SettingsSection>
      )}

      {studyMode === 'progressions' && displayProgressionChordViews.length > 0 && (
        <SettingsSection title="Chords">
          <ProgressionStrip
            wrap
            chords={displayProgressionChordViews}
            activeIndex={progressionStepIndex}
            notation={notation}
            showFingers={showFingers}
            showNoteLabels={showNoteLabels}
            fullDotOpacity={fullDotOpacity}
            showChordTones={showChordTones}
            onSelectStep={setProgressionStepIndex}
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
        <SettingsSection title="Topics">
          <TheoryNavigator
            activeTopicId={theoryTopicId}
            onTopicChange={handleTheoryTopicChange}
          />
        </SettingsSection>
      )}

      {studyMode === 'theory' && (
        <SettingsSection title="About">
          <TheoryPanel theory={activeTheoryTopic.theory} defaultOpen />
        </SettingsSection>
      )}
    </SidePanel>
  );

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
          ? (ambientStyle as CSSProperties)
          : undefined
      }
    >
      <AmbientBackground
        style={ambientStyle as CSSProperties}
        motion={ambientMotion}
        light={vibratoCanvas === 'light'}
        enabled={uiTheme === 'vibrato'}
      />
      <Frame
        side={sideState}
        focus={focusMode}
        practice={studyMode === 'practice'}
        noDeck={theoryDialShown}
        onCloseSide={() => setDrawerOpen(false)}
      >
        {strip}
        {studyMode === 'practice' ? (
          <PracticeSession
            root={rootNote}
            notation={notation}
            audio={audio}
            onRootChange={(note) => handleApplyKey(note, 'set')}
          />
        ) : showIntervalTrainer ? (
          <>
            <IntervalTrainer
              root={rootNote}
              notation={notation}
              noteColors={noteColors}
              audio={audio}
            />
            <SidePanel label="Side panel">{keyContext}</SidePanel>
          </>
        ) : (
          <>
            {neck}
            {theoryDialShown ? null : deck}
            {side}
          </>
        )}

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
      </Frame>
    </div>
  );
}

export default App;
