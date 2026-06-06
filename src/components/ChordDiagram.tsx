import type { FretPosition, NoteName } from '../types/music';
import {
  STRING_COUNT,
  formatNoteDisplay,
  type NotationPreference,
} from '../lib/music';
import styles from './ChordDiagram.module.css';

const L = {
  left: 16,
  right: 8,
  markerRow: 14,
  stringGap: 12.5,
  fretGap: 16,
  bottom: 6,
};

const gridLeft = L.left;
const gridWidth = (STRING_COUNT - 1) * L.stringGap;
const nutY = L.markerRow + 6;
const VIEW_WIDTH = gridLeft + gridWidth + L.right;
const NOTE_RADIUS = 6;
const BARRE_HEIGHT = 5.5;
const MIN_FRET_ROWS = 4;

interface ChordDiagramProps {
  positions: FretPosition[];
  mutedStrings?: number[];
  startFret?: number;
  endFret?: number;
  notation: NotationPreference;
  noteLabels?: Map<NoteName, string> | null;
  showFingers?: boolean;
}

function fretRowsForRegion(startFret: number, endFret: number): number {
  if (startFret === 0) {
    return Math.max(endFret, MIN_FRET_ROWS);
  }
  return Math.max(endFret - startFret + 1, MIN_FRET_ROWS);
}

/** Low E left, high e right — standard chord chart orientation. */
function stringX(stringIndex: number): number {
  return gridLeft + (STRING_COUNT - 1 - stringIndex) * L.stringGap;
}

function relativeFret(absoluteFret: number, startFret: number): number {
  if (absoluteFret === 0) return 0;
  return startFret === 0 ? absoluteFret : absoluteFret - startFret + 1;
}

function fretWireY(absoluteFret: number, startFret: number): number {
  const rel = relativeFret(absoluteFret, startFret);
  return nutY + rel * L.fretGap;
}

function fretCenterY(absoluteFret: number, startFret: number): number {
  const rel = relativeFret(absoluteFret, startFret);
  return nutY + (rel - 0.5) * L.fretGap;
}

/** True barre: index finger (1) holds 3+ strings at the same fret. */
function isBarreGroup(group: FretPosition[]): boolean {
  if (group.length < 3) return false;
  const fingers = group
    .map((p) => p.finger)
    .filter((f): f is number => f !== undefined && f > 0);
  if (fingers.length < 3) return false;
  return new Set(fingers).size === 1 && fingers[0] === 1;
}

function findBarres(
  positions: FretPosition[],
): { fret: number; minString: number; maxString: number }[] {
  const byFret = new Map<number, FretPosition[]>();
  for (const position of positions) {
    if (position.fret <= 0) continue;
    const group = byFret.get(position.fret) ?? [];
    group.push(position);
    byFret.set(position.fret, group);
  }

  return [...byFret.entries()]
    .filter(([, group]) => isBarreGroup(group))
    .map(([fret, group]) => ({
      fret,
      minString: Math.min(...group.map((p) => p.string)),
      maxString: Math.max(...group.map((p) => p.string)),
    }));
}

