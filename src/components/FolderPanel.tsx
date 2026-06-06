import { useId, type ReactNode } from 'react';
import styles from './FolderPanel.module.css';

interface FolderPanelProps {
  tab: ReactNode;
  body: ReactNode;
}

/** Glass panel clipped to a file-folder silhouette (tab left, S-curve dip). */
export function FolderPanel({ tab, body }: FolderPanelProps) {
  const clipId = useId().replace(/:/g, '');

  return (
    <div className={styles.wrapper}>
      <svg className={styles.clipDef} aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d="M 0,0.105 L 0,0.035 L 0.30,0.035 C 0.34,0.035 0.38,0.06 0.42,0.105 L 1,0.105 L 1,1 L 0,1 Z" />
          </clipPath>
        </defs>
      </svg>
      <div
        className={styles.panel}
        style={{ clipPath: `url(#${clipId})` }}
      >
        <div className={styles.rim} aria-hidden="true" />
        <div className={styles.inner}>
          <div className={styles.tab}>{tab}</div>
          <div className={styles.body}>{body}</div>
        </div>
      </div>
    </div>
  );
}
