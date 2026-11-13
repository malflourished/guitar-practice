import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { NeckBandContext } from './neckContext';
import type { ChordQuality, FretPosition, NoteName } from '../types/music';
import {
  BADGE_ROW_HEIGHT,
  FRETBOARD_LAYOUT,
  boardPlayableWidth,
  boardScale,
  labelScale,
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
  getIntervalMarker,
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
const SMALL_LABEL_RADIUS = 11 * NOTE_DOT_SCALE;

interface FretboardProps {
  /** A readable practice window; omitted for the complete neck. */
  fretRange?: [number, number];
  /**
   * Fill the parent's height: the string gap grows with the space the neck
   * is given (36 px and up), and dots and letters grow with it. The parent
   * must have a definite height. Without it the board is 36 px per string.
   */
  fill?: boolean;
  positions: FretPosition[];
  title: string;
  notation: NotationPreference;
  noteLabels?: Map<NoteName, string> | null;
  mutedStrings?: number[];
  showFingers?: boolean;
  showNoteLabels?: boolean;
  /** Label each dot as its interval above this note (Settings, Labels: Intervals). */
  intervalsAbove?: NoteName | null;
  fullDotOpacity?: boolean;
  showChordTones?: boolean;
  rootNote?: NoteName | null;
  chordQuality?: ChordQuality | null;
  /**
   * Interval-trainer labeling: render every note as its interval (function or
   * scale-degree) above the given root, with function colors and shapes.
   */
  intervalLabeling?: { root: NoteName; style: 'function' | 'degree'; colors?: boolean } | null;
  noteColors: Record<NoteName, string>;
  onPlayNote?: (position: FretPosition) => void;
  /**
   * Interval trainer: click any cell on the board (not just lit notes). Renders
   * a transparent hit grid over every string/fret so the player can answer
   * "find the interval" by clicking an empty fret.
   */
  onCellClick?: (stringIndex: number, fret: number) => void;
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
  fretRange,
  fill = false,
  positions,
  title,
  notation,
  noteLabels = null,
  mutedStrings = [],
  showFingers = false,
  showNoteLabels = true,
  intervalsAbove = null,
  fullDotOpacity = false,
  showChordTones = false,
  rootNote = null,
  chordQuality = null,
  intervalLabeling = null,
  onPlayNote,
  onCellClick,
  activePosition = null,
  ghostLayers = [],
  overlapKeys,
  regionBadges = [],
  onSelectRegion,
}: FretboardProps) {
  const isActive = (string: number, fret: number) =>
    activePosition?.string === string && activePosition?.fret === fret;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerWidth = containerSize.width;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      setContainerSize({ width: element.clientWidth, height: element.clientHeight });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Vertical scale: the gap grows with the height the neck is given; dots
  // and letters grow more slowly. Horizontal metrics never scale.
  const scale = fill ? boardScale(containerSize.height, window.innerWidth) : 1;
  const textScale = fill ? labelScale(scale) : 1;
  const stringGap = FRETBOARD_LAYOUT.stringGap * scale;
  const topPadding = FRETBOARD_LAYOUT.topPadding * scale;
  const openNoteRadius = OPEN_NOTE_RADIUS * textScale;
  // Larger open-string dots move right so they keep clear of the string letters.
  const openLaneX = FRETBOARD_LAYOUT.openLaneX + (openNoteRadius - OPEN_NOTE_RADIUS);

  const scaleLength = scaleLengthForTargetWidth(containerWidth);
  const firstFret = fretRange ? Math.max(1, fretRange[0]) : 1;
  const lastFret = fretRange ? Math.min(FRET_COUNT, fretRange[1]) : FRET_COUNT;
  const boardWidth = totalBoardWidth(scaleLength);
  const playableWidth = boardPlayableWidth(FRET_COUNT, scaleLength);
  const windowFretWidth = playableWidth / (lastFret - firstFret + 1);
  const visibleFret = (fret: number) => fret === 0 ? firstFret === 1 : fret >= firstFret && fret <= lastFret;
  const boardOriginX = FRETBOARD_LAYOUT.leftPadding + FRETBOARD_LAYOUT.nutWidth;
  const stringEndX = boardOriginX + playableWidth;
  const hasBadges = regionBadges.length > 0;
  const stringsBottomY = topPadding + (STRING_COUNT - 1) * stringGap;
  const wireTop = topPadding - 8 * scale;
  const wireBottom = stringsBottomY + 8 * scale;
  const boardHeight =
    stringsBottomY +
    (FRETBOARD_LAYOUT.bottomPadding + 8) * scale +
    (fill || hasBadges ? BADGE_ROW_HEIGHT * scale : 0);

  // Tell the neck how much empty band sits above the fret numbers (the board
  // is centred in its container), so it can centre its bar in that space.
  const reportBand = useContext(NeckBandContext);
  const fretNumberTop = topPadding - 18 * scale - 9 * textScale;
  const bandAbove = fill
    ? Math.max(0, Math.round(((containerSize.height - boardHeight) / 2 + fretNumberTop) * 2) / 2)
    : 0;
  useLayoutEffect(() => {
    reportBand?.(bandAbove);
  }, [reportBand, bandAbove]);

  const fretWireX = (fret: number) =>
    boardOriginX + (fretRange ? (fret - firstFret + 1) * windowFretWidth : fretDistanceFromNut(fret, scaleLength));

  const fretCenterX = (fret: number) =>
    boardOriginX + (fretRange ? (fret - firstFret + 0.5) * windowFretWidth : fretCenterOffset(fret, scaleLength));

  const stringY = (stringIndex: number) => topPadding + stringIndex * stringGap;

  // Fret numbers grow with the board, but a two-digit number (about 1.16 em
  // wide) keeps 4 px from its neighbours. Only the highest frets of a narrow
  // board drop below 12 px, never below the old 10 px.
  const fretNumberStyle = (fret: number): CSSProperties | undefined => {
    if (fret < 10) return undefined;
    const room = fretRange ? windowFretWidth : fretSpaceWidth(fret, scaleLength);
    const fits = Math.max(10, (room - 4) / 1.16);
    return fits < 12 * textScale ? { fontSize: `${fits}px` } : undefined;
  };

  const noteRadiusForFret = (fret: number) =>
    NOTE_DOT_SCALE *
    Math.min(
      FRETBOARD_LAYOUT.maxNoteRadius * textScale,
      (fretRange ? windowFretWidth : fretSpaceWidth(fret, scaleLength)) * 0.42,
    );

  const chordToneContext =
    showChordTones && rootNote && chordQuality
      ? { root: rootNote, quality: chordQuality }
      : null;

  const labelFor = (note: NoteName, finger?: number) => {
    if (showFingers && finger !== undefined) {
      return String(finger);
    }
    if (intervalLabeling) {
      return getIntervalMarker(intervalLabeling.root, note, intervalLabeling.style)
        .label;
    }
    if (intervalsAbove) {
      return getIntervalMarker(intervalsAbove, note, 'function').label;
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

  const openPositions = positions.filter((p) => p.fret === 0 && visibleFret(0));
  const frettedPositions = positions.filter((p) => p.fret > 0 && visibleFret(p.fret));

  const dotClass = (note: NoteName) => {
    if (fullDotOpacity) return styles.noteDotRoot;
    return rootNote && samePitchClass(note, rootNote)
      ? styles.noteDotRoot
      : styles.noteDot;
  };

  const renderNoteMarker = (note: NoteName, cx: number, cy: number, radius: number) => {
    if (intervalLabeling) {
      const marker = getIntervalMarker(
        intervalLabeling.root,
        note,
        intervalLabeling.style,
        intervalLabeling.colors,
      );
      return (
        <NoteMarker
          cx={cx}
          cy={cy}
          radius={radius}
          shape={marker.shape}
          isRoot={marker.isRoot}
          fullOpacity
          fill={marker.color}
        />
      );
    }
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
    const small = wide || radius <= SMALL_LABEL_RADIUS * textScale;
    const intervalTextStyle = intervalLabeling
      ? {
          fill: getIntervalMarker(
            intervalLabeling.root,
            note,
            intervalLabeling.style,
            intervalLabeling.colors,
          ).textColor,
        }
      : undefined;
    return (
      <text
        x={cx}
        y={cy + (small ? 4 : 5) * textScale}
        textAnchor="middle"
        className={labelClass(note, small)}
        style={intervalTextStyle}
      >
        {label}
      </text>
    );
  };

  return (
    <div className={fill ? styles.wrapperFill : styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>

      <div
        ref={containerRef}
        className={fill ? styles.scrollFill : styles.scroll}
        data-fretboard-grid
      >
        {containerWidth > 0 && (
          <svg
            className={styles.svg}
            viewBox={`0 0 ${boardWidth} ${boardHeight}`}
            preserveAspectRatio="xMidYMid meet"
            style={
              {
                '--neck-text': textScale,
                ...(fill ? { width: boardWidth, height: boardHeight } : null),
              } as CSSProperties
            }
            role={onCellClick || onPlayNote ? 'group' : 'img'}
            aria-label={title}
          >
            <line
              x1={FRETBOARD_LAYOUT.leftPadding + FRETBOARD_LAYOUT.nutWidth}
              y1={wireTop}
              x2={FRETBOARD_LAYOUT.leftPadding + FRETBOARD_LAYOUT.nutWidth}
              y2={wireBottom}
              className={styles.fretLine}
              strokeWidth={firstFret === 1 ? 3 : 1}
            />

            {Array.from({ length: FRET_COUNT }, (_, i) => i + 1).filter(visibleFret).map((fret) => (
              <g key={`fret-${fret}`}>
                <line
                  x1={fretWireX(fret)}
                  y1={wireTop}
                  x2={fretWireX(fret)}
                  y2={wireBottom}
                  className={styles.fretLine}
                />
                <text
                  x={fretCenterX(fret)}
                  y={topPadding - 18 * scale}
                  textAnchor="middle"
                  className={styles.fretNumber}
                  style={fretNumberStyle(fret)}
                >
                  {fret}
                </text>
              </g>
            ))}

            {Array.from({ length: STRING_COUNT }, (_, stringIndex) => (
              <g key={`string-${stringIndex}`}>
                <text
                  x={FRETBOARD_LAYOUT.stringLabelX}
                  y={stringY(stringIndex) + 5 * Math.min(textScale, 1.25)}
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

            {SINGLE_MARKER_FRETS.filter(visibleFret).map((fret) => (
              <circle
                key={`marker-${fret}`}
                cx={fretCenterX(fret)}
                cy={stringY(2.5)}
                r={FRETBOARD_LAYOUT.markerRadius * textScale}
                className={styles.fretMarker}
              />
            ))}

            {DOUBLE_MARKER_FRETS.filter(visibleFret).flatMap((fret) =>
              [1.5, 3.5].map((stringOffset) => (
                <circle
                  key={`marker-${fret}-${stringOffset}`}
                  cx={fretCenterX(fret)}
                  cy={stringY(stringOffset)}
                  r={FRETBOARD_LAYOUT.markerRadius * textScale}
                  className={styles.fretMarker}
                />
              )),
            )}

            {mutedStrings.map((stringIndex) => (
              <text
                key={`mute-${stringIndex}`}
                x={openLaneX}
                y={stringY(stringIndex) + 5 * textScale}
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
                {layer.positions.filter(p => visibleFret(p.fret)).map((position) => {
                  const cx =
                    position.fret === 0
                      ? openLaneX
                      : fretCenterX(position.fret);
                  const radius =
                    position.fret === 0
                      ? openNoteRadius
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
                  role={onPlayNote ? 'button' : undefined}
                  tabIndex={onPlayNote ? 0 : undefined}
                  aria-label={`${note}, open ${STRING_LABELS[string]} string`}
                  onKeyDown={event => { if (onPlayNote && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onPlayNote(position); } }}
                  onClick={onPlayNote ? () => onPlayNote(position) : undefined}
                  style={onPlayNote ? { cursor: 'pointer' } : undefined}
                >
                  {overlapKeys?.has(cellKey(position)) && (
                    <circle
                      cx={openLaneX}
                      cy={stringY(string)}
                      r={openNoteRadius + 3.5 * textScale}
                      className={styles.overlapRing}
                    />
                  )}
                  <g className={isActive(string, 0) ? styles.sounding : undefined}>
                    {renderNoteMarker(
                      note,
                      openLaneX,
                      stringY(string),
                      openNoteRadius,
                    )}
                  </g>
                  {renderLabel(
                    note,
                    finger,
                    openLaneX,
                    stringY(string),
                    openNoteRadius,
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
                  role={onPlayNote ? 'button' : undefined}
                  tabIndex={onPlayNote ? 0 : undefined}
                  aria-label={`${note}, ${STRING_LABELS[string]} string, fret ${fret}`}
                  onKeyDown={event => { if (onPlayNote && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onPlayNote(position); } }}
                  onClick={onPlayNote ? () => onPlayNote(position) : undefined}
                  style={onPlayNote ? { cursor: 'pointer' } : undefined}
                >
                  {overlapKeys?.has(cellKey(position)) && (
                    <circle
                      cx={fretCenterX(fret)}
                      cy={stringY(string)}
                      r={radius + 3.5 * textScale}
                      className={styles.overlapRing}
                    />
                  )}
                  <g className={isActive(string, fret) ? styles.sounding : undefined}>
                    {renderNoteMarker(
                      note,
                      fretCenterX(fret),
                      stringY(string),
                      radius,
                    )}
                  </g>
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

            {onCellClick &&
              Array.from({ length: STRING_COUNT }, (_, stringIndex) =>
                Array.from({ length: FRET_COUNT + 1 }, (_, fret) => fret).filter(visibleFret).map(fret => {
                  const cx =
                    fret === 0 ? openLaneX : fretCenterX(fret);
                  const width =
                    fret === 0
                      ? openNoteRadius * 2.2
                      : (fretRange ? windowFretWidth : fretSpaceWidth(fret, scaleLength)) * 0.92;
                  return (
                    <rect
                      key={`cell-${stringIndex}-${fret}`}
                      x={cx - width / 2}
                      y={stringY(stringIndex) - stringGap / 2}
                      width={width}
                      height={stringGap}
                      fill="transparent"
                      role="button"
                      tabIndex={0}
                      aria-label={`${STRING_LABELS[stringIndex]} string, fret ${fret}`}
                      onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onCellClick(stringIndex, fret); } }}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onCellClick(stringIndex, fret)}
                    />
                  );
                }),
              )}

            {regionBadges.map((badge) => (
              <text
                key={`badge-${badge.index}`}
                x={fretCenterX(Math.max(badge.centerFret, 0.5))}
                y={stringsBottomY + 28 * scale}
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
