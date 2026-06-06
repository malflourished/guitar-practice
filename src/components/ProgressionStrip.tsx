import type { NotationPreference, ProgressionChordView } from '../lib/music';
import { ChordDiagram } from './ChordDiagram';
import styles from './ProgressionStrip.module.css';

export type { ProgressionChordView };

interface ProgressionStripProps {
  chords: ProgressionChordView[];
  activeIndex: number;
  notation: NotationPreference;
  showFingers: boolean;
  showNoteLabels: boolean;
  onSelectStep: (index: number) => void;
}

export function ProgressionStrip({
  chords,
  activeIndex,
  notation,
  showFingers,
  showNoteLabels,
  onSelectStep,
}: ProgressionStripProps) {
  if (chords.length === 0) return null;

  return (
    <section className={styles.strip} aria-label="Progression chord reference">
      <div className={styles.scroll}>
        <div className={styles.row}>
          {chords.map((chord, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={`${chord.step.root}-${chord.step.quality}-${index}`}
                role="button"
                tabIndex={0}
                className={isActive ? styles.itemActive : styles.item}
                aria-pressed={isActive}
                aria-label={`${chord.step.chordName} (${chord.step.numeral}), chord ${index + 1} of ${chords.length}`}
                onClick={() => onSelectStep(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectStep(index);
                  }
                }}
              >
                <span className={styles.label}>
                  <span className={styles.numeral}>{chord.step.numeral}</span>
                  <span className={styles.chordName}>{chord.step.chordName}</span>
                </span>
                <div className={styles.diagram}>
                  <ChordDiagram
                    positions={chord.positions}
                    mutedStrings={chord.mutedStrings}
                    startFret={chord.startFret}
                    endFret={chord.endFret}
                    notation={notation}
                    noteLabels={chord.noteLabels}
                    showFingers={showFingers}
                    showNoteLabels={showNoteLabels}
                    rootNote={chord.step.root}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
