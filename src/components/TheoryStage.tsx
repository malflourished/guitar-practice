import type {
  KeyMode,
  NoteName,
  TheoryDiagram,
  TheoryTopic,
} from '../types/music';
import { KeyDial } from './KeyDial';
import styles from './TheoryStage.module.css';

const DIAGRAM_OPTIONS: { id: TheoryDiagram; label: string }[] = [
  { id: 'in-key', label: 'In key' },
  { id: 'borrowed', label: 'Borrowed' },
  { id: 'dominants', label: 'Dominants' },
];

interface TheoryStageProps {
  topic: TheoryTopic;
  selectedRoot: NoteName;
  keyMode: KeyMode;
  /** The diagram shown, if the topic has one. */
  diagramView?: TheoryDiagram;
  onSelectKey: (root: NoteName, mode: KeyMode) => void;
}

/** The topic's title, summary and diagram: what Theory shows in the neck. */
export function TheoryStage({
  topic,
  selectedRoot,
  keyMode,
  diagramView,
  onSelectKey,
}: TheoryStageProps) {
  return (
    <section className={styles.stage} aria-label={topic.title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{topic.title}</h2>
        <p className={styles.summary}>{topic.theory.summary}</p>
      </header>

      {diagramView ? (
        <div className={styles.diagram}>
          <KeyDial
            selectedRoot={selectedRoot}
            keyMode={keyMode}
            onSelectKey={onSelectKey}
            view={diagramView}
          />
        </div>
      ) : null}
    </section>
  );
}

interface TheoryActionsProps {
  topic: TheoryTopic;
  diagramView?: TheoryDiagram;
  onDiagramViewChange: (view: TheoryDiagram) => void;
  showFretboard: boolean;
  onShowFretboardChange: (show: boolean) => void;
  onPracticeLink?: () => void;
}

/** Theory's controls in the deck: diagram choice, fretboard demo, practice link. */
export function TheoryActions({
  topic,
  diagramView,
  onDiagramViewChange,
  showFretboard,
  onShowFretboardChange,
  onPracticeLink,
}: TheoryActionsProps) {
  const practiceLabel =
    topic.practiceLink?.mode === 'progressions'
      ? 'Try in Progressions →'
      : topic.practiceLink?.mode === 'scales'
        ? 'Practice this across the neck →'
        : topic.practiceLink?.mode === 'chords'
          ? 'Try in Chords →'
          : topic.practiceLink?.mode === 'intervals'
            ? 'Train your ear & eye →'
            : null;

  return (
    <>
      {diagramView && !showFretboard ? (
        <div className={styles.diagramToggle} role="group" aria-label="Diagram">
          {DIAGRAM_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={
                diagramView === id
                  ? styles.diagramToggleSelected
                  : styles.diagramToggleButton
              }
              aria-pressed={diagramView === id}
              onClick={() => onDiagramViewChange(id)}
            >
              {label}
            </button>
          ))}
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
    </>
  );
}
