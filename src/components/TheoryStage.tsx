import type { KeyMode, NoteName, TheoryTopic } from '../types/music';
import { ChordWheel } from './ChordWheel';
import { CircleOfFifths } from './CircleOfFifths';
import styles from './TheoryStage.module.css';

interface TheoryStageProps {
  topic: TheoryTopic;
  selectedRoot: NoteName;
  keyMode: KeyMode;
  showFretboard: boolean;
  onSelectKey: (root: NoteName, mode: KeyMode) => void;
  onShowFretboardChange: (show: boolean) => void;
  onPracticeLink?: () => void;
}

export function TheoryStage({
  topic,
  selectedRoot,
  keyMode,
  showFretboard,
  onSelectKey,
  onShowFretboardChange,
  onPracticeLink,
}: TheoryStageProps) {
  const practiceLabel =
    topic.practiceLink?.mode === 'progressions'
      ? 'Try in Progressions →'
      : topic.practiceLink?.mode === 'scales'
        ? 'Practice this across the neck →'
        : topic.practiceLink?.mode === 'chords'
          ? 'Try in Chords →'
          : null;

  return (
    <section
      className={showFretboard ? styles.stageCompact : styles.stage}
      aria-label={topic.title}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{topic.title}</h2>
        <p className={styles.summary}>{topic.theory.summary}</p>
      </header>

      {topic.diagram === 'circle-of-fifths' ? (
        <div className={showFretboard ? styles.diagramCompact : styles.diagram}>
          <CircleOfFifths
            selectedRoot={selectedRoot}
            keyMode={keyMode}
            onSelectKey={onSelectKey}
          />
        </div>
      ) : null}

      {topic.diagram === 'chord-wheel' ? (
        <div className={showFretboard ? styles.diagramCompact : styles.diagram}>
          <ChordWheel
            selectedRoot={selectedRoot}
            keyMode={keyMode}
            onSelectKey={onSelectKey}
          />
        </div>
      ) : null}

      <div className={styles.actions}>
        {topic.fretboardDemo ? (
          <button
            type="button"
            className={
              showFretboard ? styles.actionButtonSelected : styles.actionButton
            }
            aria-pressed={showFretboard}
            onClick={() => onShowFretboardChange(!showFretboard)}
          >
            {showFretboard ? 'Hide fretboard' : 'Show on fretboard'}
          </button>
        ) : null}
        {practiceLabel && onPracticeLink ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={onPracticeLink}
          >
            {practiceLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
