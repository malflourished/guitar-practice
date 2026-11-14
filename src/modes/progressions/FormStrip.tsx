import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { BEATS_PER_BAR, type JamChord } from '../../lib/audio/jamSchedule';
import type { ResolvedProgressionStep } from '../../lib/music';
import { formLines, repeatedBars } from './formLayout';
import type { JamLoopState } from './useJamLoop';
import styles from './FormStrip.module.css';

interface FormStripProps {
  steps: readonly ResolvedProgressionStep[];
  /** The same steps as chords, for telling a repeat from a change. */
  chords: readonly JamChord[];
  /** The step the stepper has selected: the lit cell while stopped. */
  selectedIndex: number;
  jam: JamLoopState;
  /** Beats a minute: how fast the playhead crosses a beat. */
  tempo: number;
  /**
   * A line of small text under the strip, for what is not a bar of the form:
   * where "Move along the neck" has the hand now, and what happens next. It
   * hangs in the deck's free space and moves nothing.
   */
  caption?: string;
  /** Select a step. Cells do nothing while the loop plays. */
  onSelect: (index: number) => void;
}

/**
 * The form as a lead sheet: one cell per bar, four bars to a line. Each cell
 * has the chord symbol with its Roman numeral small underneath, and a chord
 * that only repeats is written again in a dimmer tone so the changes stand
 * out. While the loop sounds, the current bar is lit and a thin playhead
 * crosses it with the beat. Stopped, a click selects that step, as the
 * stepper does.
 */
export function FormStrip({ steps, chords, selectedIndex, jam, tempo, caption, onSelect }: FormStripProps) {
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const repeats = repeatedBars(chords);
  const lines = formLines(steps.length);
  const starts = lines.map((_, line) => lines.slice(0, line).reduce((sum, count) => sum + count, 0));
  // The count-in is not a bar of the form: the first cell stays merely selected.
  const sounding = jam.playing && !jam.countIn;
  const activeIndex = sounding ? jam.stepIndex : selectedIndex;
  const beatSeconds = 60 / Math.max(1, tempo);

  const select = (index: number) => {
    if (index < 0 || index >= steps.length) return;
    onSelect(index);
    cells.current[index]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target =
      event.key === 'ArrowRight' ? index + 1
        : event.key === 'ArrowLeft' ? index - 1
          : event.key === 'Home' ? 0
            : event.key === 'End' ? steps.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    select(target);
  };

  if (steps.length === 0) return null;
  return (
    <div className={styles.strip} role="group" aria-label="Form: one bar to a cell">
      {lines.map((count, line) => (
        <div key={line} className={styles.line}>
          {steps.slice(starts[line], starts[line] + count).map((step, offset) => {
            const index = starts[line] + offset;
            const lit = index === activeIndex;
            return (
              <button
                key={index}
                ref={(element) => {
                  cells.current[index] = element;
                }}
                type="button"
                className={styles.cell}
                data-lit={lit ? 'true' : undefined}
                data-repeat={repeats[index] ? 'true' : undefined}
                aria-current={lit ? 'step' : undefined}
                aria-label={`Bar ${index + 1}: ${step.chordName}, ${step.numeral}`}
                disabled={jam.playing}
                tabIndex={index === selectedIndex ? 0 : -1}
                onClick={() => onSelect(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className={styles.chord}>{step.chordName}</span>
                <span className={styles.numeral}>{step.numeral}</span>
                {sounding && lit && (
                  // A new playhead each beat, so it starts the beat where the beat starts
                  // and is always right after a tempo change.
                  <span
                    key={`${jam.bar}-${jam.beat}`}
                    className={styles.playhead}
                    aria-hidden="true"
                    style={
                      {
                        '--from': `${(jam.beat / BEATS_PER_BAR) * 100}%`,
                        '--to': `${((jam.beat + 1) / BEATS_PER_BAR) * 100}%`,
                        '--beat': `${beatSeconds}s`,
                      } as CSSProperties
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
      {caption && (
        <p className={styles.caption} aria-hidden="true">
          {caption}
        </p>
      )}
    </div>
  );
}
