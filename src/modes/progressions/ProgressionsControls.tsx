import { SettingsRow } from '../../components/SettingsList';
import styles from '../../components/StudyModeControls.module.css';
import {
  PROGRESSION_GROUPS,
  type ResolvedProgressionStep,
} from '../../lib/music';

interface ProgressionsControlsProps {
  progressionId: string;
  progressionStepIndex: number;
  resolvedSteps: ResolvedProgressionStep[];
  onProgressionChange: (id: string) => void;
  onProgressionStepChange: (index: number) => void;
}

/** Progressions deck: pick a progression and step through its chords. */
export function ProgressionsControls({
  progressionId,
  progressionStepIndex,
  resolvedSteps,
  onProgressionChange,
  onProgressionStepChange,
}: ProgressionsControlsProps) {
  const activeStep = resolvedSteps[progressionStepIndex];

  return (
    <>
      <SettingsRow label="Progression">
        <select
          className={styles.numeralSelect}
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

      {resolvedSteps.length > 0 && (
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
    </>
  );
}
