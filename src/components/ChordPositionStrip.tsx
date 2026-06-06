import type { ChordQuality, NoteName } from '../types/music';
import type { ChordPositionView } from '../lib/music/chordPositionViews';
import type { NotationPreference } from '../lib/music';
import { CHORD_DIAGRAM_LABEL_STYLE, ChordDiagram } from './ChordDiagram';
import styles from './ProgressionStrip.module.css';

interface ChordPositionStripProps {
  positions: ChordPositionView[];
  activeIndex: number;
  notation: NotationPreference;
  showFingers: boolean;
  showNoteLabels: boolean;
  fullDotOpacity: boolean;
  showChordTones: boolean;
  rootNote: NoteName;
  chordQuality: ChordQuality;
  onSelectPosition: (index: number) => void;
}

export function ChordPositionStrip({
  positions,
  activeIndex,
  notation,
  showFingers,
  showNoteLabels,
  fullDotOpacity,
  showChordTones,
  rootNote,
  chordQuality,
  onSelectPosition,
}: ChordPositionStripProps) {
  if (positions.length === 0) return null;

  return (
    <section className={styles.strip} aria-label="Chord position reference">
      <div className={styles.scroll}>
        <div className={styles.row}>
          {positions.map((position) => {
            const isActive = position.index === activeIndex;
            return (
              <div
                key={`${position.positionLabel}-${position.startFret}`}
                role="button"
                tabIndex={0}
                className={isActive ? styles.itemActive : styles.item}
                aria-pressed={isActive}
                aria-label={`${position.chordName}, ${position.positionLabel} position, ${position.index + 1} of ${positions.length}`}
                onClick={() => onSelectPosition(position.index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectPosition(position.index);
                  }
                }}
              >
                <span className={styles.label} style={CHORD_DIAGRAM_LABEL_STYLE}>
                  <span className={styles.numeral}>{position.positionLabel}</span>
                  <span className={styles.chordName}>{position.chordName}</span>
                </span>
                <div className={styles.diagram}>
                  <ChordDiagram
                    positions={position.positions}
                    mutedStrings={position.mutedStrings}
                    startFret={position.startFret}
                    endFret={position.endFret}
                    notation={notation}
                    noteLabels={position.noteLabels}
                    showFingers={showFingers}
                    showNoteLabels={showNoteLabels}
                    fullDotOpacity={fullDotOpacity}
                    showChordTones={showChordTones}
                    rootNote={rootNote}
                    chordQuality={chordQuality}
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
