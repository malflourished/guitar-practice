import type {
  ChordQuality,
  ScaleQuality,
  ScaleSystem,
  StudyMode,
} from '../types/music';
import {
  CHORD_QUALITY_GROUPS,
  SCALE_QUALITY_GROUPS,
  getChordQualityLabel,
  getQualityLabel,
} from '../lib/music';
import { SettingsRow } from './SettingsList';
import styles from './StudyModeControls.module.css';

const STUDY_MODES: { id: StudyMode; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'arpeggios', label: 'Arpeggios' },
];

interface StudyModeSelectorProps {
  studyMode: StudyMode;
  onStudyModeChange: (mode: StudyMode) => void;
}

export function StudyModeSelector({
  studyMode,
  onStudyModeChange,
}: StudyModeSelectorProps) {
  return (
    <div className={styles.modes} role="group" aria-label="Study mode">
      {STUDY_MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={
            studyMode === id ? styles.modeButtonSelected : styles.modeButton
          }
          aria-pressed={studyMode === id}
          onClick={() => onStudyModeChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const SCALE_SYSTEMS: { id: ScaleSystem; label: string }[] = [
  { id: '3nps', label: '3 / String' },
  { id: 'caged', label: 'CAGED' },
];

interface StudyModeControlsProps {
  studyMode: StudyMode;
  chordQuality: ChordQuality;
  scaleQuality: ScaleQuality;
  scaleSystem: ScaleSystem;
  showSystemToggle: boolean;
  onChordQualityChange: (quality: ChordQuality) => void;
  onScaleQualityChange: (quality: ScaleQuality) => void;
  onScaleSystemChange: (system: ScaleSystem) => void;
}

export function StudyModeControls({
  studyMode,
  chordQuality,
  scaleQuality,
  scaleSystem,
  showSystemToggle,
  onChordQualityChange,
  onScaleQualityChange,
  onScaleSystemChange,
}: StudyModeControlsProps) {
  const isChordMode = studyMode === 'chords' || studyMode === 'arpeggios';
  const isScaleMode = studyMode === 'scales';

  return (
    <>
      {isChordMode && (
        <SettingsRow label="Type">
          <select
            className={styles.select}
            aria-label="Chord type"
            value={chordQuality}
            onChange={(event) =>
              onChordQualityChange(event.target.value as ChordQuality)
            }
          >
            {CHORD_QUALITY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.qualities.map((quality) => (
                  <option key={quality} value={quality}>
                    {getChordQualityLabel(quality)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </SettingsRow>
      )}

      {isScaleMode && (
        <SettingsRow label="Type">
          <select
            className={styles.select}
            aria-label="Scale type"
            value={scaleQuality}
            onChange={(event) =>
              onScaleQualityChange(event.target.value as ScaleQuality)
            }
          >
            {SCALE_QUALITY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.qualities.map((quality) => (
                  <option key={quality} value={quality}>
                    {getQualityLabel(quality)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </SettingsRow>
      )}

      {isScaleMode && showSystemToggle && (
        <SettingsRow label="System">
          <div className={styles.modes} role="group" aria-label="Scale system">
            {SCALE_SYSTEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={
                  scaleSystem === id
                    ? styles.modeButtonSelected
                    : styles.modeButton
                }
                aria-pressed={scaleSystem === id}
                onClick={() => onScaleSystemChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </SettingsRow>
      )}
    </>
  );
}
