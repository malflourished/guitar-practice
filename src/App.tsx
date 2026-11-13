import type { CSSProperties } from 'react';
import './styleOrder'; // first: it fixes the order the stylesheets load in
import { Fretboard } from './components/Fretboard';
import { PositionSlider } from './components/PositionSlider';
import { SettingsPanel } from './components/SettingsPanel';
import { DebugPanel } from './components/DebugPanel';
import { AmbientBackground } from './components/AmbientBackground';
import { AppStrip } from './components/AppStrip';
import { Frame, Neck, SidePanel } from './components/Frame';
import { IntervalTrainer } from './components/IntervalTrainer';
import { PracticeSession } from './components/PracticeSession';
import { TheoryStage } from './components/TheoryStage';
import { useAppTheme } from './hooks/useAppTheme';
import { useBoardData } from './hooks/useBoardData';
import { useDisplaySettings } from './hooks/useDisplaySettings';
import { useFrameState } from './hooks/useFrameState';
import { useInstrument } from './hooks/useInstrument';
import { useKeyState } from './hooks/useKeyState';
import { useNeckPosition } from './hooks/useNeckPosition';
import { oneOf, usePersistentState } from './hooks/usePersistentState';
import { usePlayback } from './hooks/usePlayback';
import { usePlaySpace } from './hooks/usePlaySpace';
import { NOTE_COLORS } from './lib/colors';
import { formatNoteDisplay } from './lib/music';
import type { StudyMode } from './types/music';
import { ChordsControls } from './modes/chords/ChordsControls';
import { ChordsPanel } from './modes/chords/ChordsPanel';
import {
  useChordPositionViews,
  useChordsState,
} from './modes/chords/useChordsState';
import { IntervalsPanel } from './modes/intervals/IntervalsPanel';
import { KeyContextSection } from './modes/KeyContextSection';
import { ModeDeck } from './modes/ModeDeck';
import { NotesControls } from './modes/notes/NotesControls';
import { ProgressionsControls } from './modes/progressions/ProgressionsControls';
import { ProgressionsPanel } from './modes/progressions/ProgressionsPanel';
import { useProgressionViews } from './modes/progressions/useProgressionViews';
import { useProgressionsState } from './modes/progressions/useProgressionsState';
import { ScalesControls } from './modes/scales/ScalesControls';
import { ScalesPanel } from './modes/scales/ScalesPanel';
import { useScalesState } from './modes/scales/useScalesState';
import {
  STUDY_MODES,
  getEffectiveKeyMode,
  isSingleRootMode,
} from './modes/studyModes';
import { TheoryControls } from './modes/theory/TheoryControls';
import { TheoryPanel } from './modes/theory/TheoryPanel';
import { useTheoryActions } from './modes/theory/useTheoryActions';
import { useTheoryState } from './modes/theory/useTheoryState';
import type { ModeStates } from './modes/types';
import { useStudyModeSwitch } from './modes/useStudyModeSwitch';
import glass from './styles/glass.module.css';
import './App.css';

/**
 * App is wiring: it owns the study mode, builds each mode's state and the
 * shared hooks (key, display, neck position, audio), and hands the pieces to
 * the frame's slots. What a mode shows lives in `src/modes/<mode>/`.
 */
