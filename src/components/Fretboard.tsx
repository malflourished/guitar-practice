import { useEffect, useRef, useState } from 'react';
import type { ChordQuality, FretPosition, NoteName } from '../types/music';
import {
  FRETBOARD_LAYOUT,
  boardPlayableWidth,
  fretCenterOffset,
  fretDistanceFromNut,
  fretSpaceWidth,
  scaleLengthForTargetWidth,
  totalBoardWidth,
} from '../lib/fretLayout';
import {
  FRET_COUNT,
  STRING_COUNT,
  STRING_LABELS,
  cellKey,
  formatNoteDisplay,
  getChordToneForNote,
  samePitchClass,
  type GhostLayer,
  type NotationPreference,
  type RegionBadge,
} from '../lib/music';
import { NoteMarker } from './NoteMarker';
import styles from './Fretboard.module.css';

const SINGLE_MARKER_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_MARKER_FRETS = [12, 24];
const NOTE_DOT_SCALE = 0.8;
const OPEN_NOTE_RADIUS = 13 * NOTE_DOT_SCALE;
const ACTIVE_RING_PAD = 6 * NOTE_DOT_SCALE;
const SMALL_LABEL_RADIUS = 11 * NOTE_DOT_SCALE;

interface FretboardProps {
  positions: FretPosition[];
  title: string;
  subtitle?: string;
  subtitleVariant?: 'default' | 'theory';
  notation: NotationPreference;
  noteLabels?: Map<NoteName, string> | null;
  mutedStrings?: number[];
  showFingers?: boolean;
  showNoteLabels?: boolean;
  fullDotOpacity?: boolean;
  showChordTones?: boolean;
  rootNote?: NoteName | null;
  chordQuality?: ChordQuality | null;
  noteColors: Record<NoteName, string>;
  onPlayNote?: (position: FretPosition) => void;
  activePosition?: FretPosition | null;
  /** Dimmed neighbor/remaining position boxes (connected/full neck views). */
  ghostLayers?: GhostLayer[];
  /** Active-box cells shared with an adjacent box — drawn with a halo ring. */
  overlapKeys?: Set<string>;
  /** Per-box labels under the board in connected/full views. */
  regionBadges?: RegionBadge[];
  /** Jump to a region when its badge is clicked. */
  onSelectRegion?: (index: number) => void;
}

