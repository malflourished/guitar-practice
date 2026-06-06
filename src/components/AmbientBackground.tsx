import type { CSSProperties } from 'react';
import styles from './AmbientBackground.module.css';

interface AmbientBackgroundProps {
  style: CSSProperties;
}

export function AmbientBackground({ style }: AmbientBackgroundProps) {
  return (
    <div
      className={styles.root}
      style={style as CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.glowField}>
        <div className={styles.pillarShell}>
          <div className={styles.pillarCore} />
        </div>
        <div className={styles.blobShell1}>
          <div className={styles.blobCore1} />
        </div>
        <div className={styles.blobShell2}>
          <div className={styles.blobCore2} />
        </div>
        <div className={styles.blobShell3}>
          <div className={styles.blobCore3} />
        </div>
      </div>
      <div className={styles.vignette} />
      <div className={styles.bottomFade} />
      <div className={styles.grain} />
    </div>
  );
}
