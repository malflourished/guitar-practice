import { useState, type CSSProperties } from 'react';
import './styleOrder'; // first: it fixes the order the stylesheets load in
import { Fretboard } from './components/Fretboard';
import { PlayControl } from './components/PlayControl';
import { PositionSlider } from './components/PositionSlider';
import { SettingsPanel } from './components/SettingsPanel';
import { DebugPanel } from './components/DebugPanel';
import { AmbientBackground } from './components/AmbientBackground';
import { AppStrip } from './components/AppStrip';
import { Frame, Neck, SidePanel } from './components/Frame';
import { Home } from './components/Home';
import { IntervalTrainer } from './components/IntervalTrainer';
import { PracticeSession } from './components/PracticeSession';
import { TheoryStage } from './components/TheoryStage';
import { useAppTheme } from './hooks/useAppTheme';
import { useBoardData } from './hooks/useBoardData';
import { useDisplaySettings } from './hooks/useDisplaySettings';
import { useDrone } from './hooks/useDrone';
import { useFrameState } from './hooks/useFrameState';
import { useHome } from './hooks/useHome';
import { useInstrument } from './hooks/useInstrument';
import { useKeyState } from './hooks/useKeyState';
import { useNeckPosition } from './hooks/useNeckPosition';
import { oneOf, usePersistentState } from './hooks/usePersistentState';
import { usePlayback } from './hooks/usePlayback';
import { usePlaySpace } from './hooks/usePlaySpace';
import { NOTE_COLORS } from './lib/colors';
import { formatNoteDisplay } from './lib/music';
import type { StudyMode } from './types/music';
import { ChordsControls, ChordsOptions } from './modes/chords/ChordsControls';
import { ChordsPanel } from './modes/chords/ChordsPanel';
import {
  useChordPositionViews,
  useChordsState,
} from './modes/chords/useChordsState';
import { IntervalsPanel } from './modes/intervals/IntervalsPanel';
import { KeyContextSection } from './modes/KeyContextSection';
import { ModeDeck } from './modes/ModeDeck';
import { NeckBar } from './modes/ModePicker';
import { NotesControls } from './modes/notes/NotesControls';
import { ProgressionsDeck } from './modes/progressions/ProgressionsDeck';
import { ProgressionsPanel } from './modes/progressions/ProgressionsPanel';
import { useJamCoach } from './modes/progressions/useJamCoach';
import { useProgressionViews } from './modes/progressions/useProgressionViews';
import { useProgressionsState } from './modes/progressions/useProgressionsState';
import {
  ScalesControls,
  ScalesFootnote,
  ScalesOptions,
} from './modes/scales/ScalesControls';
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
import { useDeckGrow } from './modes/useDeckGrow';
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
    chords,
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
  const { playProps, togglePlay, traversalActive, tempo, setTempo, jam, mix, setMixLevel } = usePlayback({
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

  // Progressions, while the loop plays: where to land next, and the prompt of the pass.
  const coach = useJamCoach({
    studyMode,
    steps: progressions.resolvedProgressionSteps,
    jam,
    tempo,
    loop: playProps.options.jamLoop,
    targetsOn: playProps.options.targets,
    promptMode: playProps.options.prompts,
    climbing: jam.playing ? progressions.climb !== null : playProps.options.ladder !== 'off',
    views: progressionViews,
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
  // Home is a place in the frame, not a mode: the app opens on the last mode.
  const [onHome, setOnHome] = useState(false);
  const hasSide = studyMode !== 'notes' && !onHome;
  const frame = useFrameState(hasSide);
  const switchMode = useStudyModeSwitch(modes, audio);
  const homeNav = useHome({
    home: onHome,
    setHome: setOnHome,
    switchMode,
    progressions,
    stopAll: audio.stopAll,
    frame,
  });
  const theoryMoves = useTheoryActions(modes, audio, neck.neckView);

  // Space plays and stops wherever the deck has a Play control.
  usePlaySpace(
    !onHome &&
      studyMode !== 'practice' &&
      studyMode !== 'intervals' &&
      (studyMode !== 'theory' || theory.theoryShowFretboard),
    () => {
      if (!playProps.disabled || playProps.playing) togglePlay();
    },
  );

  const singleRootMode = isSingleRootMode(studyMode);
  // Notes, Chords and Scales: Play sits above the neck, the deck holds the
  // mode's menu and may rise into the empty band under the board.
  const guidedDeck =
    studyMode === 'notes' || studyMode === 'chords' || studyMode === 'scales';
  const deckGrow = useDeckGrow(guidedDeck);
  const drone = useDrone({
    available: studyMode === 'scales',
    root: rootNote,
    volume: audio.volume,
    muted: audio.muted,
  });
  const showPositionSlider =
    singleRootMode &&
    neck.positionRegions.length > 0 &&
    (studyMode !== 'theory' || theory.theoryShowFretboard);
  // The dial, and the vertical neck in its place, take the deck's height; the
  // controls move into the stage. Only a topic with no dial has a fretboard demo.
  const theoryDialShown =
    studyMode === 'theory' && Boolean(theory.activeTheoryTopic.diagram);
  const showFretboard =
    studyMode !== 'practice' &&
    studyMode !== 'intervals' &&
    (studyMode !== 'theory' || theory.theoryShowFretboard);

  const strip = (
    <AppStrip
      studyMode={studyMode}
      home={onHome}
      onHome={homeNav.goHome}
      onStudyModeChange={homeNav.openMode}
      theoryReturn={theory.theoryReturn}
      onBackToTheory={theoryMoves.handleBackToTheory}
      showKey={singleRootMode && studyMode !== 'practice' && !onHome}
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

  const playControl = { ...playProps, onOpenTempo: () => frame.openSettings('tempo') };
  const positionSlider = showPositionSlider ? (
    <PositionSlider
      regions={neck.displayRegions}
      selectedIndex={neck.positionIndex}
      onChange={neck.setPositionIndex}
      spanEndIndex={neck.neckView.spanEndIndex}
      onSpanEndChange={neck.setSpanEndIndex}
      allowRange={neck.neckViewEnabled}
      disabled={progressionViews.climbActive || traversalActive}
    />
  ) : null;

  const neckRegion = (
    <Neck
      centerBar
      bar={
        guidedDeck ? (
          <NeckBar play={<PlayControl {...playControl} menuBelow />}>
            {positionSlider}
          </NeckBar>
        ) : (
          positionSlider
        )
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
          targets={coach.targets}
          targetsArriving={coach.targetsArriving}
          targetsLabel={coach.targetsLabel}
        />
      ) : studyMode === 'theory' ? (
        <TheoryStage
          topic={theory.activeTheoryTopic}
          selectedRoot={rootNote}
          keyMode={keyMode}
          diagramView={theory.theoryDiagramView}
          neckShown={theory.theoryShowKeyNeck}
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
        rootNote={rootNote}
        notation={notation}
        chordQuality={chords.chordQuality}
        onChordQualityChange={chords.setChordQuality}
      />
    ) : studyMode === 'scales' ? (
      <ScalesControls
        rootNote={rootNote}
        notation={notation}
        scaleQuality={scales.scaleQuality}
        onScaleQualityChange={scales.setScaleQuality}
      />
    ) : null;
  const deckOptions =
    studyMode === 'chords' ? (
      <ChordsOptions {...chords} />
    ) : studyMode === 'scales' ? (
      <ScalesOptions
        scaleSystem={scales.scaleSystem}
        shownSystem={neck.shownScaleSystem}
        canSwitchSystem={neck.supportsSystemToggle}
        onScaleSystemChange={scales.setScaleSystem}
        rootLabel={formatNoteDisplay(rootNote, notation)}
        droneOn={drone.on}
        onDroneToggle={drone.toggle}
      />
    ) : undefined;

  // Progressions lays out its own deck: the form strip and the mix faders need its whole height.
  const deck =
    studyMode === 'progressions' ? (
      <ProgressionsDeck
        progressions={progressions}
        jam={jam}
        climb={progressionViews.climbNow}
        prompt={coach.prompt}
        targetsLabel={coach.targetsLabel}
        tempo={tempo}
        play={playControl}
        display={display}
        supportsChordTones={board.supportsChordTones}
        mix={mix}
        onMixChange={setMixLevel}
      />
    ) : (
      <ModeDeck
        controls={controls}
        ownRows={guidedDeck}
        options={deckOptions}
        footnote={studyMode === 'scales' ? <ScalesFootnote /> : undefined}
        playInBar={guidedDeck}
        grow={deckGrow}
        showFretboard={showFretboard}
        showDisplayToggles={showPositionSlider}
        play={playControl}
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
        jamPlaying={jam.playing}
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
      data-vibrato-panels={theme.uiTheme === 'vibrato' ? theme.vibratoPanels : undefined}
      data-on-lava={theme.uiTheme === 'vibrato' ? 'true' : undefined}
      data-contrast={theme.rootContrastMode}
      data-debug-bg={debug.enabled && debug.whiteBackground ? 'white' : undefined}
      data-debug-text={
        debug.enabled ? (debug.whiteText ? 'white' : 'black') : undefined
      }
      style={
        theme.uiTheme === 'vibrato'
          ? ({
              ...theme.ambientStyle,
              // 0 lets the lava show through the panels; 1 fills them.
              '--panel-fill': theme.vibratoPanels === 'off' ? 0 : theme.panelFill,
            } as CSSProperties)
          : undefined
      }
    >
      <AmbientBackground
        style={theme.ambientStyle as CSSProperties}
        motion={theme.ambientMotion}
        light={theme.vibratoCanvas === 'light'}
        exposure={theme.vibratoPanels === 'off' ? 1 : 1 - theme.panelFill}
        enabled={theme.uiTheme === 'vibrato'}
      />
      <Frame
        side={frame.sideState}
        focus={frame.focusMode}
        practice={studyMode === 'practice' && !onHome}
        noDeck={theoryDialShown && !onHome}
        onCloseSide={frame.closeDrawer}
        strip={strip}
        home={
          onHome ? (
            <Home
              lastMode={studyMode}
              explore={homeNav.explore}
              onContinue={() => homeNav.openMode(studyMode)}
              onChoose={homeNav.choose}
            />
          ) : undefined
        }
        neck={onHome || ownsRegions ? undefined : neckRegion}
        deck={onHome || ownsRegions || theoryDialShown ? undefined : deck}
        body={onHome ? undefined : body}
        panel={onHome ? undefined : panel}
        sideWidth={frame.sideWidth}
        onSideWidthChange={frame.setSideWidth}
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
