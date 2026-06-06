import type { ChordQuality, FretPosition, NoteName } from '../types/music';
import {
  FRET_COUNT,
  STRING_COUNT,
  formatNoteDisplay,
  getChordToneForNote,
  samePitchClass,
  type NotationPreference,
} from '../lib/music';
import { NoteMarker } from './NoteMarker';
import styles from './ChordDiagram.module.css';

const L = {
  fretLabel: 14,
  gridPad: 5,
  right: 6,
  markerRow: 17,
  stringGap: 13.5,
  fretGap: 21,
  bottom: 10,
};

const gridLeft = L.fretLabel + L.gridPad;
const gridWidth = (STRING_COUNT - 1) * L.stringGap;
const nutY = L.markerRow + 9;
const VIEW_WIDTH = gridLeft + gridWidth + L.right;
const DOT_RADIUS = 4.25;
const NUT_HEIGHT = 5;
const MARKER_GAP_ABOVE_NUT = 3;
const BARRE_HEIGHT = 6;
/** Matches .stringLine stroke-width in ChordDiagram.module.css */
const STRING_STROKE = 1;
const MIN_FRET_ROWS = 4;
const FRET_INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_INLAY_FRETS = new Set([12, 24]);

interface ChordDiagramProps {
  positions: FretPosition[];
  mutedStrings?: number[];
  startFret?: number;
  endFret?: number;
  notation: NotationPreference;
  noteLabels?: Map<NoteName, string> | null;
  showFingers?: boolean;
  showNoteLabels?: boolean;
  fullDotOpacity?: boolean;
  showChordTones?: boolean;
  rootNote?: NoteName | null;
  chordQuality?: ChordQuality | null;
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

function barreSpanX(
  minString: number,
  maxString: number,
): { x1: number; x2: number } {
  const leftString = Math.max(minString, maxString);
  const rightString = Math.min(minString, maxString);
  return {
    x1: stringX(leftString) - DOT_RADIUS,
    x2: stringX(rightString) + DOT_RADIUS,
  };
}

function fretWireY(
  absoluteFret: number,
  startFret: number,
  isOpenPosition: boolean,
): number {
  if (isOpenPosition) {
    return nutY + absoluteFret * L.fretGap;
  }
  return nutY + (absoluteFret - startFret) * L.fretGap;
}

function fretCenterY(
  absoluteFret: number,
  startFret: number,
  isOpenPosition: boolean,
): number {
  if (isOpenPosition) {
    return nutY + (absoluteFret - 0.5) * L.fretGap;
  }
  return nutY + (absoluteFret - startFret + 0.5) * L.fretGap;
}

/** Fret wires to draw — open-bottom window unless the view ends at the 24th fret. */
function diagramFretWires(
  startFret: number,
  fretRows: number,
  isOpenPosition: boolean,
  endsAtNeckEnd: boolean,
): number[] {
  if (endsAtNeckEnd) {
    const from = isOpenPosition ? 1 : startFret;
    return Array.from({ length: fretRows }, (_, i) => from + i);
  }
  if (isOpenPosition) {
    return Array.from({ length: fretRows - 1 }, (_, i) => i + 1);
  }
  return Array.from({ length: fretRows }, (_, i) => startFret + i);
}

function fretLabelX(): number {
  return L.fretLabel / 2 + 1;
}

function visibleFretInlays(
  startFret: number,
  lastVisibleFret: number,
  isOpenPosition: boolean,
): number[] {
  const minFret = isOpenPosition ? 1 : startFret;
  return FRET_INLAY_FRETS.filter(
    (fret) => fret >= minFret && fret <= lastVisibleFret,
  );
}

function neckCenterX(): number {
  return gridLeft + gridWidth / 2;
}

function nutSpanX(): { x: number; width: number } {
  const pad = STRING_STROKE / 2;
  const x1 = stringX(5) - pad;
  const x2 = stringX(0) + pad;
  return { x: x1, width: x2 - x1 };
}

function inlayCentersX(fret: number): number[] {
  const center = neckCenterX();
  if (DOUBLE_INLAY_FRETS.has(fret)) {
    const offset = L.stringGap;
    return [center - offset, center + offset];
  }
  return [center];
}

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
  showNoteLabels = true,
  fullDotOpacity = false,
  showChordTones = false,
  rootNote = null,
  chordQuality = null,
}: ChordDiagramProps) {
  const isOpenPosition = startFret === 0;
  const fretRows = fretRowsForRegion(startFret, endFret);
  const viewHeight = nutY + fretRows * L.fretGap + L.bottom;
  const lastVisibleFret = isOpenPosition
    ? fretRows
    : Math.min(startFret + fretRows - 1, FRET_COUNT);
  const endsAtNeckEnd = lastVisibleFret === FRET_COUNT;

  const chordToneContext =
    showChordTones && rootNote && chordQuality
      ? { root: rootNote, quality: chordQuality }
      : null;

  const dotClass = (note: NoteName) => {
    if (fullDotOpacity) return styles.noteDotRoot;
    return rootNote && samePitchClass(note, rootNote)
      ? styles.noteDotRoot
      : styles.noteDot;
  };

  const dotLabelText = (note: NoteName, finger?: number) => {
    if (showFingers && finger !== undefined && finger > 0) {
      return String(finger);
    }
    if (chordToneContext) {
      const tone = getChordToneForNote(
        chordToneContext.root,
        note,
        chordToneContext.quality,
      );
      if (tone) return tone.label;
    }
    return noteLabels?.get(note) ?? formatNoteDisplay(note, notation);
  };

  const renderNoteMarker = (note: NoteName, cx: number, cy: number) => {
    if (chordToneContext) {
      const tone = getChordToneForNote(
        chordToneContext.root,
        note,
        chordToneContext.quality,
      );
      return (
        <NoteMarker
          cx={cx}
          cy={cy}
          radius={DOT_RADIUS}
          shape={tone?.shape ?? 'circle'}
          isRoot={tone?.isRoot ?? false}
          fullOpacity={fullDotOpacity}
          variant="diagram"
        />
      );
    }

    return (
      <circle cx={cx} cy={cy} r={DOT_RADIUS} className={dotClass(note)} />
    );
  };

  const openByString = new Map(
    positions
      .filter((p) => p.fret === 0)
      .map((p) => [p.string, p] as const),
  );
  const frettedPositions = positions.filter(
    (p) => p.fret > 0 && p.fret <= lastVisibleFret,
  );
  const barres = findBarres(frettedPositions);

  const gridRight = gridLeft + gridWidth;
  const gridBottom = nutY + fretRows * L.fretGap;
  const fretInlays = visibleFretInlays(startFret, lastVisibleFret, isOpenPosition);
  const markerY =
    nutY - NUT_HEIGHT - DOT_RADIUS - MARKER_GAP_ABOVE_NUT;

  const isRingMarker = (note: NoteName) => {
    if (!chordToneContext) return false;
    const tone = getChordToneForNote(
      chordToneContext.root,
      note,
      chordToneContext.quality,
    );
    return tone?.shape === 'ring';
  };

  const dotLabelClass = (note: NoteName, label: string) => {
    const small = label.length > 1;
    if (isRingMarker(note)) {
      return small ? styles.dotLabelOnRingSmall : styles.dotLabelOnRing;
    }
    return small ? styles.dotLabelSmall : styles.dotLabel;
  };

  const renderDotLabel = (
    note: NoteName,
    finger: number | undefined,
    cx: number,
    cy: number,
  ) => {
    if (!showNoteLabels) return null;

    const label = dotLabelText(note, finger);
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className={dotLabelClass(note, label)}
      >
        {label}
      </text>
    );
  };

  const fretWireNumbers = diagramFretWires(
    startFret,
    fretRows,
    isOpenPosition,
    endsAtNeckEnd,
  );
  const nutSpan = nutSpanX();

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {isOpenPosition && (
        <rect
          x={nutSpan.x}
          y={nutY - NUT_HEIGHT}
          width={nutSpan.width}
          height={NUT_HEIGHT}
          className={styles.nut}
        />
      )}

      {!isOpenPosition && (
        <text
          x={fretLabelX()}
          y={fretCenterY(startFret, startFret, isOpenPosition)}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.positionHint}
        >
          {startFret}
        </text>
      )}

      {fretWireNumbers.map((absoluteFret, index) => {
        const isClosingWire =
          endsAtNeckEnd &&
          index === fretWireNumbers.length - 1 &&
          absoluteFret === FRET_COUNT;
        const y = isClosingWire
          ? gridBottom
          : fretWireY(absoluteFret, startFret, isOpenPosition);
        return (
          <line
            key={`fret-${absoluteFret}`}
            x1={gridLeft}
            y1={y}
            x2={gridRight}
            y2={y}
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

      {fretInlays.flatMap((fret) =>
        inlayCentersX(fret).map((cx, index) => (
          <circle
            key={`inlay-${fret}-${index}`}
            cx={cx}
            cy={fretCenterY(fret, startFret, isOpenPosition)}
            r={1.75}
            className={styles.fretInlay}
          />
        )),
      )}

      {mutedStrings.map((stringIndex) => (
        <text
          key={`mute-${stringIndex}`}
          x={stringX(stringIndex)}
          y={markerY}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.muteMarker}
        >
          ×
        </text>
      ))}

      {[...openByString.entries()]
        .filter(([stringIndex]) => !mutedStrings.includes(stringIndex))
        .map(([stringIndex, position]) => {
          const cx = stringX(stringIndex);
          return (
            <g key={`open-${stringIndex}`}>
              {renderNoteMarker(position.note, cx, markerY)}
              {renderDotLabel(position.note, position.finger, cx, markerY)}
            </g>
          );
        })}

      {barres.map((barre) => {
        const y = fretCenterY(barre.fret, startFret, isOpenPosition);
        const { x1, x2 } = barreSpanX(barre.minString, barre.maxString);
        return (
          <rect
            key={`barre-${barre.fret}`}
            x={x1}
            y={y - BARRE_HEIGHT / 2}
            width={x2 - x1}
            height={BARRE_HEIGHT}
            rx={BARRE_HEIGHT / 2}
            className={styles.barre}
          />
        );
      })}

      {frettedPositions.map((position) => {
        const { string, fret, note, finger } = position;
        const cx = stringX(string);
        const cy = fretCenterY(fret, startFret, isOpenPosition);

        return (
          <g key={`note-${string}-${fret}`}>
            {renderNoteMarker(note, cx, cy)}
            {renderDotLabel(note, finger, cx, cy)}
          </g>
        );
      })}
    </svg>
  );
}
