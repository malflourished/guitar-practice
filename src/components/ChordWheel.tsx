import type { KeyMode, NoteName } from '../types/music';
import {
  getChordWheelWedges,
  getDiatonicHighlights,
  getSelectedWheelIndex,
  isChordWheelHighlight,
  type ChordWheelRing,
} from '../lib/music/chordWheel';
import styles from './ChordWheel.module.css';

const SIZE = 560;
const CENTER = SIZE / 2;
const SLOT_COUNT = 12;

const R_CENTER = 40;
const R_I_INNER = 42;
const R_I_OUTER = 92;
const R_VI_INNER = 92;
const R_VI_OUTER = 132;
const R_II_INNER = 132;
const R_II_OUTER = 172;
const R_DIM_INNER = 172;
const R_DIM_OUTER = 196;

const R_LABEL_I = (R_I_INNER + R_I_OUTER) / 2;
const R_LABEL_VI = (R_VI_INNER + R_VI_OUTER) / 2;
const R_LABEL_II = (R_II_INNER + R_II_OUTER) / 2;
const R_LABEL_SIG = (R_CENTER + R_I_INNER) / 2;

interface ChordWheelProps {
  selectedRoot: NoteName;
  keyMode: KeyMode;
  onSelectKey: (root: NoteName, mode: KeyMode) => void;
}

function slotAngle(index: number): number {
  return (index / SLOT_COUNT) * Math.PI * 2 - Math.PI / 2;
}

function wedgeMidAngle(index: number): number {
  return slotAngle(index) + Math.PI / SLOT_COUNT;
}

function polarToCartesian(radius: number, angle: number): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function describeRingWedge(
  index: number,
  rInner: number,
  rOuter: number,
): string {
  const a0 = slotAngle(index);
  const a1 = slotAngle(index + 1);
  const outer0 = polarToCartesian(rOuter, a0);
  const outer1 = polarToCartesian(rOuter, a1);
  const inner1 = polarToCartesian(rInner, a1);
  const inner0 = polarToCartesian(rInner, a0);

  return [
    `M ${outer0.x} ${outer0.y}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${outer1.x} ${outer1.y}`,
    `L ${inner1.x} ${inner1.y}`,
    `A ${rInner} ${rInner} 0 0 0 ${inner0.x} ${inner0.y}`,
    'Z',
  ].join(' ');
}

function describeDimSpike(index: number): string {
  const edge = slotAngle(index) - Math.PI / SLOT_COUNT;
  const half = Math.PI / 36;
  const a0 = edge - half;
  const a1 = edge + half;
  const inner0 = polarToCartesian(R_DIM_INNER, a0);
  const inner1 = polarToCartesian(R_DIM_INNER, a1);
  const outer1 = polarToCartesian(R_DIM_OUTER, a1);
  const outer0 = polarToCartesian(R_DIM_OUTER, a0);

  return [
    `M ${inner0.x} ${inner0.y}`,
    `L ${outer0.x} ${outer0.y}`,
    `A ${R_DIM_OUTER} ${R_DIM_OUTER} 0 0 1 ${outer1.x} ${outer1.y}`,
    `L ${inner1.x} ${inner1.y}`,
    `A ${R_DIM_INNER} ${R_DIM_INNER} 0 0 0 ${inner0.x} ${inner0.y}`,
    'Z',
  ].join(' ');
}

function ringLabelRadius(ring: ChordWheelRing): number {
  switch (ring) {
    case 'I':
      return R_LABEL_I;
    case 'vi':
      return R_LABEL_VI;
    case 'ii':
      return R_LABEL_II;
    case 'dim':
      return R_DIM_OUTER - 10;
  }
}

