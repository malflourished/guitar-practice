import { APP_NAME } from '../lib/brand';
import {
  HOME_CHOICES,
  continueLabel,
  exploreTeaser,
  type HomeChoiceId,
} from '../lib/home';
import type { ProgressionDef, StudyMode } from '../types/music';
import styles from './Home.module.css';

interface HomeProps {
  /** The mode the app was on: Continue goes back to it. */
  lastMode: StudyMode;
  /** The progression Explore will open. */
  explore: ProgressionDef;
  onContinue: () => void;
  onChoose: (choice: HomeChoiceId) => void;
}

/**
 * Home (roadmap package Q): the wordmark, Continue, and three ways in. It sits
 * straight on the lava or the paper, so it draws no panel of its own; the
 * three choices are outlined like the frame's other regions.
 */
export function Home({ lastMode, explore, onContinue, onChoose }: HomeProps) {
  const teaser = exploreTeaser(explore);
  return (
    <main className={styles.home} data-region="home" aria-label="Home">
      <h1 className={`wordmark ${styles.mark}`} aria-label={APP_NAME.slice(0, -1)}>
        {APP_NAME.slice(0, -1)}
        <span className="wordmarkWave">{APP_NAME.at(-1)}</span>
      </h1>
      <button type="button" className={styles.continue} onClick={onContinue} autoFocus>
        {continueLabel(lastMode)}
      </button>
      <ul className={styles.choices} aria-label="Start here">
        {HOME_CHOICES.map((choice) => (
          <li key={choice.id}>
            <button
              type="button"
              className={styles.choice}
              data-choice={choice.id}
              onClick={() => onChoose(choice.id)}
            >
              <span className={styles.choiceTitle}>{choice.title}</span>
              <span className={styles.choiceBlurb}>{choice.blurb}</span>
              {choice.id === 'explore' && (
                <span className={styles.teaser}>
                  <span className={styles.teaserName}>{teaser.name}</span>
                  <span className={styles.teaserNumerals}>{teaser.numerals}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
