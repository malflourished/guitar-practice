import type {
  ChordQuality,
  ScaleQuality,
  ScaleSystem,
  StudyMode,
} from '../types/music';
import {
  CHORD_QUALITY_GROUPS,
  PROGRESSION_GROUPS,
  SCALE_QUALITY_GROUPS,
  getChordQualityLabel,
  getQualityLabel,
  type ResolvedProgressionStep,
} from '../lib/music';
import { SettingsRow } from './SettingsList';
import styles from './StudyModeControls.module.css';

const STUDY_MODES: { id: StudyMode; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'arpeggios', label: 'Arpeggios' },
  { id: 'progressions', label: 'Progressions' },
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
  progressionId: string;
  progressionStepIndex: number;
  resolvedSteps: ResolvedProgressionStep[];
  onChordQualityChange: (quality: ChordQuality) => void;
  onScaleQualityChange: (quality: ScaleQuality) => void;
  onScaleSystemChange: (system: ScaleSystem) => void;
  onProgressionChange: (id: string) => void;
  onProgressionStepChange: (index: number) => void;
}

export function StudyModeControls({
  studyMode,
  chordQuality,
  scaleQuality,
  scaleSystem,
  showSystemToggle,
  progressionId,
  progressionStepIndex,
  resolvedSteps,
  onChordQualityChange,
  onScaleQualityChange,
  onScaleSystemChange,
  onProgressionChange,
  onProgressionStepChange,
}: StudyModeControlsProps) {
  const isChordMode = studyMode === 'chords' || studyMode === 'arpeggios';
  const isScaleMode = studyMode === 'scales';
  const isProgressionMode = studyMode === 'progressions';
  const activeStep = resolvedSteps[progressionStepIndex];

  return (
    <>
      {isProgressionMode && (
        <SettingsRow label="Progression">
          <select
            className={styles.select}
            aria-label="Chord progression"
            value={progressionId}
            onChange={(event) => onProgressionChange(event.target.value)}
          >
            {PROGRESSION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.progressions.map((progression) => (
                  <option key={progression.id} value={progression.id}>
                    {progression.nickname
                      ? `${progression.label} (${progression.nickname})`
                      : progression.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </SettingsRow>
      )}

      {isProgressionMode && resolvedSteps.length > 0 && (
        <SettingsRow label="Chord">
          <div className={styles.stepNav}>
            <button
              type="button"
              className={styles.stepButton}
              aria-label="Previous chord"
              disabled={progressionStepIndex === 0}
              onClick={() =>
                onProgressionStepChange(progressionStepIndex - 1)
              }
            >
              ‹
            </button>
            <span className={styles.stepLabel}>
              {activeStep
                ? `${activeStep.chordName} (${activeStep.numeral})`
                : '—'}
            </span>
            <button
              type="button"
              className={styles.stepButton}
              aria-label="Next chord"
              disabled={progressionStepIndex >= resolvedSteps.length - 1}
              onClick={() =>
                onProgressionStepChange(progressionStepIndex + 1)
              }
            >
              ›
            </button>
            <span className={styles.stepCounter} aria-hidden="true">
              {progressionStepIndex + 1} / {resolvedSteps.length}
            </span>
          </div>
        </SettingsRow>
      )}

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
