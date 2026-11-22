import { APP_NAME } from '../lib/brand';
import { WordmarkWave } from './WordmarkWave';
import styles from './WordmarkButton.module.css';

interface WordmarkButtonProps {
  onClick: () => void;
  /** Home is showing, and has the wordmark large: this one stays in view, but is out of the tab order and unannounced. */
  onHome: boolean;
}

/**
 * The strip's wordmark, and the way Home. Below 1220 px the frame hides the
 * full wordmark to make room for the mode tabs (Frame.module.css), so its wave, the
 * ~, stands in for it: Home must stay one click away in every window.
 */
export function WordmarkButton({ onClick, onHome }: WordmarkButtonProps) {
  const name = APP_NAME.slice(0, -1);
  return (
    <button
      type="button"
      className={styles.button}
      aria-label="Home"
      title="Home (Esc)"
      tabIndex={onHome ? -1 : undefined}
      aria-hidden={onHome ? true : undefined}
      data-on-home={onHome ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="wordmark">
        {name}
        <WordmarkWave />
      </span>
      <span className={`wordmark ${styles.short}`} aria-hidden="true">
        <WordmarkWave />
      </span>
    </button>
  );
}
