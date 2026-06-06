import type { NotationPreference } from '../lib/music';
import styles from './NotationToggle.module.css';

interface NotationToggleProps {
  notation: NotationPreference;
  onChange: (notation: NotationPreference) => void;
}

export function NotationToggle({ notation, onChange }: NotationToggleProps) {
  return (
    <div className={styles.container} role="group" aria-label="Note notation">
      <button
        type="button"
        className={`${styles.option} ${notation === 'sharps' ? styles.selected : ''}`}
        aria-pressed={notation === 'sharps'}
        onClick={() => onChange('sharps')}
      >
        Sharps
      </button>
      <button
        type="button"
        className={`${styles.option} ${notation === 'flats' ? styles.selected : ''}`}
        aria-pressed={notation === 'flats'}
        onClick={() => onChange('flats')}
      >
        Flats
      </button>
    </div>
  );
}
