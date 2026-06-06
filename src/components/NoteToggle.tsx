import type { CSSProperties } from 'react';
import type {
  ChordQuality,
  NoteName,
  ScaleQuality,
  StudyMode,
} from '../types/music';
import { ALL_NOTES } from '../lib/colors';
import {
  ENHARMONIC_FLAT,
  formatNoteDisplay,
  isAccidental,
  type NotationPreference,
  type Position,
} from '../lib/music';
import { NotationToggle } from './NotationToggle';
import { StudyModeControls } from './StudyModeControls';
import styles from './NoteToggle.module.css';

interface NoteToggleProps {
  activeNotes: Set<NoteName>;
  notation: NotationPreference;
  noteColors: Record<NoteName, string>;
  studyMode: StudyMode;
  chordQuality: ChordQuality;
  scaleQuality: ScaleQuality;
  showFingers: boolean;
  positionRegions: Position[];
  positionIndex: number;
  allowedStudyModes: StudyMode[];
  allowedChordQualities: ChordQuality[];
  allowedScaleQualities: ScaleQuality[];
  onNotationChange: (notation: NotationPreference) => void;
  onStudyModeChange: (mode: StudyMode) => void;
  onChordQualityChange: (quality: ChordQuality) => void;
  onScaleQualityChange: (quality: ScaleQuality) => void;
  onFingersToggle: () => void;
  onPositionChange: (index: number) => void;
  onToggle: (note: NoteName) => void;
  singleRootMode: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function NoteToggle({
  activeNotes,
  notation,
  noteColors,
  studyMode,
  chordQuality,
  scaleQuality,
  showFingers,
  positionRegions,
  positionIndex,
  allowedStudyModes,
  allowedChordQualities,
  allowedScaleQualities,
  onNotationChange,
  onStudyModeChange,
  onChordQualityChange,
  onScaleQualityChange,
  onFingersToggle,
  onPositionChange,
  onToggle,
  singleRootMode,
  onSelectAll,
  onClearAll,
}: NoteToggleProps) {
  return (
    <div className={styles.container}>
      <NotationToggle notation={notation} onChange={onNotationChange} />
      <div className={styles.buttons}>
        {ALL_NOTES.map((note) => {
          const isActive = activeNotes.has(note);
          const label = formatNoteDisplay(note, notation);
          const altName = ENHARMONIC_FLAT[note];
          return (
            <button
              key={note}
              type="button"
              className={`${styles.noteButton} ${isAccidental(note) ? styles.accidental : ''} ${isActive ? styles.active : styles.inactive}`}
              style={
                {
                  '--note-color': noteColors[note],
                } as CSSProperties
              }
              onClick={() => onToggle(note)}
              aria-pressed={isActive}
              title={
                altName
                  ? `${formatNoteDisplay(note, 'sharps')} = ${formatNoteDisplay(note, 'flats')}`
                  : note
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <StudyModeControls
        studyMode={studyMode}
        chordQuality={chordQuality}
        scaleQuality={scaleQuality}
        showFingers={showFingers}
        positionRegions={positionRegions}
        positionIndex={positionIndex}
        allowedStudyModes={allowedStudyModes}
        allowedChordQualities={allowedChordQualities}
        allowedScaleQualities={allowedScaleQualities}
        onStudyModeChange={onStudyModeChange}
        onChordQualityChange={onChordQualityChange}
        onScaleQualityChange={onScaleQualityChange}
        onFingersToggle={onFingersToggle}
        onPositionChange={onPositionChange}
      />
      {!singleRootMode && (
        <div className={styles.shortcuts}>
          <button type="button" className={styles.shortcutButton} onClick={onSelectAll}>
            All
          </button>
          <button type="button" className={styles.shortcutButton} onClick={onClearAll}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
