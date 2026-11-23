import type { StudyMode } from '../types/music';
import { Popover } from './Popover';
import glass from '../styles/glass.module.css';
import styles from './StudyModeControls.module.css';

/** What the menu's button reads when none of its tools is open. */
const EXPLORE = 'Explore';

/**
 * The tools for exploring the neck, in one menu. Intervals is drills, nearer
 * to Practice than to the others, so it sits under a rule; the owner keeps it
 * here for now (2026-11-23).
 */
const TOOLS: { id: StudyMode; label: string; apart?: boolean }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'progressions', label: 'Progressions' },
  { id: 'intervals', label: 'Intervals', apart: true },
];

interface StudyModeSelectorProps {
  /** The mode shown; null on Home, where none is. */
  studyMode: StudyMode | null;
  onStudyModeChange: (mode: StudyMode) => void;
}

/**
 * The top strip's three ways in, the same three as Home's cards (owner,
 * 2026-11-23): Practice, a menu of the neck tools, and Theory. The menu's
 * button names the tool that is open and is lit with it.
 */
export function StudyModeSelector({
  studyMode,
  onStudyModeChange,
}: StudyModeSelectorProps) {
  const tool = TOOLS.find(({ id }) => id === studyMode);
  const current = tool?.label ?? EXPLORE;
  const tab = (id: StudyMode, label: string) => (
    <button
      type="button"
      className={studyMode === id ? styles.modeButtonSelected : styles.modeButton}
      aria-pressed={studyMode === id}
      onClick={() => onStudyModeChange(id)}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.modes} role="group" aria-label="Study mode">
      {tab('practice', 'Practice')}
      <Popover
        label={EXPLORE}
        align="start"
        selected={Boolean(tool)}
        buttonClassName={`${styles.toolButton}${tool ? ` ${styles.toolButtonSelected}` : ''}`}
        buttonLabel={
          tool
            ? `${tool.label}. Explore: choose another tool`
            : 'Explore: notes, chords, scales, progressions, intervals'
        }
        button={
          <>
            {/* Every name is set in the one cell and only the current one is
                drawn, so the button is as wide as the longest and Theory,
                beside it, never moves. */}
            <span className={styles.toolName}>
              {[EXPLORE, ...TOOLS.map(({ label }) => label)].map((label) => (
                <span key={label} data-current={label === current ? 'true' : undefined}>
                  {label}
                </span>
              ))}
            </span>
            <svg
              className={styles.caret}
              width="9"
              height="9"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 3.5 5 6.5 8 3.5" />
            </svg>
          </>
        }
      >
        {(close) => (
          <div className={styles.toolMenu} role="group" aria-label="Explore">
            {TOOLS.map(({ id, label, apart }) => (
              <button
                key={id}
                type="button"
                className={`${studyMode === id ? glass.pillSelected : glass.pill} ${styles.toolItem}`}
                data-apart={apart ? 'true' : undefined}
                aria-pressed={studyMode === id}
                onClick={() => {
                  onStudyModeChange(id);
                  close();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </Popover>
      {tab('theory', 'Theory')}
    </div>
  );
}
