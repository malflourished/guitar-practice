import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Fretboard } from './components/Fretboard';
import { AudioControls } from './components/AudioControls';
import { ColorDebugPanel } from './components/ColorDebugPanel';
import { AmbientBackground } from './components/AmbientBackground';
import { KeySelector } from './components/KeySelector';
import { useInstrument } from './hooks/useInstrument';
import { orderScalePositions, type ScaleDirection } from './lib/audio/pitch';
import { TierSelector } from './components/TierSelector';
import { TIERS, isValidTier } from './lib/tiers';
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
  formatNoteDisplay,
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
  StudyMode,
  Tier,
} from './types/music';
import { StudyModeControls } from './components/StudyModeControls';
import { NotationToggle } from './components/NotationToggle';
import glass from './styles/glass.module.css';
import './App.css';

function isSingleRootMode(mode: StudyMode): boolean {
  return mode === 'chords' || mode === 'scales' || mode === 'arpeggios';
}

function toSingleRoot(notes: Set<NoteName>): Set<NoteName> {
  const selected = ALL_NOTES.filter((note) => notes.has(note));
  return new Set(selected.length > 0 ? [selected[0]] : ['C']);
}

const COLOR_STORAGE_KEY = 'guitar-fretboard-note-colors';
const TIER_STORAGE_KEY = 'guitar-fretboard-tier';

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

function loadTier(): Tier {
  try {
    const raw = localStorage.getItem(TIER_STORAGE_KEY);
    if (isValidTier(raw)) return raw;
  } catch {
    // ignore malformed storage
  }
  return 'basic';
}

function App() {
  const [activeNotes, setActiveNotes] = useState<Set<NoteName>>(new Set(['C']));
  const [notation, setNotation] = useState<NotationPreference>('sharps');
  const [studyMode, setStudyMode] = useState<StudyMode>('notes');
  const [scaleQuality, setScaleQuality] =
    useState<ScaleQuality>('minorPentatonic');
  const [chordQuality, setChordQuality] = useState<ChordQuality>('major');
  const [showFingers, setShowFingers] = useState(false);
  const [tier, setTier] = useState<Tier>(loadTier);
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

  useEffect(() => {
    try {
      localStorage.setItem(TIER_STORAGE_KEY, tier);
    } catch {
      // ignore storage write failures
    }
  }, [tier]);

  const tierConfig = TIERS[tier];
  const [positionByScope, setPositionByScope] = useState<Record<string, number>>(
    {},
  );

  const rootNote = useMemo(() => getRootNote(activeNotes), [activeNotes]);

  const qualityKey = studyMode === 'scales' ? scaleQuality : chordQuality;
  const qualityLabel =
    studyMode === 'scales'
      ? getQualityLabel(scaleQuality)
      : getChordQualityLabel(chordQuality);

  const positionScope = `${studyMode}-${qualityKey}`;

  const positionRegions = useMemo(() => {
    if (studyMode === 'chords') {
      return buildChordPositions(rootNote, chordQuality);
    }
    if (studyMode === 'arpeggios') {
      return buildArpeggioPositions(rootNote, chordQuality);
    }
    if (studyMode === 'scales') {
      return buildScalePositions(rootNote, scaleQuality);
    }
    return [];
  }, [studyMode, rootNote, chordQuality, scaleQuality]);

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

  const heroLetter = useMemo(() => {
    if (studyMode === 'notes' && activeNotes.size !== 1) {
      if (activeNotes.size === 0) return '—';
      if (activeNotes.size === 12) return '♯';
      return formatNoteDisplay(rootNote, notation);
    }
    return formatNoteDisplay(rootNote, notation);
  }, [studyMode, activeNotes.size, rootNote, notation]);

  const handleToggle = (note: NoteName) => {
    setActiveNotes((prev) => {
      if (isSingleRootMode(studyMode)) {
        return new Set([note]);
      }

      const next = new Set(prev);
      if (next.has(note)) {
        next.delete(note);
      } else {
        next.add(note);
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

  const handleTierChange = (next: Tier) => {
    setTier(next);
    const cfg = TIERS[next];
    if (!cfg.studyModes.includes(studyMode)) {
      setStudyMode('notes');
    }
    if (!cfg.chordQualities.includes(chordQuality)) {
      setChordQuality('major');
    }
    if (!cfg.scaleQualities.includes(scaleQuality)) {
      setScaleQuality(cfg.scaleQualities[0]);
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

  return (
    <div
      className="themeRoot"
      data-contrast={contrastMode}
      style={ambientStyle as CSSProperties}
    >
      <AmbientBackground style={ambientStyle} />
      <div className="app">
        <div className="shell">
          <KeySelector
            activeNotes={activeNotes}
            notation={notation}
            singleRootMode={singleRootMode}
            onToggle={handleToggle}
          />

          <div className={`${glass.panel} heroCard`}>
            <div className={glass.panelContent}>
              <p className="heroEyebrow">Guitar Practice</p>
              <div className="heroTop">
                <span className="heroLetter" aria-hidden="true">
                  {heroLetter}
                </span>
                <div className="heroMeta">
                  <TierSelector tier={tier} onChange={handleTierChange} />
                  <NotationToggle
                    notation={notation}
                    onChange={setNotation}
                  />
                </div>
              </div>

              <div className="cardSection">
                <StudyModeControls
                  studyMode={studyMode}
                  chordQuality={chordQuality}
                  scaleQuality={scaleQuality}
                  showFingers={showFingers}
                  positionRegions={positionRegions}
                  positionIndex={positionIndex}
                  allowedStudyModes={tierConfig.studyModes}
                  allowedChordQualities={tierConfig.chordQualities}
                  allowedScaleQualities={tierConfig.scaleQualities}
                  onStudyModeChange={handleStudyModeChange}
                  onChordQualityChange={setChordQuality}
                  onScaleQualityChange={setScaleQuality}
                  onFingersToggle={() => setShowFingers((prev) => !prev)}
                  onPositionChange={setPositionIndex}
                />

                {!singleRootMode && (
                  <div className="secondaryRow shortcuts">
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
                )}

                <div className="soundSection">
                  <span className="soundLabel">Sound</span>
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
                </div>
              </div>
            </div>
          </div>

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
