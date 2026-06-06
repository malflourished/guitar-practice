import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Fretboard } from './components/Fretboard';
import { PositionSlider } from './components/PositionSlider';
import { AudioControls, DEFAULT_TEMPO } from './components/AudioControls';
import { DebugPanel } from './components/DebugPanel';
import { AmbientBackground } from './components/AmbientBackground';
import { KeySelector } from './components/KeySelector';
import { useInstrument } from './hooks/useInstrument';
import { useUiTheme } from './hooks/useUiTheme';
import { UiThemeSelector } from './components/UiThemeSelector';
import { orderScalePositions, type ScaleDirection } from './lib/audio/pitch';
import { ALL_NOTES, NOTE_COLORS } from './lib/colors';
import {
  getFretboardSubtitle,
  getFretboardTitle,
  getRootNote,
} from './lib/displayTitle';
import {
  getBackgroundKeyForMode,
  getKeyBackgroundStyle,
} from './lib/keyPalette';
import { contrastModeFromBackgroundStyle } from './lib/contrast';
import {
  buildArpeggioPositions,
  buildChordPositionViews,
  buildChordPositions,
  buildLadderProgressionChordViews,
  buildScalePositions,
  buildSavedProgressionChordViews,
  buildSpellingMap,
  getChordQualityLabel,
  getPositionsForNotes,
  getQualityLabel,
  getProgressionById,
  getProgressionStepPositionScope,
  getSpelledChordNotes,
  getSpelledScaleNotes,
  PROGRESSIONS,
  resolveProgression,
  spelledRootFromNoteName,
  type NotationPreference,
  type ProgressionLadderDirection,
} from './lib/music';
import type {
  ChordQuality,
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
import { APP_NAME } from './lib/brand';
import glass from './styles/glass.module.css';
import { useColorBoundary } from './hooks/useColorBoundary';
import { useDebugSettings } from './hooks/useDebugSettings';
import './App.css';

function isSingleRootMode(mode: StudyMode): boolean {
  return (
    mode === 'chords' ||
    mode === 'scales' ||
    mode === 'arpeggios' ||
    mode === 'progressions'
  );
}

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
  const [activeNotes, setActiveNotes] = useState<Set<NoteName>>(new Set(['C']));
  const [notation, setNotation] = useState<NotationPreference>('sharps');
  const [studyMode, setStudyMode] = useState<StudyMode>('notes');
  const [scaleQuality, setScaleQuality] =
    useState<ScaleQuality>('minorPentatonic');
  const [chordQuality, setChordQuality] = useState<ChordQuality>('major');
  const [progressionId, setProgressionId] = useState(PROGRESSIONS[0].id);
  const [progressionStepIndex, setProgressionStepIndex] = useState(0);
  const [scaleSystem, setScaleSystem] = useState<ScaleSystem>('3nps');
  const [showFingers, setShowFingers] = useState(false);
  const [showNoteLabels, setShowNoteLabels] = useState(true);
  const [fullDotOpacity, setFullDotOpacity] = useState(false);
  const [showChordTones, setShowChordTones] = useState(false);
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

  const [positionByScope, setPositionByScope] = useState<Record<string, number>>(
    {},
  );

  const rootNote = useMemo(() => getRootNote(activeNotes), [activeNotes]);

  const activeProgression = useMemo(
    () => getProgressionById(progressionId) ?? PROGRESSIONS[0],
    [progressionId],
  );

  const resolvedProgressionSteps = useMemo(
    () => resolveProgression(rootNote, activeProgression, notation),
    [rootNote, activeProgression, notation],
  );

  const [ladderAnchor, setLadderAnchor] = useState<number | null>(null);

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

  const highlightChordQuality =
    studyMode === 'progressions' ? activeChordQuality : chordQuality;

  const supportsChordTones =
    studyMode === 'chords' ||
    studyMode === 'arpeggios' ||
    studyMode === 'progressions';

  const qualityKey =
    studyMode === 'scales'
      ? scaleQuality
      : studyMode === 'progressions'
        ? `${progressionId}-${progressionStepIndex}-${activeChordQuality}`
        : chordQuality;
  const qualityLabel =
    studyMode === 'scales'
      ? getQualityLabel(scaleQuality)
      : studyMode === 'progressions'
        ? (activeProgressionStep?.qualityLabel ?? getChordQualityLabel(chordQuality))
        : getChordQualityLabel(chordQuality);

  const supportsSystemToggle =
    studyMode === 'scales' &&
    (scaleQuality === 'major' || scaleQuality === 'minor');

  const positionScope = `${studyMode}-${qualityKey}-${
    supportsSystemToggle ? scaleSystem : 'fixed'
  }`;

  const positionRegions = useMemo(() => {
    if (studyMode === 'chords' || studyMode === 'progressions') {
      return buildChordPositions(activeChordRoot, activeChordQuality);
    }
    if (studyMode === 'arpeggios') {
      return buildArpeggioPositions(rootNote, chordQuality);
    }
    if (studyMode === 'scales') {
      return buildScalePositions(rootNote, scaleQuality, scaleSystem);
    }
    return [];
  }, [
    studyMode,
    rootNote,
    activeChordRoot,
    activeChordQuality,
    chordQuality,
    scaleQuality,
    scaleSystem,
  ]);

  const positionIndex = Math.min(
    positionByScope[positionScope] ?? 0,
    Math.max(0, positionRegions.length - 1),
  );

  const setPositionIndex = (index: number) => {
    setPositionByScope((prev) => ({ ...prev, [positionScope]: index }));
  };

  const activePositionRegion = positionRegions[positionIndex];

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
    if (studyMode === 'progressions' && ladderActive && activeDisplayChord) {
      return activeDisplayChord.positions;
    }
    return activePositionRegion ? activePositionRegion.positions : [];
  }, [
    activeNotes,
    studyMode,
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
  const [tempo, setTempo] = useState(DEFAULT_TEMPO);
  const playbackMode =
    studyMode === 'progressions'
      ? 'progression'
      : studyMode === 'chords'
        ? 'strum'
        : 'sequence';
  const handleStrum = () => audio.strum(positions);
  const handlePlayScale = (direction: ScaleDirection) => {
    if (audio.playingId === direction) {
      audio.stopAll();
      return;
    }
    audio.playSequence(
      orderScalePositions(positions, rootNote, direction),
      tempo,
      direction,
    );
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
    if (studyMode === 'notes') return null;
    if (studyMode === 'progressions' && ladderActive && activeDisplayChord) {
      return activeDisplayChord.noteLabels;
    }
    const spellingRoot =
      studyMode === 'progressions' ? activeChordRoot : rootNote;
    const spelledRoot = spelledRootFromNoteName(spellingRoot, notation);
    const spelled =
      studyMode === 'scales'
        ? getSpelledScaleNotes(spelledRoot, scaleQuality)
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
    chordQuality,
    activeChordQuality,
    notation,
    ladderActive,
    activeDisplayChord,
  ]);

  const title = useMemo(
    () =>
      getFretboardTitle(
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
      ),
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
    ],
  );

  const subtitle = useMemo(() => {
    const base = getFretboardSubtitle(
      studyMode,
      studyMode === 'progressions' ? activeProgression.theory : null,
    );
    if (ladderActive && ladderDirection) {
      const hint =
        ladderDirection === 'ascending'
          ? "Ladder playback climbs the neck from the I chord's position."
          : 'Ladder playback starts at the highest position and works down from the I chord.';
      return `${base} ${hint}`;
    }
    return base;
  }, [studyMode, activeProgression, ladderActive, ladderDirection]);

  const currentStepRole = useMemo(() => {
    if (studyMode !== 'progressions' || !activeProgressionStep) return undefined;
    return activeProgression.theory.functions?.find(
      (fn) => fn.numeral === activeProgressionStep.numeral,
    )?.role;
  }, [studyMode, activeProgression, activeProgressionStep]);

  const backgroundKey = useMemo(
    () => getBackgroundKeyForMode(studyMode, activeNotes, rootNote),
    [studyMode, activeNotes, rootNote],
  );

  const ambientStyle = useMemo(
    () =>
      getKeyBackgroundStyle(
        backgroundKey,
        studyMode === 'scales'
          ? scaleQuality
          : studyMode === 'progressions'
            ? activeChordQuality
            : chordQuality,
        noteColors,
      ),
    [
      backgroundKey,
      studyMode,
      scaleQuality,
      chordQuality,
      activeChordQuality,
      noteColors,
    ],
  );

  const contrastMode = useMemo(() => {
    if (uiTheme === 'scholar') return 'light';
    if (uiTheme === 'vibrato' && vibratoCanvas === 'light') return 'light';
    return contrastModeFromBackgroundStyle(ambientStyle);
  }, [uiTheme, vibratoCanvas, ambientStyle]);

  const ambientBackgroundStyle = useMemo(
    () =>
      ({
        ...ambientStyle,
        '--color-boundary': colorBoundary,
      }) as CSSProperties,
    [ambientStyle, colorBoundary],
  );

  const handleApplyKey = (note: NoteName, action: 'select' | 'deselect' | 'set') => {
    if (action === 'set') {
      setActiveNotes(new Set([note]));
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
      setActiveNotes((prev) => toSingleRoot(prev));
    }
    if (mode === 'progressions') {
      setProgressionStepIndex(0);
    }
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
    singleRootMode && positionRegions.length > 0;

  return (
    <div
      className="themeRoot"
      data-ui-theme={uiTheme}
      data-vibrato-canvas={vibratoCanvas}
      data-contrast={contrastMode}
      data-debug-bg={debug.enabled && debug.whiteBackground ? 'white' : undefined}
      data-debug-text={
        debug.enabled ? (debug.whiteText ? 'white' : 'black') : undefined
      }
      style={
        uiTheme === 'vibrato' ? (ambientStyle as CSSProperties) : undefined
      }
    >
      <AmbientBackground style={ambientBackgroundStyle} />
      <UiThemeSelector
        uiTheme={uiTheme}
        vibratoCanvas={vibratoCanvas}
        onUiThemeChange={selectUiTheme}
      />
      <div className="app">
        <div className="shell">
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

            <SettingsSection title="Sound">
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
                onInstrumentChange={audio.setInstrument}
                onVolumeChange={audio.setVolume}
                onMutedToggle={() => audio.setMuted(!audio.muted)}
                onTempoChange={setTempo}
                onStrum={handleStrum}
                onPlayScale={handlePlayScale}
                onPlayProgression={handlePlayProgression}
                onPlayProgressionLadder={handlePlayProgressionLadder}
              />
            </SettingsSection>
          </SettingsList>
        </div>

        <div className="fretboardStage" ref={fretboardAnchorRef}>
          <Fretboard
            positions={positions}
            title={title}
            subtitle={subtitle}
            subtitleVariant={
              studyMode === 'progressions' ? 'theory' : 'default'
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
          />
          {showPositionSlider && (
            <PositionSlider
              regions={positionRegions}
              selectedIndex={positionIndex}
              onChange={setPositionIndex}
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
              disabled={ladderActive}
            />
          )}
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
          {studyMode === 'progressions' && displayProgressionChordViews.length > 0 && (
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
