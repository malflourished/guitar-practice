import type { ChordQuality, ScaleQuality, StudyMode } from '../types/music';
import {
  CHORD_QUALITY_GROUPS,
  SCALE_QUALITY_GROUPS,
  getChordQualityLabel,
  getQualityLabel,
  type Position,
} from '../lib/music';
import { PositionSlider } from './PositionSlider';
import styles from './StudyModeControls.module.css';

const STUDY_MODES: { id: StudyMode; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'arpeggios', label: 'Arpeggios' },
];

interface StudyModeControlsProps {
  studyMode: StudyMode;
  chordQuality: ChordQuality;
  scaleQuality: ScaleQuality;
  showFingers: boolean;
  positionRegions: Position[];
  positionIndex: number;
  allowedStudyModes: StudyMode[];
  allowedChordQualities: ChordQuality[];
  allowedScaleQualities: ScaleQuality[];
  onStudyModeChange: (mode: StudyMode) => void;
  onChordQualityChange: (quality: ChordQuality) => void;
  onScaleQualityChange: (quality: ScaleQuality) => void;
  onFingersToggle: () => void;
  onPositionChange: (index: number) => void;
}

export function StudyModeControls({
  studyMode,
  chordQuality,
  scaleQuality,
  showFingers,
  positionRegions,
  positionIndex,
  allowedStudyModes,
  allowedChordQualities,
  allowedScaleQualities,
  onStudyModeChange,
  onChordQualityChange,
  onScaleQualityChange,
  onFingersToggle,
  onPositionChange,
}: StudyModeControlsProps) {
  const isChordMode = studyMode === 'chords' || studyMode === 'arpeggios';
  const isScaleMode = studyMode === 'scales';
  const fingersAvailable =
    studyMode === 'chords' ||
    studyMode === 'scales' ||
    studyMode === 'arpeggios';
  const positionSliderEnabled =
    studyMode === 'chords' ||
    studyMode === 'scales' ||
    studyMode === 'arpeggios';

  const visibleModes = STUDY_MODES.filter(({ id }) =>
    allowedStudyModes.includes(id),
  );

  const allowedChordSet = new Set(allowedChordQualities);
  const visibleChordGroups = CHORD_QUALITY_GROUPS.map((group) => ({
    label: group.label,
    qualities: group.qualities.filter((quality) => allowedChordSet.has(quality)),
  })).filter((group) => group.qualities.length > 0);

  const allowedScaleSet = new Set(allowedScaleQualities);
  const visibleScaleGroups = SCALE_QUALITY_GROUPS.map((group) => ({
    label: group.label,
    qualities: group.qualities.filter((quality) => allowedScaleSet.has(quality)),
  })).filter((group) => group.qualities.length > 0);

  return (
    <div className={styles.row}>
      <div className={styles.modeRow}>
        <div className={styles.modes} role="group" aria-label="Study mode">
          {visibleModes.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`${styles.modeButton} ${studyMode === id ? styles.selected : ''}`}
              aria-pressed={studyMode === id}
              onClick={() => onStudyModeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {isChordMode && (
          <select
            className={styles.select}
            aria-label="Chord type"
            value={chordQuality}
            onChange={(event) =>
              onChordQualityChange(event.target.value as ChordQuality)
            }
          >
            {visibleChordGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.qualities.map((quality) => (
                  <option key={quality} value={quality}>
                    {getChordQualityLabel(quality)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        {isScaleMode && (
          <select
            className={styles.select}
            aria-label="Scale type"
            value={scaleQuality}
            onChange={(event) =>
              onScaleQualityChange(event.target.value as ScaleQuality)
            }
          >
            {visibleScaleGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.qualities.map((quality) => (
                  <option key={quality} value={quality}>
                    {getQualityLabel(quality)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        {fingersAvailable && (
          <div className={styles.quality} role="group" aria-label="Fingering">
            <button
              type="button"
              className={`${styles.qualityButton} ${showFingers ? styles.selected : ''}`}
              aria-pressed={showFingers}
              onClick={onFingersToggle}
            >
              Fingers
            </button>
          </div>
        )}
      </div>

      {positionSliderEnabled && positionRegions.length > 0 && (
        <PositionSlider
          regions={positionRegions}
          selectedIndex={positionIndex}
          onChange={onPositionChange}
        />
      )}
    </div>
  );
}
