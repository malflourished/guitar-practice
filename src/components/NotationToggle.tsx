import type { NotationPreference } from '../lib/music';
import glass from '../styles/glass.module.css';
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
        className={
          notation === 'sharps' ? glass.keyTileActive : glass.keyTile
        }
        aria-pressed={notation === 'sharps'}
        aria-label="Sharps"
        onClick={() => onChange('sharps')}
      >
        ♯
      </button>
      <button
        type="button"
        className={notation === 'flats' ? glass.keyTileActive : glass.keyTile}
        aria-pressed={notation === 'flats'}
        aria-label="Flats"
        onClick={() => onChange('flats')}
      >
        ♭
      </button>
    </div>
  );
}
