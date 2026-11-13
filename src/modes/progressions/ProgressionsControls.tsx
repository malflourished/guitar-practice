import { SettingsRow } from '../../components/SettingsList';
import styles from '../../components/StudyModeControls.module.css';
import { BEATS_PER_BAR } from '../../lib/audio/jamSchedule';
import type { JamLoopState } from './useJamLoop';
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
  /** Where the jam loop is: beat dots and the bar count show while it plays. */
  jam: JamLoopState;
}

/** Progressions deck: pick a progression and step through its chords. */
export function ProgressionsControls({
  progressionId,
  progressionStepIndex,
  resolvedSteps,
  onProgressionChange,
  onProgressionStepChange,
  jam,
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
              disabled={jam.playing || progressionStepIndex === 0}
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
              disabled={jam.playing || progressionStepIndex >= resolvedSteps.length - 1}
              onClick={() =>
                onProgressionStepChange(progressionStepIndex + 1)
              }
            >
              ›
            </button>
            {jam.playing ? (
              <span
                className={styles.stepCounter}
                aria-label={
                  jam.countIn
                    ? `Count-in, beat ${jam.beat + 1}`
                    : `Bar ${jam.stepIndex + 1} of ${resolvedSteps.length}, beat ${jam.beat + 1}`
                }
              >
                <span className={styles.beatDots} aria-hidden="true">
                  {Array.from({ length: BEATS_PER_BAR }, (_, beat) => (
                    <span
                      key={beat}
                      className={
                        beat === jam.beat
                          ? jam.countIn
                            ? styles.beatDotCount
                            : styles.beatDotOn
                          : styles.beatDot
                      }
                    >
                      {beat + 1}
                    </span>
                  ))}
                </span>
                <span aria-hidden="true">
                  {jam.countIn
                    ? 'count-in'
                    : `bar ${jam.stepIndex + 1} / ${resolvedSteps.length}`}
                </span>
              </span>
            ) : (
              <span className={styles.stepCounter} aria-hidden="true">
                {progressionStepIndex + 1} / {resolvedSteps.length}
              </span>
            )}
          </div>
        </SettingsRow>
      )}
    </>
  );
}
