import { KeyContext } from '../components/KeyContext';
import { SettingsSection } from '../components/SettingsList';
import { PROGRESSIONS, getProgressionById } from '../lib/music';
import type { ChordQuality, KeyMode, NoteName } from '../types/music';
import { RELATIVE_SCALE_QUALITY } from './studyModes';
import type { ModeStates } from './types';

interface KeyContextSectionProps extends ModeStates {
  effectiveKeyMode: KeyMode;
}

/**
 * "This key": the side panel's spine. Every mode reachable from the current
 * key, so each choice here moves the player into another mode.
 */
export function KeyContextSection({
  studyMode,
  setStudyMode,
  keyState,
  chords,
  scales,
  progressions,
  theory,
  effectiveKeyMode,
}: KeyContextSectionProps) {
  const { setActiveNotes, notation, setKeyMode, keyCenter, setKeyCenter } = keyState;
  const { progressionId, setProgressionId, setProgressionStepIndex } =
    progressions;

  const keyModeLocked =
    studyMode === 'scales' || studyMode === 'progressions';

  const handleSelectChord = (root: NoteName, quality: ChordQuality) => {
    setStudyMode('chords');
    setActiveNotes(new Set([root]));
    chords.setChordQuality(quality);
    theory.setTheoryShowFretboard(false);
  };

  const handleSelectScale = () => {
    setStudyMode('scales');
    setActiveNotes(new Set([keyCenter]));
    if (studyMode !== 'scales') {
      scales.setScaleQuality(effectiveKeyMode === 'minor' ? 'minor' : 'major');
    }
    theory.setTheoryShowFretboard(false);
  };

  const handleSelectProgressions = () => {
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
    theory.setTheoryShowFretboard(false);
  };

  const handleSelectRelative = (root: NoteName, mode: KeyMode) => {
    setActiveNotes(new Set([root]));
    setKeyCenter(root);
    setKeyMode(mode);
    if (studyMode === 'scales') {
      const counterpart = RELATIVE_SCALE_QUALITY[scales.scaleQuality];
      if (counterpart) scales.setScaleQuality(counterpart);
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

  const handleExplainChords = () => {
    setStudyMode('theory');
    theory.setTheoryTopicId('diatonic-chords');
    theory.setTheoryShowFretboard(false);
  };

  return (
    <SettingsSection title="This key">
      <KeyContext
        keyRoot={keyCenter}
        keyMode={effectiveKeyMode}
        notation={notation}
        keyModeLocked={keyModeLocked}
        onKeyModeChange={setKeyMode}
        onSelectChord={handleSelectChord}
        onSelectScale={handleSelectScale}
        onSelectProgressions={handleSelectProgressions}
        onSelectRelative={handleSelectRelative}
        onExplainChords={handleExplainChords}
      />
    </SettingsSection>
  );
}
