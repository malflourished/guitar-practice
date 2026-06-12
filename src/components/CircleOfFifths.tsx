import type { KeyMode, NoteName } from '../types/music';
import {
  findCircleEntry,
  getAccidentalLabel,
  getCircleKeyDisplay,
  getCircleKeyEntries,
  getRelativeMajor,
  isOnCircle,
} from '../lib/music/circleOfFifths';
import styles from './CircleOfFifths.module.css';

const SIZE = 560;
const CENTER_X = SIZE / 2;
const CENTER_Y = SIZE / 2 + 14;
const OUTER_RING = 176;
const CENTER_DISC = 84;
const MAJOR_RADIUS = OUTER_RING + 15;
const MINOR_RADIUS = 113;
const SIGNATURE_RADIUS = 145;
const SLOT_COUNT = 12;

interface CircleOfFifthsProps {
  selectedRoot: NoteName;
  keyMode: KeyMode;
  onSelectKey: (root: NoteName, mode: KeyMode) => void;
}

function slotAngle(index: number): number {
  return (index / SLOT_COUNT) * Math.PI * 2 - Math.PI / 2;
}

function polarToCartesian(radius: number, index: number): { x: number; y: number } {
  const angle = slotAngle(index);
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}

/** Compact key-signature summary for a circle slot (enharmonic keys show both spellings). */
function accidentalSummary(
  index: number,
  sharpCount: number,
  flatCount: number,
): string {
  if (index === 5) return '5♯ · 7♭';
  if (index === 6) return '6♭ · 6♯';
  if (index === 7) return '5♭ · 7♯';
  if (sharpCount > 0) return `${sharpCount}♯`;
  if (flatCount > 0) return `${flatCount}♭`;
  return '';
}

/** A gently bent path between two points, bowing toward the perpendicular by `bend`. */
function bentPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return `M ${x1} ${y1} Q ${mx + nx * bend} ${my + ny * bend} ${x2} ${y2}`;
}

function isSelected(
  major: NoteName,
  relativeMinor: NoteName,
  selectedRoot: NoteName,
  keyMode: KeyMode,
): boolean {
  if (keyMode === 'major') {
    return selectedRoot === major;
  }
  return selectedRoot === relativeMinor;
}

