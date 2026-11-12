import { SettingsRow } from '../../components/SettingsList';
import styles from '../../components/StudyModeControls.module.css';
import { SCALE_QUALITY_GROUPS, getQualityLabel } from '../../lib/music';
import type { ScaleQuality, ScaleSystem } from '../../types/music';

const SCALE_SYSTEMS: { id: ScaleSystem; label: string }[] = [
  { id: '3nps', label: '3 / String' },
  { id: 'caged', label: 'CAGED' },
];

interface ScalesControlsProps {
  scaleQuality: ScaleQuality;
  scaleSystem: ScaleSystem;
  /** Only major and minor have both a CAGED and a 3-per-string layout. */
  showSystemToggle: boolean;
  onScaleQualityChange: (quality: ScaleQuality) => void;
  onScaleSystemChange: (system: ScaleSystem) => void;
}

/** Scales deck: the scale type and, where offered, the System switch. */
export function ScalesControls({
  scaleQuality,
  scaleSystem,
  showSystemToggle,
  onScaleQualityChange,
  onScaleSystemChange,
}: ScalesControlsProps) {
  return (
    <>
      <SettingsRow label="Type">
        <select
          className={styles.select}
          aria-label="Scale type"
          value={scaleQuality}
          onChange={(event) =>
            onScaleQualityChange(event.target.value as ScaleQuality)
          }
        >
          {SCALE_QUALITY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.qualities.map((quality) => (
                <option key={quality} value={quality}>
                  {getQualityLabel(quality)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </SettingsRow>

      {showSystemToggle && (
        <SettingsRow label="System">
          <div className={styles.modes} role="group" aria-label="Scale system">
            {SCALE_SYSTEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={
                  scaleSystem === id
                    ? styles.modeButtonSelected
                    : styles.modeButton
                }
                aria-pressed={scaleSystem === id}
                onClick={() => onScaleSystemChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </SettingsRow>
      )}
    </>
  );
}
