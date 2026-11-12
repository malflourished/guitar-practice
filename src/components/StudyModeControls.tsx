import type { StudyMode } from '../types/music';
import styles from './StudyModeControls.module.css';

const STUDY_MODES: { id: StudyMode; label: string }[] = [
  { id: 'practice', label: 'Practice' },
  { id: 'notes', label: 'Notes' },
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'progressions', label: 'Progressions' },
  { id: 'intervals', label: 'Intervals' },
  { id: 'theory', label: 'Theory' },
];

interface StudyModeSelectorProps {
  studyMode: StudyMode;
  onStudyModeChange: (mode: StudyMode) => void;
}

export function StudyModeSelector({
  studyMode,
  onStudyModeChange,
}: StudyModeSelectorProps) {
  return (
    <div className={styles.modes} role="group" aria-label="Study mode">
      {STUDY_MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={
            studyMode === id ? styles.modeButtonSelected : styles.modeButton
          }
          aria-pressed={studyMode === id}
          onClick={() => onStudyModeChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