function RingLabel({
  x,
  y,
  display,
  selected,
  mode,
  ariaLabel,
  onSelect,
}: {
  x: number;
  y: number;
  display: ReturnType<typeof getCircleKeyDisplay>;
  selected: boolean;
  mode: 'major' | 'minor';
  ariaLabel: string;
  onSelect: () => void;
}) {
  const primary = mode === 'major' ? display.major : display.minor;
  const alt = mode === 'major' ? display.majorAlt : display.minorAlt;
  const fontSize = alt
    ? mode === 'major'
      ? 7.4
      : 7
    : mode === 'major'
      ? 14
      : 10.5;

  return (
    <g
      className={`${styles.ringLabel} ${selected ? styles.ringLabelSelected : ''}`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <circle
        className={styles.ringHit}
        cx={x}
        cy={y}
        r={mode === 'major' ? 18 : 14}
      />
      <text
        className={mode === 'major' ? styles.majorLabel : styles.minorLabel}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
      >
        {primary}
        {alt ? (
          <>
            <tspan className={styles.orSeparator}> or </tspan>
            <tspan className={mode === 'major' ? styles.majorLabelAlt : styles.minorLabelAlt}>
              {alt}
            </tspan>
          </>
        ) : null}
      </text>
    </g>
  );
}

export function CircleOfFifths({
  selectedRoot,
  keyMode,
  onSelectKey,
}: CircleOfFifthsProps) {
  const entries = getCircleKeyEntries();
  const selectedMajor =
    keyMode === 'major'
      ? selectedRoot
      : isOnCircle(getRelativeMajor(selectedRoot))
        ? getRelativeMajor(selectedRoot)
        : selectedRoot;
  const selectedEntry =
    findCircleEntry(selectedMajor, 'major') ?? entries[0];
  const selectedIndex = entries.findIndex(
    (entry) => entry.major === selectedEntry.major,
  );
  const selectedDisplay = getCircleKeyDisplay(selectedEntry, selectedIndex);

  // Callout arrows point at the lone accidental that each top neighbour adds:
  // F major's flat (index 11, B♭) and G major's sharp (index 1, F♯).
  const flatTarget = polarToCartesian(SIGNATURE_RADIUS + 6, 11);
  const sharpTarget = polarToCartesian(SIGNATURE_RADIUS + 6, 1);

  return (
    <div className={styles.root} role="img" aria-label="Circle of fifths">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        <defs>
          <marker
            id="cof-arrow-bold"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0.5 L10 5 L0 9.5 L3 5 Z" className={styles.arrowHeadBold} />
          </marker>
          <marker
            id="cof-arrow-thin"
            viewBox="0 0 8 8"
            refX="6.4"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0.4 L8 4 L0 7.6 L2.4 4 Z" className={styles.arrowHeadThin} />
          </marker>
        </defs>

        <circle className={styles.outerRing} cx={CENTER_X} cy={CENTER_Y} r={OUTER_RING} />

        {/* Corner direction arrows — bold straight diagonals, as in the reference */}
        <line
          className={styles.cornerArrow}
          x1={150}
          y1={150}
          x2={112}
          y2={194}
          markerEnd="url(#cof-arrow-bold)"
        />
        <line
          className={styles.cornerArrow}
          x1={SIZE - 150}
          y1={150}
          x2={SIZE - 112}
          y2={194}
          markerEnd="url(#cof-arrow-bold)"
        />
        <line
          className={styles.cornerArrow}
          x1={132}
          y1={SIZE - 124}
          x2={96}
          y2={SIZE - 80}
          markerEnd="url(#cof-arrow-bold)"
        />
        <line
          className={styles.cornerArrow}
          x1={SIZE - 132}
          y1={SIZE - 124}
          x2={SIZE - 96}
          y2={SIZE - 80}
          markerEnd="url(#cof-arrow-bold)"
        />

        {/* Top corner headings */}
        <text className={styles.directionTitle} x={66} y={70}>
          Flat Keys
        </text>
        <text className={styles.directionSubtitle} x={66} y={86}>
          fourths
        </text>
        <text
          className={styles.directionTitle}
          x={SIZE - 66}
          y={70}
          textAnchor="end"
        >
          Sharp Keys
        </text>
        <text
          className={styles.directionSubtitle}
          x={SIZE - 66}
          y={86}
          textAnchor="end"
        >
          fifths
        </text>

        {/* Newest-accidental callouts */}
        <text className={styles.calloutTitle} x={206} y={44} textAnchor="middle">
          newest flat:
        </text>
        <text className={styles.calloutSub} x={206} y={56} textAnchor="middle">
          (fourth degree of the scale)
        </text>
        <path
          className={styles.calloutArrow}
          d={bentPath(230, 70, flatTarget.x, flatTarget.y, 12)}
          markerEnd="url(#cof-arrow-thin)"
        />
        <text
          className={styles.calloutTitle}
          x={SIZE - 206}
          y={44}
          textAnchor="middle"
        >
          newest sharp:
        </text>
        <text
          className={styles.calloutSub}
          x={SIZE - 206}
          y={56}
          textAnchor="middle"
        >
          (seventh degree of the scale)
        </text>
        <path
          className={styles.calloutArrow}
          d={bentPath(SIZE - 230, 70, sharpTarget.x, sharpTarget.y, -12)}
          markerEnd="url(#cof-arrow-thin)"
        />

        {/* Bottom corner captions */}
        <text className={styles.directionFoot} x={64} y={SIZE - 58}>
          more flats
        </text>
        <text className={styles.directionFootSub} x={64} y={SIZE - 44}>
          (fewer sharps)
        </text>
        <text
          className={styles.directionFoot}
          x={SIZE - 64}
          y={SIZE - 58}
          textAnchor="end"
        >
          more sharps
        </text>
        <text
          className={styles.directionFootSub}
          x={SIZE - 64}
          y={SIZE - 44}
          textAnchor="end"
        >
          (fewer flats)
        </text>

        {entries.map((entry, index) => {
          const majorPoint = polarToCartesian(MAJOR_RADIUS, index);
          const minorPoint = polarToCartesian(MINOR_RADIUS, index);
          const signaturePoint = polarToCartesian(SIGNATURE_RADIUS, index);
          const nodePoint = polarToCartesian(OUTER_RING, index);
          const display = getCircleKeyDisplay(entry, index);
          const accidentals = accidentalSummary(
            index,
            entry.sharpCount,
            entry.flatCount,
          );
          const majorSelected = isSelected(
            entry.major,
            entry.relativeMinor,
            selectedRoot,
            'major',
          );
          const minorSelected = isSelected(
            entry.major,
            entry.relativeMinor,
            selectedRoot,
            'minor',
          );

          return (
            <g key={entry.major}>
              {accidentals ? (
                <text
                  className={styles.accidentalCount}
                  x={signaturePoint.x}
                  y={signaturePoint.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {accidentals}
                </text>
              ) : null}
              <circle
                className={`${styles.majorNode} ${
                  majorSelected ? styles.majorNodeSelected : ''
                }`}
                cx={nodePoint.x}
                cy={nodePoint.y}
                r={4.5}
              />
              <RingLabel
                x={majorPoint.x}
                y={majorPoint.y}
                display={display}
                selected={majorSelected}
                mode="major"
                ariaLabel={`${display.major}${display.majorAlt ? ` or ${display.majorAlt}` : ''} major`}
                onSelect={() => onSelectKey(entry.major, 'major')}
              />
              <RingLabel
                x={minorPoint.x}
                y={minorPoint.y}
                display={display}
                selected={minorSelected}
                mode="minor"
                ariaLabel={`${display.minor}${display.minorAlt ? ` or ${display.minorAlt}` : ''} minor`}
                onSelect={() => onSelectKey(entry.relativeMinor, 'minor')}
              />
            </g>
          );
        })}

        <circle
          className={styles.centerDisc}
          cx={CENTER_X}
          cy={CENTER_Y}
          r={CENTER_DISC}
        />
        <text
          className={styles.centerLabel}
          x={CENTER_X}
          y={CENTER_Y - 28}
          textAnchor="middle"
        >
          Selected key
        </text>
        <text
          className={styles.centerKey}
          x={CENTER_X}
          y={CENTER_Y + 4}
          textAnchor="middle"
        >
          {keyMode === 'major' ? selectedDisplay.major : selectedDisplay.minor}
        </text>
        <text
          className={styles.centerMeta}
          x={CENTER_X}
          y={CENTER_Y + 32}
          textAnchor="middle"
        >
          {getAccidentalLabel(selectedEntry)} · rel.{' '}
          {keyMode === 'major' ? selectedDisplay.minor : selectedDisplay.major}
        </text>
      </svg>
    </div>
  );
}