function App() {
  const [studyMode, setStudyMode] = usePersistentState<StudyMode>(
    'study-mode',
    'practice',
    oneOf(STUDY_MODES),
  );
  const keyState = useKeyState(studyMode);
  const { activeNotes, notation, rootNote, keyCenter, keyMode } = keyState;
  const display = useDisplaySettings();
  const chords = useChordsState();
  const scales = useScalesState();
  const progressions = useProgressionsState({
    studyMode,
    rootNote,
    notation,
    chordQuality: chords.chordQuality,
  });
  const theory = useTheoryState(studyMode);
  const modes: ModeStates = {
    studyMode,
    setStudyMode,
    keyState,
    chords,
    scales,
    progressions,
    theory,
  };

  const audio = useInstrument();
  const neck = useNeckPosition({
    studyMode,
    keyState,
    chords,
    scales,
    progressions,
    theory,
    harmonyLayer: display.harmonyLayer,
  });
  const progressionViews = useProgressionViews({
    studyMode,
    notation,
    progressions,
    positionByScope: neck.positionByScope,
    playingId: audio.playingId,
  });
  const chordPositionViews = useChordPositionViews(
    studyMode,
    rootNote,
    chords.chordQuality,
    notation,
  );
  const board = useBoardData({
    studyMode,
    keyState,
    chords,
    scales,
    progressions,
    theory,
    neck,
    progressionViews,
  });
  const { playProps, togglePlay, traversalActive, tempo, setTempo } = usePlayback({
    studyMode,
    audio,
    keyState,
    scales,
    progressions,
    theory,
    neck,
    board,
    progressionViews,
  });

  const effectiveKeyMode = getEffectiveKeyMode(
    studyMode,
    scales.scaleQuality,
    progressions.activeProgression.keyMode,
    keyMode,
  );
  const theme = useAppTheme({
    studyMode,
    activeNotes,
    keyCenter,
    effectiveKeyMode,
    noteColors: display.noteColors,
  });
  const hasSide = studyMode !== 'notes';
  const frame = useFrameState(hasSide);
  const switchMode = useStudyModeSwitch(modes, audio);
  const theoryMoves = useTheoryActions(modes, audio, neck.neckView);

  // Space plays and stops wherever the deck has a Play control.
  usePlaySpace(
    studyMode !== 'practice' &&
      studyMode !== 'intervals' &&
      (studyMode !== 'theory' || theory.theoryShowFretboard),
    () => {
      if (!playProps.disabled || playProps.playing) togglePlay();
    },
  );

  const singleRootMode = isSingleRootMode(studyMode);
  const showPositionSlider =
    singleRootMode &&
    neck.positionRegions.length > 0 &&
    (studyMode !== 'theory' || theory.theoryShowFretboard);
  // The dial takes the deck's height; its controls move into the stage.
  const theoryDialShown =
    studyMode === 'theory' &&
    !theory.theoryShowFretboard &&
    Boolean(theory.activeTheoryTopic.diagram);
  const showFretboard =
    studyMode !== 'practice' &&
    studyMode !== 'intervals' &&
    (studyMode !== 'theory' || theory.theoryShowFretboard);

  const strip = (
    <AppStrip
      studyMode={studyMode}
      onStudyModeChange={switchMode}
      theoryReturn={theory.theoryReturn}
      onBackToTheory={theoryMoves.handleBackToTheory}
      showKey={singleRootMode && studyMode !== 'practice'}
      keyLabel={formatNoteDisplay(rootNote, notation)}
      activeNotes={activeNotes}
      notation={notation}
      onApplyKey={keyState.applyKey}
      onNotationChange={keyState.setNotation}
      theme={theme}
      hasSide={hasSide}
      sideShown={frame.sideShown}
      onToggleSide={frame.toggleSide}
      settingsOpen={frame.settingsOpen}
      onToggleSettings={frame.toggleSettings}
    />
  );

  const keyContext =
    singleRootMode && studyMode !== 'practice' ? (
      <KeyContextSection {...modes} effectiveKeyMode={effectiveKeyMode} />
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
      className={frame.focusMode ? glass.pillSelected : glass.pill}
      aria-pressed={frame.focusMode}
      title={
        frame.focusMode
          ? 'Bring back the top bar and side panel (Esc)'
          : 'Hide the top bar and side panel so the neck fills the window'
      }
      onClick={() => frame.setFocusMode((prev) => !prev)}
    >
      {frame.focusMode ? 'Exit focus' : 'Focus'}
    </button>
  ) : null;

  const theoryControls = (
    <TheoryControls
      theory={theory}
      onShowFretboardChange={theoryMoves.handleTheoryShowFretboard}
      onPracticeLink={theoryMoves.handleTheoryPracticeLink}
    />
  );

  const neckRegion = (
    <Neck
      centerBar
      bar={
        showPositionSlider ? (
          <PositionSlider
            regions={neck.displayRegions}
            selectedIndex={neck.positionIndex}
            onChange={neck.setPositionIndex}
            spanEndIndex={neck.neckView.spanEndIndex}
            onSpanEndChange={neck.setSpanEndIndex}
            allowRange={neck.neckViewEnabled}
            disabled={progressionViews.ladderActive || traversalActive}
          />
        ) : null
      }
      barEnd={focusButton}
    >
      {showFretboard ? (
        <Fretboard
          fill
          positions={board.positions}
          title={board.title}
          notation={notation}
          noteLabels={board.spellingMap}
          mutedStrings={board.mutedStrings}
          showFingers={display.showFingers}
          showNoteLabels={display.showNoteLabels}
          intervalsAbove={display.showIntervals ? board.highlightRoot : null}
          fullDotOpacity={display.fullDotOpacity}
          showChordTones={board.supportsChordTones && display.showChordTones}
          rootNote={board.highlightRoot}
          chordQuality={
            board.supportsChordTones ? board.highlightChordQuality : null
          }
          noteColors={display.noteColors}
          onPlayNote={audio.muted ? undefined : audio.playPosition}
          activePosition={audio.playingPosition}
          ghostLayers={neck.neckView.layers.ghosts}
          overlapKeys={neck.neckView.layers.overlapKeys}
          regionBadges={neck.neckView.badges}
          onSelectRegion={traversalActive ? undefined : neck.setPositionIndex}
        />
      ) : studyMode === 'theory' ? (
        <TheoryStage
          topic={theory.activeTheoryTopic}
          selectedRoot={rootNote}
          keyMode={keyMode}
          diagramView={theory.theoryDiagramView}
          onSelectKey={theoryMoves.handleTheoryKeySelect}
          controls={theoryDialShown ? theoryControls : undefined}
        />
      ) : null}
      {audioError}
    </Neck>
  );

  const controls =
    studyMode === 'notes' ? (
      <NotesControls keyState={keyState} />
    ) : studyMode === 'theory' ? (
      theoryControls
    ) : studyMode === 'chords' ? (
      <ChordsControls
        chordQuality={chords.chordQuality}
        onChordQualityChange={chords.setChordQuality}
      />
    ) : studyMode === 'scales' ? (
      <ScalesControls
        scaleQuality={scales.scaleQuality}
        scaleSystem={scales.scaleSystem}
        showSystemToggle={neck.supportsSystemToggle}
        onScaleQualityChange={scales.setScaleQuality}
        onScaleSystemChange={scales.setScaleSystem}
      />
    ) : studyMode === 'progressions' ? (
      <ProgressionsControls
        progressionId={progressions.progressionId}
        progressionStepIndex={progressions.progressionStepIndex}
        resolvedSteps={progressions.resolvedProgressionSteps}
        onProgressionChange={progressions.handleProgressionChange}
        onProgressionStepChange={progressions.setProgressionStepIndex}
      />
    ) : null;

  const deck = (
    <ModeDeck
      controls={controls}
      showFretboard={showFretboard}
      showDisplayToggles={showPositionSlider}
      play={{ ...playProps, onOpenTempo: () => frame.openSettings('tempo') }}
      display={display}
      studyMode={studyMode}
      supportsChordTones={board.supportsChordTones}
    />
  );

  const panelContent =
    studyMode === 'chords' ? (
      <ChordsPanel
        keyContext={keyContext}
        positions={chordPositionViews}
        activeIndex={neck.positionIndex}
        notation={notation}
        display={display}
        rootNote={rootNote}
        chordQuality={chords.chordQuality}
        onSelectPosition={neck.setPositionIndex}
      />
    ) : studyMode === 'scales' ? (
      <ScalesPanel keyContext={keyContext} />
    ) : studyMode === 'progressions' ? (
      <ProgressionsPanel
        keyContext={keyContext}
        progressions={progressions}
        views={progressionViews}
        notation={notation}
        display={display}
      />
    ) : studyMode === 'theory' ? (
      <TheoryPanel keyContext={keyContext} theory={theory} />
    ) : studyMode === 'intervals' ? (
      <IntervalsPanel keyContext={keyContext} />
    ) : null;
  const panel = panelContent ? (
    <SidePanel key={studyMode} label="Side panel">
      {panelContent}
    </SidePanel>
  ) : undefined;

  // Practice and Intervals draw their own neck and deck.
  const body =
    studyMode === 'practice' ? (
      <PracticeSession
        root={rootNote}
        notation={notation}
        audio={audio}
        onRootChange={(note) => keyState.applyKey(note, 'set')}
      />
    ) : studyMode === 'intervals' ? (
      <IntervalTrainer
        root={rootNote}
        notation={notation}
        noteColors={display.noteColors}
        intervalColors={display.intervalColors}
        audio={audio}
      />
    ) : undefined;
  const ownsRegions = body !== undefined;

  const { debug } = theme;

  return (
    <div
      className="themeRoot"
      data-ui-theme={theme.uiTheme}
      data-vibrato-canvas={theme.vibratoCanvas}
      data-contrast={theme.rootContrastMode}
      data-debug-bg={debug.enabled && debug.whiteBackground ? 'white' : undefined}
      data-debug-text={
        debug.enabled ? (debug.whiteText ? 'white' : 'black') : undefined
      }
      style={
        theme.uiTheme === 'vibrato'
          ? (theme.ambientStyle as CSSProperties)
          : undefined
      }
    >
      <AmbientBackground
        style={theme.ambientStyle as CSSProperties}
        motion={theme.ambientMotion}
        light={theme.vibratoCanvas === 'light'}
        enabled={theme.uiTheme === 'vibrato'}
      />
      <Frame
        side={frame.sideState}
        focus={frame.focusMode}
        practice={studyMode === 'practice'}
        noDeck={theoryDialShown}
        onCloseSide={frame.closeDrawer}
        strip={strip}
        neck={ownsRegions ? undefined : neckRegion}
        deck={ownsRegions || theoryDialShown ? undefined : deck}
        body={body}
        panel={panel}
        settings={
          <SettingsPanel
            audio={audio}
            tempo={tempo}
            onTempoChange={setTempo}
            display={display}
            section={frame.settingsSection}
          />
        }
        settingsOpen={frame.settingsOpen}
      >
        {debug.enabled && (
          <DebugPanel
            whiteBackground={debug.whiteBackground}
            whiteText={debug.whiteText}
            showColorEditor={debug.showColorEditor}
            noteColors={display.noteColors}
            onWhiteBackgroundChange={debug.setWhiteBackground}
            onWhiteTextChange={debug.setWhiteText}
            onColorChange={(note, color) =>
              display.setNoteColors((prev) => ({ ...prev, [note]: color }))
            }
            onColorReset={() => display.setNoteColors({ ...NOTE_COLORS })}
          />
        )}
      </Frame>
    </div>
  );
}

export default App;