export function ChordWheel({
  selectedRoot,
  keyMode,
  onSelectKey,
}: ChordWheelProps) {
  const wedges = getChordWheelWedges();
  const selectedIndex = Math.max(0, getSelectedWheelIndex(selectedRoot, keyMode));
  const selectedWedge = wedges[selectedIndex] ?? wedges[0];
  const highlights = getDiatonicHighlights(selectedIndex);

  const highlightSummary = highlights
    .filter((item) => item.numeral !== 'vii°')
    .sort((a, b) => {
      const order = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
      return order.indexOf(a.numeral) - order.indexOf(b.numeral);
    });

  const dimHighlight = highlights.find((item) => item.numeral === 'vii°');

  return (
    <div className={styles.root} role="img" aria-label="Chord wheel">
      <svg className={styles.svg} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className={styles.hub} cx={CENTER} cy={CENTER} r={R_CENTER} />

        {wedges.map((wedge) => {
          const sigPoint = polarToCartesian(R_LABEL_SIG, wedgeMidAngle(wedge.index));
          const isKeyWedge = wedge.index === selectedIndex;

          return (
            <g key={`wedge-${wedge.index}`}>
              {(['I', 'vi', 'ii'] as const).map((ring) => {
                const rInner =
                  ring === 'I'
                    ? R_I_INNER
                    : ring === 'vi'
                      ? R_VI_INNER
                      : R_II_INNER;
                const rOuter =
                  ring === 'I'
                    ? R_I_OUTER
                    : ring === 'vi'
                      ? R_VI_OUTER
                      : R_II_OUTER;
                const highlight = isChordWheelHighlight(
                  highlights,
                  wedge.index,
                  ring,
                );
                const dimmed = !highlight;

                return (
                  <path
                    key={`${wedge.index}-${ring}`}
                    className={`${styles.wedge} ${dimmed ? styles.wedgeDimmed : styles.wedgeLit} ${highlight ? styles.wedgeHighlighted : ''}`}
                    d={describeRingWedge(wedge.index, rInner, rOuter)}
                    style={{ fill: wedge.color }}
                  />
                );
              })}

              {(() => {
                const highlight = isChordWheelHighlight(
                  highlights,
                  wedge.index,
                  'dim',
                );
                return (
                  <path
                    className={`${styles.wedge} ${highlight ? styles.wedgeLit : styles.wedgeDimmed} ${highlight ? styles.wedgeHighlighted : ''}`}
                    d={describeDimSpike(wedge.index)}
                    style={{ fill: wedge.color }}
                  />
                );
              })()}

              <text
                className={`${styles.signatureLabel} ${isKeyWedge ? styles.signatureLabelActive : ''}`}
                x={sigPoint.x}
                y={sigPoint.y}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {wedge.signatureLabel === 'none' ? '♮' : wedge.signatureLabel}
              </text>
            </g>
          );
        })}

        {wedges.map((wedge) =>
          (['I', 'vi', 'ii', 'dim'] as const).map((ring) => {
            const highlight = isChordWheelHighlight(highlights, wedge.index, ring);
            const point = polarToCartesian(
              ringLabelRadius(ring),
              ring === 'dim'
                ? slotAngle(wedge.index) - Math.PI / SLOT_COUNT
                : wedgeMidAngle(wedge.index),
            );
            const label = wedge.labels[ring];
            const isMajorSelect = ring === 'I';
            const isMinorSelect = ring === 'vi';

            return (
              <g
                key={`label-${wedge.index}-${ring}`}
                className={`${styles.chordLabel} ${highlight ? styles.chordLabelHighlighted : ''}`}
                role={isMajorSelect || isMinorSelect ? 'button' : undefined}
                tabIndex={isMajorSelect || isMinorSelect ? 0 : undefined}
                aria-label={
                  isMajorSelect
                    ? `${label} major`
                    : isMinorSelect
                      ? `${label} minor`
                      : undefined
                }
                aria-pressed={
                  isMajorSelect || isMinorSelect
                    ? isMajorSelect
                      ? selectedRoot === wedge.major && keyMode === 'major'
                      : selectedRoot === wedge.relativeMinor && keyMode === 'minor'
                    : undefined
                }
                onClick={
                  isMajorSelect
                    ? () => onSelectKey(wedge.major, 'major')
                    : isMinorSelect
                      ? () => onSelectKey(wedge.relativeMinor, 'minor')
                      : undefined
                }
                onKeyDown={
                  isMajorSelect || isMinorSelect
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (isMajorSelect) {
                            onSelectKey(wedge.major, 'major');
                          } else {
                            onSelectKey(wedge.relativeMinor, 'minor');
                          }
                        }
                      }
                    : undefined
                }
              >
                {(isMajorSelect || isMinorSelect) && (
                  <circle
                    className={styles.chordHit}
                    cx={point.x}
                    cy={point.y}
                    r={ring === 'I' ? 20 : 16}
                  />
                )}
                <text
                  className={
                    ring === 'I'
                      ? styles.majorChordText
                      : ring === 'dim'
                        ? styles.dimChordText
                        : styles.minorChordText
                  }
                  x={point.x}
                  y={point.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={ring === 'I' ? 13 : ring === 'ii' ? 10.5 : 10}
                >
                  {label}
                </text>
                {highlight ? (
                  <text
                    className={styles.numeralBadge}
                    x={point.x}
                    y={point.y - (ring === 'I' ? 18 : 15)}
                    textAnchor="middle"
                  >
                    {highlight.numeral}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}

        <text className={styles.centerLabel} x={CENTER} y={CENTER - 28} textAnchor="middle">
          Key of
        </text>
        <text className={styles.centerKey} x={CENTER} y={CENTER - 4} textAnchor="middle">
          {keyMode === 'major'
            ? selectedWedge.display.major
            : selectedWedge.display.minor}
        </text>
        <text className={styles.centerMeta} x={CENTER} y={CENTER + 18} textAnchor="middle">
          {highlightSummary.map((item) => item.numeral).join(' · ')}
        </text>
        {dimHighlight ? (
          <text className={styles.centerDim} x={CENTER} y={CENTER + 34} textAnchor="middle">
            {dimHighlight.numeral}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
