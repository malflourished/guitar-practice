import { useEffect, useMemo, useState } from 'react';
import { Fretboard } from './components/Fretboard';
import { NoteToggle } from './components/NoteToggle';
import { AudioControls } from './components/AudioControls';
import { ColorDebugPanel } from './components/ColorDebugPanel';
import { useInstrument } from './hooks/useInstrument';
import { orderScalePositions, type ScaleDirection } from './lib/audio/pitch';
import { TierSelector } from './components/TierSelector';
import { TIERS, isValidTier } from './lib/tiers';
import { ALL_NOTES, NOTE_COLORS } from './lib/colors';
import { getFretboardTitle, getRootNote } from './lib/displayTitle';
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
  StudyMode,
  Tier,
} from './types/music';
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

  // The quality key + label depend on which family the current mode uses.
  const qualityKey = studyMode === 'scales' ? scaleQuality : chordQuality;
  const qualityLabel =
    studyMode === 'scales'
      ? getQualityLabel(scaleQuality)
      : getChordQualityLabel(chordQuality);

  // Note: rootNote is intentionally excluded so the position index is kept
  // when switching keys (e.g. staying in 3rd position) instead of resetting.
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

    // Chords, arpeggios, and scales are shown one position at a time.
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
    // Snap any now-hidden selection back to a safe default.
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

  return (
    <div className="app">
      <div className="controls">
        <div className="tierRow">
          <TierSelector tier={tier} onChange={handleTierChange} />
        </div>
        <NoteToggle
          activeNotes={activeNotes}
          notation={notation}
          noteColors={noteColors}
          studyMode={studyMode}
          chordQuality={chordQuality}
          scaleQuality={scaleQuality}
          showFingers={showFingers}
          positionRegions={positionRegions}
          positionIndex={positionIndex}
          allowedStudyModes={tierConfig.studyModes}
          allowedChordQualities={tierConfig.chordQualities}
          allowedScaleQualities={tierConfig.scaleQualities}
          onNotationChange={setNotation}
          onStudyModeChange={handleStudyModeChange}
          singleRootMode={isSingleRootMode(studyMode)}
          onChordQualityChange={setChordQuality}
          onScaleQualityChange={setScaleQuality}
          onFingersToggle={() => setShowFingers((prev) => !prev)}
          onPositionChange={setPositionIndex}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />
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
      <Fretboard
        positions={positions}
        title={title}
        notation={notation}
        noteLabels={spellingMap}
        mutedStrings={mutedStrings}
        showFingers={showFingers}
        noteColors={noteColors}
        onPlayNote={audio.muted ? undefined : audio.playPosition}
        activePosition={audio.playingPosition}
      />
      <ColorDebugPanel
        noteColors={noteColors}
        onColorChange={(note, color) =>
          setNoteColors((prev) => ({ ...prev, [note]: color }))
        }
        onReset={() => setNoteColors({ ...NOTE_COLORS })}
      />
    </div>
  );
}

export default App;