export function ChordDiagram({
  positions,
  mutedStrings = [],
  startFret = 0,
  endFret = 4,
  notation,
  noteLabels = null,
  showFingers = false,
}: ChordDiagramProps) {
  const isOpenPosition = startFret === 0;
  const fretRows = fretRowsForRegion(startFret, endFret);
  const viewHeight = nutY + fretRows * L.fretGap + L.bottom;
  const lastVisibleFret = isOpenPosition
    ? fretRows
    : startFret + fretRows - 1;

  const dotLabelText = (note: NoteName, finger?: number) => {
    if (showFingers && finger !== undefined && finger > 0) {
      return String(finger);
    }
    return noteLabels?.get(note) ?? formatNoteDisplay(note, notation);
  };

  const openStrings = new Set(
    positions.filter((p) => p.fret === 0).map((p) => p.string),
  );
  const frettedPositions = positions.filter(
    (p) => p.fret > 0 && p.fret <= lastVisibleFret,
  );
  const barres = findBarres(frettedPositions);
  const barreFrets = new Set(barres.map((b) => b.fret));

  const gridRight = gridLeft + gridWidth;
  const gridBottom = nutY + fretRows * L.fretGap;

  const renderDotLabel = (
    note: NoteName,
    finger: number | undefined,
    cx: number,
    cy: number,
  ) => {
    const label = dotLabelText(note, finger);
    const small = label.length > 1;
    return (
      <text
        x={cx}
        y={cy + (small ? 2.5 : 3)}
        textAnchor="middle"
        className={small ? styles.dotLabelSmall : styles.dotLabel}
      >
        {label}
      </text>
    );
  };

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {isOpenPosition ? (
        <line
          x1={gridLeft}
          y1={nutY}
          x2={gridRight}
          y2={nutY}
          className={styles.nut}
        />
      ) : (
        <>
          <text x={4} y={nutY + 4} className={styles.positionHint}>
            {startFret}
          </text>
          <line
            x1={gridLeft}
            y1={nutY}
            x2={gridRight}
            y2={nutY}
            className={styles.nut}
          />
        </>
      )}

      {Array.from({ length: fretRows }, (_, i) => {
        const absoluteFret = isOpenPosition ? i + 1 : startFret + i;
        return (
          <line
            key={`fret-${absoluteFret}`}
            x1={gridLeft}
            y1={fretWireY(absoluteFret, startFret)}
            x2={gridRight}
            y2={fretWireY(absoluteFret, startFret)}
            className={styles.fretLine}
          />
        );
      })}

      {Array.from({ length: STRING_COUNT }, (_, stringIndex) => (
        <line
          key={`string-${stringIndex}`}
          x1={stringX(stringIndex)}
          y1={nutY}
          x2={stringX(stringIndex)}
          y2={gridBottom}
          className={styles.stringLine}
        />
      ))}

      {mutedStrings.map((stringIndex) => (
        <text
          key={`mute-${stringIndex}`}
          x={stringX(stringIndex)}
          y={L.markerRow}
          textAnchor="middle"
          className={styles.openMutedMarker}
        >
          ×
        </text>
      ))}

      {isOpenPosition &&
        [...openStrings]
          .filter((s) => !mutedStrings.includes(s))
          .map((stringIndex) => (
            <circle
              key={`open-${stringIndex}`}
              cx={stringX(stringIndex)}
              cy={L.markerRow - 1}
              r={3.5}
              className={styles.openMarker}
            />
          ))}

      {barres.map((barre) => {
        const y = fretCenterY(barre.fret, startFret);
        const x1 = stringX(barre.minString) - NOTE_RADIUS;
        const x2 = stringX(barre.maxString) + NOTE_RADIUS;
        const labelPos = frettedPositions.find(
          (p) => p.fret === barre.fret && p.string === barre.maxString,
        );
        return (
          <g key={`barre-${barre.fret}`}>
            <rect
              x={x1}
              y={y - BARRE_HEIGHT / 2}
              width={x2 - x1}
              height={BARRE_HEIGHT}
              rx={BARRE_HEIGHT / 2}
              className={styles.barre}
            />
            {labelPos &&
              renderDotLabel(
                labelPos.note,
                labelPos.finger,
                stringX(barre.maxString),
                y,
              )}
          </g>
        );
      })}

      {frettedPositions
        .filter((position) => !barreFrets.has(position.fret))
        .map((position) => {
          const { string, fret, note, finger } = position;
          const cx = stringX(string);
          const cy = fretCenterY(fret, startFret);

          return (
            <g key={`note-${string}-${fret}`}>
              <circle cx={cx} cy={cy} r={NOTE_RADIUS} className={styles.noteDot} />
              {renderDotLabel(note, finger, cx, cy)}
            </g>
          );
        })}
    </svg>
  );
}
