import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Fretboard } from './components/Fretboard';
import { PositionSlider } from './components/PositionSlider';
import { AudioControls } from './components/AudioControls';
import { ColorDebugPanel } from './components/ColorDebugPanel';
import { AmbientBackground } from './components/AmbientBackground';
import { KeySelector } from './components/KeySelector';
import { useInstrument } from './hooks/useInstrument';
import { orderScalePositions, type ScaleDirection } from './lib/audio/pitch';
import { ALL_NOTES, NOTE_COLORS } from './lib/colors';
import { getFretboardTitle, getRootNote } from './lib/displayTitle';
import {
  getBackgroundKeyForMode,
  getKeyBackgroundStyle,
} from './lib/keyPalette';
import { contrastModeFromBackgroundStyle } from './lib/contrast';
import {
  buildArpeggioPositions,
  buildChordPositions,
  buildScalePositions,
  buildSpellingMap,
  getChordQualityLabel,
  getPositionsForNotes,
  getQualityLabel,
  getSpelledChordNotes,
  getSpelledScaleNotes,
  spelledRootFromNoteName,
  type NotationPreference,
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
import glass from './styles/glass.module.css';
import { useColorBoundary } from './hooks/useColorBoundary';
import './App.css';

function isSingleRootMode(mode: StudyMode): boolean {
  return mode === 'chords' || mode === 'scales' || mode === 'arpeggios';
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
  const [scaleSystem, setScaleSystem] = useState<ScaleSystem>('3nps');
  const [showFingers, setShowFingers] = useState(false);
  const [noteColors, setNoteColors] = useState<Record<NoteName, string>>(
    loadNoteColors,
  );

  const showColorDebug =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === 'colors';

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

  const qualityKey = studyMode === 'scales' ? scaleQuality : chordQuality;
  const qualityLabel =
    studyMode === 'scales'
      ? getQualityLabel(scaleQuality)
      : getChordQualityLabel(chordQuality);

  const supportsSystemToggle =
    studyMode === 'scales' &&
    (scaleQuality === 'major' || scaleQuality === 'minor');

  const positionScope = `${studyMode}-${qualityKey}-${
    supportsSystemToggle ? scaleSystem : 'fixed'
  }`;

  const positionRegions = useMemo(() => {
    if (studyMode === 'chords') {
      return buildChordPositions(rootNote, chordQuality);
    }
    if (studyMode === 'arpeggios') {
      return buildArpeggioPositions(rootNote, chordQuality);
    }
    if (studyMode === 'scales') {
      return buildScalePositions(rootNote, scaleQuality, scaleSystem);
    }
    return [];
  }, [studyMode, rootNote, chordQuality, scaleQuality, scaleSystem]);

  const positionIndex = Math.min(
    positionByScope[positionScope] ?? 0,
    Math.max(0, positionRegions.length - 1),
  );

  const setPositionIndex = (index: number) => {
    setPositionByScope((prev) => ({ ...prev, [positionScope]: index }));
  };

  const activePositionRegion = positionRegions[positionIndex];

  const positions = useMemo(() => {
    if (studyMode === 'notes') {
      return getPositionsForNotes(activeNotes);
    }
    return activePositionRegion ? activePositionRegion.positions : [];
  }, [activeNotes, studyMode, activePositionRegion]);

  const mutedStrings = activePositionRegion?.mutedStrings ?? [];

  const audio = useInstrument();
  const [tempo, setTempo] = useState(90);
  const strumMode = studyMode === 'chords';
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

  const spellingMap = useMemo(() => {
    if (studyMode === 'notes') return null;
    const spelledRoot = spelledRootFromNoteName(rootNote, notation);
    const spelled =
      studyMode === 'scales'
        ? getSpelledScaleNotes(spelledRoot, scaleQuality)
        : getSpelledChordNotes(spelledRoot, chordQuality);
    return buildSpellingMap(spelled);
  }, [studyMode, rootNote, scaleQuality, chordQuality, notation]);

  const title = useMemo(
    () =>
      getFretboardTitle(
        activeNotes,
        studyMode,
        qualityLabel,
        notation,
        activePositionRegion,
      ),
    [activeNotes, studyMode, qualityLabel, notation, activePositionRegion],
  );

  const backgroundKey = useMemo(
    () => getBackgroundKeyForMode(studyMode, activeNotes, rootNote),
    [studyMode, activeNotes, rootNote],
  );

  const ambientStyle = useMemo(
    () =>
      getKeyBackgroundStyle(
        backgroundKey,
        studyMode === 'scales' ? scaleQuality : chordQuality,
        noteColors,
      ),
    [backgroundKey, studyMode, scaleQuality, chordQuality, noteColors],
  );

  const contrastMode = useMemo(
    () => contrastModeFromBackgroundStyle(ambientStyle),
    [ambientStyle],
  );

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
      data-contrast={contrastMode}
      style={ambientStyle as CSSProperties}
    >
      <AmbientBackground style={ambientBackgroundStyle} />
      <div className="app">
        <div className="shell">
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
                onChordQualityChange={setChordQuality}
                onScaleQualityChange={setScaleQuality}
                onScaleSystemChange={setScaleSystem}
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

            <SettingsSection title="Sound">
              <AudioControls
                instrument={audio.instrument}
                volume={audio.volume}
                muted={audio.muted}
                loading={audio.loading}
                canPlay={positions.length > 0}
                sequenceMode={!strumMode}
                playingDirection={audio.playingId as ScaleDirection | null}
                tempo={tempo}
                onInstrumentChange={audio.setInstrument}
                onVolumeChange={audio.setVolume}
                onMutedToggle={() => audio.setMuted(!audio.muted)}
                onTempoChange={setTempo}
                onStrum={handleStrum}
                onPlayScale={handlePlayScale}
              />
            </SettingsSection>
          </SettingsList>
        </div>

        <div className="fretboardStage" ref={fretboardAnchorRef}>
          <Fretboard
            positions={positions}
            title={title}
            notation={notation}
            noteLabels={spellingMap}
            mutedStrings={mutedStrings}
            showFingers={showFingers}
            noteColors={noteColors}
            accentColor="var(--foreground-accent)"
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
            />
          )}
        </div>

        {showColorDebug && (
          <ColorDebugPanel
            noteColors={noteColors}
            onColorChange={(note, color) =>
              setNoteColors((prev) => ({ ...prev, [note]: color }))
            }
            onReset={() => setNoteColors({ ...NOTE_COLORS })}
          />
        )}
      </div>
    </div>
  );
}

export default App;
