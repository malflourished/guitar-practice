import { ordinalPosition, type Position } from '../lib/music';
import styles from './PositionSlider.module.css';

interface PositionSliderProps {
  regions: Position[];
  selectedIndex: number;
  onChange: (index: number) => void;
  showFingers: boolean;
  onFingersToggle: () => void;
  disabled?: boolean;
}

export function PositionSlider({
  regions,
  selectedIndex,
  onChange,
  showFingers,
  onFingersToggle,
  disabled = false,
}: PositionSliderProps) {
  if (regions.length === 0) return null;

  const region = regions[selectedIndex];
  const positionLabel = ordinalPosition(region.number);

  return (
    <div className={styles.bar}>
      <div className={styles.sliderRow}>
        <input
          id="fret-position"
          type="range"
          className={disabled ? styles.sliderDisabled : styles.slider}
          min={0}
          max={regions.length - 1}
          value={selectedIndex}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          aria-label="Fretboard position"
          aria-disabled={disabled}
          aria-valuemin={1}
          aria-valuemax={regions.length}
          aria-valuenow={region.number}
          aria-valuetext={`${positionLabel} position, frets ${region.startFret} to ${region.endFret}`}
        />
        <button
          type="button"
          className={
            showFingers ? styles.fingersButtonActive : styles.fingersButton
          }
          aria-pressed={showFingers}
          aria-label="Show fingering"
          onClick={onFingersToggle}
        >
          Fingers
        </button>
      </div>
      <span className={styles.counter} aria-hidden="true">
        {region.number} / {regions.length}
      </span>
    </div>
  );
}
