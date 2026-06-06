import type { ChordToneShape } from '../lib/music/chordTones';
import styles from './NoteMarker.module.css';

interface NoteMarkerProps {
  cx: number;
  cy: number;
  radius: number;
  shape: ChordToneShape;
  isRoot: boolean;
  fullOpacity?: boolean;
  variant?: 'fretboard' | 'diagram';
}

function trianglePoints(
  cx: number,
  cy: number,
  radius: number,
  direction: 'up' | 'down',
): string {
  const h = radius * 1.05;
  const w = radius * 0.95;
  if (direction === 'up') {
    return `${cx},${cy - h} ${cx - w},${cy + h * 0.55} ${cx + w},${cy + h * 0.55}`;
  }
  return `${cx},${cy + h} ${cx - w},${cy - h * 0.55} ${cx + w},${cy - h * 0.55}`;
}

function squareRect(cx: number, cy: number, radius: number) {
  const side = radius * 1.65;
  const half = side / 2;
  return {
    x: cx - half,
    y: cy - half,
    width: side,
    height: side,
  };
}

function diamondPoints(cx: number, cy: number, radius: number): string {
  const r = radius * 0.92;
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

export function NoteMarker({
  cx,
  cy,
  radius,
  shape,
  isRoot,
  fullOpacity = false,
  variant = 'fretboard',
}: NoteMarkerProps) {
  const emphasize = fullOpacity || isRoot;
  const className = emphasize
    ? variant === 'diagram'
      ? styles.markerRootDiagram
      : styles.markerRoot
    : variant === 'diagram'
      ? styles.markerDiagram
      : styles.marker;

  if (shape === 'square') {
    const rect = squareRect(cx, cy, radius);
    return <rect {...rect} className={className} />;
  }

  if (shape === 'triangle-up') {
    return (
      <polygon
        points={trianglePoints(cx, cy, radius, 'up')}
        className={className}
      />
    );
  }

  if (shape === 'triangle-down') {
    return (
      <polygon
        points={trianglePoints(cx, cy, radius, 'down')}
        className={className}
      />
    );
  }

  if (shape === 'diamond') {
    return <polygon points={diamondPoints(cx, cy, radius)} className={className} />;
  }

  if (shape === 'ring') {
    const ringClass =
      emphasize
        ? variant === 'diagram'
          ? styles.markerRingFullDiagram
          : styles.markerRingFull
        : variant === 'diagram'
          ? styles.markerRingDiagram
          : styles.markerRing;
    return <circle cx={cx} cy={cy} r={radius} className={ringClass} />;
  }

  return <circle cx={cx} cy={cy} r={radius} className={className} />;
}
