import type { CSSProperties } from 'react';
import type { AmbientShapeFamily } from '../lib/ambientShapes';
import { ALL_AMBIENT_SHAPE_DEFINITIONS } from '../lib/ambientShapes';
import styles from './AmbientBackground.module.css';

interface AmbientBackgroundProps {
  style: CSSProperties;
  family?: AmbientShapeFamily;
}

export function AmbientBackground({ style, family = 'steppedCove' }: AmbientBackgroundProps) {
  return (
    <div
      className={styles.root}
      data-ambient-family={family}
      style={style as CSSProperties}
      aria-hidden="true"
    >
      <svg className={styles.maskDef} aria-hidden="true" width="0" height="0">
        <defs>
          <filter
            id="ambientMaskBlur"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="0.055" />
          </filter>
          {ALL_AMBIENT_SHAPE_DEFINITIONS.map(({ maskId, colorPaths }) => (
            <mask
              key={maskId}
              id={maskId}
              maskUnits="objectBoundingBox"
              maskContentUnits="objectBoundingBox"
            >
              <rect width="1" height="1" fill="black" />
              {colorPaths.map((colorPath, index) => (
                <path
                  key={`${maskId}-${index}`}
                  d={colorPath}
                  fill="white"
                  filter="url(#ambientMaskBlur)"
                />
              ))}
            </mask>
          ))}
        </defs>
      </svg>

      <div className={styles.ambientArt}>
        <div className={styles.canvasDark} />
        <div className={styles.canvasLight} />

        <div className={styles.glowField}>
          <div className={styles.shapeFill}>
            <div className={styles.fillBase} />
            <div className={styles.fillTop} />
            <div className={styles.fillRight} />
            <div className={styles.fillBody} />
            <div className={styles.fillHook} />
          </div>
        </div>

        <div className={styles.vignette} />
        <div className={styles.bottomFadeDark} />
        <div className={styles.bottomFadeLight} />
        <div className={styles.grain} />
      </div>
    </div>
  );
}
