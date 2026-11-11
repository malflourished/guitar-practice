import { useState } from 'react';
import type {
  KeyMode,
  NoteName,
  TheoryDiagram,
  TheoryTopic,
} from '../types/music';
import { ChordWheel } from './ChordWheel';
import { CircleOfFifths } from './CircleOfFifths';
import styles from './TheoryStage.module.css';

const DIAGRAM_OPTIONS: { id: TheoryDiagram; label: string }[] = [
  { id: 'circle-of-fifths', label: 'Circle of Fifths' },
  { id: 'chord-wheel', label: 'Chord Wheel' },
];

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
  // Initialized from the topic's natural diagram; remounting via key={topic.id}
  // in App.tsx resets this when the active topic changes.
  const [diagramView, setDiagramView] = useState<TheoryDiagram | undefined>(
    topic.diagram,
  );

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
    <section
      className={showFretboard ? styles.stageCompact : styles.stage}
      aria-label={topic.title}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{topic.title}</h2>
        <p className={styles.summary}>{topic.theory.summary}</p>
      </header>

      {diagramView ? (
        <>
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
                onClick={() => setDiagramView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={showFretboard ? styles.diagramCompact : styles.diagram}>
            {diagramView === 'chord-wheel' ? (
              <ChordWheel
                selectedRoot={selectedRoot}
                keyMode={keyMode}
                onSelectKey={onSelectKey}
              />
            ) : (
              <CircleOfFifths
                selectedRoot={selectedRoot}
                keyMode={keyMode}
                onSelectKey={onSelectKey}
              />
            )}
          </div>
        </>
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
