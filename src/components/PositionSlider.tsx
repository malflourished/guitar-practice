import { ordinalPosition, type Position } from '../lib/music';
import styles from './PositionSlider.module.css';

interface PositionSliderProps {
  regions: Position[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function PositionSlider({
  regions,
  selectedIndex,
  onChange,
}: PositionSliderProps) {
  if (regions.length === 0) return null;

  const region = regions[selectedIndex];
  const positionLabel = ordinalPosition(region.number);

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="fret-position">
        {positionLabel} Position
        <span className={styles.fretRange}>
          (frets {region.startFret}–{region.endFret})
        </span>
      </label>
      <div className={styles.controls}>
        <input
          id="fret-position"
          type="range"
          className={styles.slider}
          min={0}
          max={regions.length - 1}
          value={selectedIndex}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuemin={1}
          aria-valuemax={regions.length}
          aria-valuenow={region.number}
          aria-valuetext={`${positionLabel} position, frets ${region.startFret} to ${region.endFret}`}
        />
        <span className={styles.counter}>
          {region.number} / {regions.length}
        </span>
      </div>
    </div>
  );
}
