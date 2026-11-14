import styles from '../../components/StudyModeControls.module.css';
import { BEATS_PER_BAR } from '../../lib/audio/jamSchedule';
import { formatNextChange } from './formLayout';
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
  /** Where the jam loop is: the beat dots, the pass count and the next change show while it plays. */
  jam: JamLoopState;
  /**
   * While "Move along the neck" plays: where this pass is on the neck and what
   * comes next, for the beat row's spoken label. The form strip shows it.
   */
  climbText: string;
  /** The loop goes round and round (Loop is on), so the next change may be round the top. */
  loop: boolean;
}

/**
 * Progressions deck, the left column: pick a progression, step through its
 * chords, and while the loop plays see the next change coming, the beat and
 * the pass. Where the loop is in the form is the form strip's job.
 *
 * It returns grid cells, not a block: the deck's left column is a grid with
 * the labels in its first column and the controls in its second.
 */
export function ProgressionsControls({
  progressionId,
  progressionStepIndex,
  resolvedSteps,
  onProgressionChange,
  onProgressionStepChange,
  jam,
  climbText,
  loop,
}: ProgressionsControlsProps) {
  const activeStep = resolvedSteps[progressionStepIndex];
  // With Loop off the last bar has no change coming: the music stops there.
  const next =
    jam.playing && !jam.countIn && jam.next && (loop || jam.next.stepIndex > jam.stepIndex)
      ? jam.next
      : null;
  const nextStep = next ? resolvedSteps[next.stepIndex] : undefined;
  // The last beat before a change: the next chord's name brightens.
  const arriving = jam.changeComing && jam.beat === BEATS_PER_BAR - 1;

  return (
    <>
      <span className={styles.deckLabel}>Progression</span>
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

      {resolvedSteps.length > 0 && (
        <>
          <span className={styles.deckLabel}>Chord</span>
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
            {next && nextStep && (
              <span
                className={arriving ? styles.nextChangeArriving : styles.nextChange}
                data-arriving={arriving ? 'true' : undefined}
              >
                <span aria-hidden="true">→ </span>
                {formatNextChange(nextStep.chordName, next.bars)}
              </span>
            )}
          </div>

          {/* One row's height in every state, so nothing moves when the loop starts. */}
          <div
            className={styles.beatRow}
            aria-label={
              jam.playing
                ? jam.countIn
                  ? `Count-in, beat ${jam.beat + 1}`
                  : `Bar ${jam.stepIndex + 1} of ${resolvedSteps.length}, beat ${jam.beat + 1}${jam.pass > 0 ? `, pass ${jam.pass + 1}` : ''}${climbText ? `, ${climbText}` : ''}`
                : undefined
            }
          >
            {jam.playing && (
              <>
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
                  {jam.countIn ? 'count-in' : jam.pass > 0 ? `pass ${jam.pass + 1}` : ''}
                </span>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
