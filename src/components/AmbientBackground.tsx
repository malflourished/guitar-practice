import type { CSSProperties } from 'react';
import type { KeyBackgroundStyle } from '../lib/keyPalette';
import styles from './AmbientBackground.module.css';

interface AmbientBackgroundProps {
  style: KeyBackgroundStyle;
}

export function AmbientBackground({ style }: AmbientBackgroundProps) {
  return (
    <div
      className={styles.root}
      style={style as CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.base} />
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />
      <div className={styles.grain} />
    </div>
  );
}
