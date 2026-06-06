import type { TheoryContent } from '../types/music';
import styles from './TheoryPanel.module.css';

interface TheoryPanelProps {
  theory: TheoryContent;
  currentStepLabel?: string;
  currentStepRole?: string;
  resolvedChords?: string;
}

export function TheoryPanel({
  theory,
  currentStepLabel,
  currentStepRole,
  resolvedChords,
}: TheoryPanelProps) {
  return (
    <details className={styles.contentWrapper}>
      <summary className={styles.toggle}>
        <span>{theory.title}</span>
        <span className={styles.toggleIcon} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.content}>
        {currentStepLabel && (
          <div className={styles.currentStep}>
            <p className={styles.currentStepLabel}>Current chord</p>
            <p className={styles.currentStepValue}>{currentStepLabel}</p>
            {currentStepRole ? (
              <p className={styles.paragraph}>{currentStepRole}</p>
            ) : null}
          </div>
        )}

        {resolvedChords ? (
          <p className={styles.paragraph}>
            <span className={styles.exampleLabel}>In this key: </span>
            {resolvedChords}
          </p>
        ) : null}

        {theory.body.map((paragraph) => (
          <p key={paragraph} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}

        {theory.examples && theory.examples.length > 0 ? (
          <>
            <h3 className={styles.subheading}>Examples</h3>
            <ul className={styles.list}>
              {theory.examples.map((example) => (
                <li key={example.label} className={styles.listItem}>
                  <span className={styles.exampleLabel}>{example.label}: </span>
                  {example.chords}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {theory.functions && theory.functions.length > 0 ? (
          <>
            <h3 className={styles.subheading}>Chord functions</h3>
            <ul className={styles.list}>
              {theory.functions.map((fn) => (
                <li key={fn.numeral} className={styles.listItem}>
                  <span className={styles.numeral}>{fn.numeral}</span>
                  {' — '}
                  {fn.role}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
