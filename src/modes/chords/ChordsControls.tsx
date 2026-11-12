import { SettingsRow } from '../../components/SettingsList';
import styles from '../../components/StudyModeControls.module.css';
import {
  CHORD_QUALITY_GROUPS,
  getChordQualityLabel,
} from '../../lib/music';
import type { ChordQuality } from '../../types/music';

interface ChordsControlsProps {
  chordQuality: ChordQuality;
  onChordQualityChange: (quality: ChordQuality) => void;
}

/** Chords deck: the chord type. */
export function ChordsControls({
  chordQuality,
  onChordQualityChange,
}: ChordsControlsProps) {
  return (
    <SettingsRow label="Type">
      <select
        className={styles.select}
        aria-label="Chord type"
        value={chordQuality}
        onChange={(event) =>
          onChordQualityChange(event.target.value as ChordQuality)
        }
      >
        {CHORD_QUALITY_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.qualities.map((quality) => (
              <option key={quality} value={quality}>
                {getChordQualityLabel(quality)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </SettingsRow>
  );
}