export function Fretboard({
  positions,
  title,
  subtitle = 'Standard tuning • Frets 0–24',
  subtitleVariant = 'default',
  notation,
  noteLabels = null,
  mutedStrings = [],
  showFingers = false,
  showNoteLabels = true,
  fullDotOpacity = false,
  showChordTones = false,
  rootNote = null,
  chordQuality = null,
  onPlayNote,
  activePosition = null,
  ghostLayers = [],
  overlapKeys,
  regionBadges = [],
  onSelectRegion,
}: FretboardProps) {
  const isActive = (string: number, fret: number) =>
    activePosition?.string === string && activePosition?.fret === fret;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pulseGeneration, setPulseGeneration] = useState(0);

  useEffect(() => {
    if (activePosition) {
      setPulseGeneration((generation) => generation + 1);
    }
  }, [activePosition?.string, activePosition?.fret]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scaleLength = scaleLengthForTargetWidth(containerWidth);
  const boardWidth = totalBoardWidth(scaleLength);
  const playableWidth = boardPlayableWidth(FRET_COUNT, scaleLength);
  const boardOriginX = FRETBOARD_LAYOUT.leftPadding + FRETBOARD_LAYOUT.nutWidth;
  const stringEndX = boardOriginX + playableWidth;
  const hasBadges = regionBadges.length > 0;
  const stringsBottomY =
    FRETBOARD_LAYOUT.topPadding + (STRING_COUNT - 1) * FRETBOARD_LAYOUT.stringGap;
  const boardHeight =
    stringsBottomY + FRETBOARD_LAYOUT.bottomPadding + 8 + (hasBadges ? 24 : 0);

  const fretWireX = (fret: number) =>
    boardOriginX + fretDistanceFromNut(fret, scaleLength);

  const fretCenterX = (fret: number) =>
    boardOriginX + fretCenterOffset(fret, scaleLength);

  const stringY = (stringIndex: number) =>
    FRETBOARD_LAYOUT.topPadding + stringIndex * FRETBOARD_LAYOUT.stringGap;

  const noteRadiusForFret = (fret: number) =>
    NOTE_DOT_SCALE *
    Math.min(
      FRETBOARD_LAYOUT.maxNoteRadius,
      fretSpaceWidth(fret, scaleLength) * 0.42,
    );

  const chordToneContext =
    showChordTones && rootNote && chordQuality
      ? { root: rootNote, quality: chordQuality }
      : null;

  const labelFor = (note: NoteName, finger?: number) => {
    if (showFingers && finger !== undefined) {
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

  const openPositions = positions.filter((p) => p.fret === 0);
  const frettedPositions = positions.filter((p) => p.fret > 0);

  const dotClass = (note: NoteName) => {
    if (fullDotOpacity) return styles.noteDotRoot;
    return rootNote && samePitchClass(note, rootNote)
      ? styles.noteDotRoot
      : styles.noteDot;
  };

  const renderNoteMarker = (note: NoteName, cx: number, cy: number, radius: number) => {
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
          radius={radius}
          shape={tone?.shape ?? 'circle'}
          isRoot={tone?.isRoot ?? false}
          fullOpacity={fullDotOpacity}
        />
      );
    }

    return <circle cx={cx} cy={cy} r={radius} className={dotClass(note)} />;
  };

  const isRingMarker = (note: NoteName) => {
    if (!chordToneContext) return false;
    const tone = getChordToneForNote(
      chordToneContext.root,
      note,
      chordToneContext.quality,
    );
    return tone?.shape === 'ring';
  };

  const labelClass = (note: NoteName, small: boolean) => {
    if (isRingMarker(note)) {
      return small ? styles.noteLabelOnRingSmall : styles.noteLabelOnRing;
    }
    return small ? styles.noteLabelAccidental : styles.noteLabel;
  };

  const renderLabel = (
    note: NoteName,
    finger: number | undefined,
    cx: number,
    cy: number,
    radius: number,
  ) => {
    if (!showNoteLabels) return null;

    const label = labelFor(note, finger);
    const wide = label.length > 1;
    const small = wide || radius <= SMALL_LABEL_RADIUS;
    return (
      <text
        x={cx}
        y={cy + (small ? 4 : 5)}
        textAnchor="middle"
        className={labelClass(note, small)}
      >
        {label}
      </text>
    );
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p
          className={
            subtitleVariant === 'theory'
              ? styles.subtitleTheory
              : styles.subtitle
          }
        >
          {subtitle}
        </p>
      </header>

      <div ref={containerRef} className={styles.scroll} data-fretboard-grid>
        {containerWidth > 0 && (
          <svg
            className={styles.svg}
            viewBox={`0 0 ${boardWidth} ${boardHeight}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={title}
          >
            <line
              x1={FRETBOARD_LAYOUT.leftPadding + FRETBOARD_LAYOUT.nutWidth}
              y1={FRETBOARD_LAYOUT.topPadding - 8}
              x2={FRETBOARD_LAYOUT.leftPadding + FRETBOARD_LAYOUT.nutWidth}
              y2={
                FRETBOARD_LAYOUT.topPadding +
                (STRING_COUNT - 1) * FRETBOARD_LAYOUT.stringGap +
                8
              }
              className={styles.fretLine}
              strokeWidth={3}
            />

            {Array.from({ length: FRET_COUNT }, (_, i) => i + 1).map((fret) => (
              <g key={`fret-${fret}`}>
                <line
                  x1={fretWireX(fret)}
                  y1={FRETBOARD_LAYOUT.topPadding - 8}
                  x2={fretWireX(fret)}
                  y2={
                    FRETBOARD_LAYOUT.topPadding +
                    (STRING_COUNT - 1) * FRETBOARD_LAYOUT.stringGap +
                    8
                  }
                  className={styles.fretLine}
                />
                <text
                  x={fretCenterX(fret)}
                  y={FRETBOARD_LAYOUT.topPadding - 18}
                  textAnchor="middle"
                  className={styles.fretNumber}
                >
                  {fret}
                </text>
              </g>
            ))}

            {Array.from({ length: STRING_COUNT }, (_, stringIndex) => (
              <g key={`string-${stringIndex}`}>
                <text
                  x={FRETBOARD_LAYOUT.stringLabelX}
                  y={stringY(stringIndex) + 5}
                  textAnchor="start"
                  className={styles.stringLabel}
                >
                  {STRING_LABELS[stringIndex]}
                </text>
                <line
                  x1={FRETBOARD_LAYOUT.leftPadding}
                  y1={stringY(stringIndex)}
                  x2={stringEndX}
                  y2={stringY(stringIndex)}
                  className={styles.stringLine}
                />
              </g>
            ))}

            {SINGLE_MARKER_FRETS.map((fret) => (
              <circle
                key={`marker-${fret}`}
                cx={fretCenterX(fret)}
                cy={stringY(2.5)}
                r={FRETBOARD_LAYOUT.markerRadius}
                className={styles.fretMarker}
              />
            ))}

            {DOUBLE_MARKER_FRETS.flatMap((fret) =>
              [1.5, 3.5].map((stringOffset) => (
                <circle
                  key={`marker-${fret}-${stringOffset}`}
                  cx={fretCenterX(fret)}
                  cy={stringY(stringOffset)}
                  r={FRETBOARD_LAYOUT.markerRadius}
                  className={styles.fretMarker}
                />
              )),
            )}

            {mutedStrings.map((stringIndex) => (
              <text
                key={`mute-${stringIndex}`}
                x={FRETBOARD_LAYOUT.openLaneX}
                y={stringY(stringIndex) + 5}
                textAnchor="middle"
                className={styles.mutedMarker}
              >
                ×
              </text>
            ))}

            {ghostLayers.map((layer, layerIndex) => (
              <g
                key={`ghost-${layerIndex}`}
                className={
                  layer.tier === 'near' ? styles.ghostNear : styles.ghostFar
                }
              >
                {layer.positions.map((position) => {
                  const cx =
                    position.fret === 0
                      ? FRETBOARD_LAYOUT.openLaneX
                      : fretCenterX(position.fret);
                  const radius =
                    position.fret === 0
                      ? OPEN_NOTE_RADIUS
                      : noteRadiusForFret(position.fret);
                  return (
                    <circle
                      key={`ghost-${position.string}-${position.fret}`}
                      cx={cx}
                      cy={stringY(position.string)}
                      r={radius}
                      className={styles.ghostDot}
                    />
                  );
                })}
              </g>
            ))}

            {openPositions.map((position) => {
              const { string, note, finger } = position;
              return (
                <g
                  key={`open-${string}`}
                  onClick={onPlayNote ? () => onPlayNote(position) : undefined}
                  style={onPlayNote ? { cursor: 'pointer' } : undefined}
                >
                  {isActive(string, 0) && (
                    <circle
                      key={`pulse-open-${string}-${pulseGeneration}`}
                      cx={FRETBOARD_LAYOUT.openLaneX}
                      cy={stringY(string)}
                      r={OPEN_NOTE_RADIUS + ACTIVE_RING_PAD}
                      className={styles.activeRing}
                    />
                  )}
                  {overlapKeys?.has(cellKey(position)) && (
                    <circle
                      cx={FRETBOARD_LAYOUT.openLaneX}
                      cy={stringY(string)}
                      r={OPEN_NOTE_RADIUS + 3.5}
                      className={styles.overlapRing}
                    />
                  )}
                  {renderNoteMarker(
                    note,
                    FRETBOARD_LAYOUT.openLaneX,
                    stringY(string),
                    OPEN_NOTE_RADIUS,
                  )}
                  {renderLabel(
                    note,
                    finger,
                    FRETBOARD_LAYOUT.openLaneX,
                    stringY(string),
                    OPEN_NOTE_RADIUS,
                  )}
                </g>
              );
            })}

            {frettedPositions.map((position) => {
              const { string, fret, note, finger } = position;
              const radius = noteRadiusForFret(fret);
              return (
                <g
                  key={`note-${string}-${fret}`}
                  onClick={onPlayNote ? () => onPlayNote(position) : undefined}
                  style={onPlayNote ? { cursor: 'pointer' } : undefined}
                >
                  {isActive(string, fret) && (
                    <circle
                      key={`pulse-${string}-${fret}-${pulseGeneration}`}
                      cx={fretCenterX(fret)}
                      cy={stringY(string)}
                      r={radius + ACTIVE_RING_PAD}
                      className={styles.activeRing}
                    />
                  )}
                  {overlapKeys?.has(cellKey(position)) && (
                    <circle
                      cx={fretCenterX(fret)}
                      cy={stringY(string)}
                      r={radius + 3.5}
                      className={styles.overlapRing}
                    />
                  )}
                  {renderNoteMarker(
                    note,
                    fretCenterX(fret),
                    stringY(string),
                    radius,
                  )}
                  {renderLabel(
                    note,
                    finger,
                    fretCenterX(fret),
                    stringY(string),
                    radius,
                  )}
                </g>
              );
            })}

            {regionBadges.map((badge) => (
              <text
                key={`badge-${badge.index}`}
                x={fretCenterX(Math.max(badge.centerFret, 0.5))}
                y={stringsBottomY + 28}
                textAnchor="middle"
                className={
                  badge.isActive ? styles.regionBadgeActive : styles.regionBadge
                }
                onClick={
                  onSelectRegion && !badge.isActive
                    ? () => onSelectRegion(badge.index)
                    : undefined
                }
                style={
                  onSelectRegion && !badge.isActive
                    ? { cursor: 'pointer' }
                    : undefined
                }
              >
                {badge.label}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
