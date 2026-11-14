import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { STRING_COUNT, STRING_LABELS } from '../lib/music';
import type { KeyDialInfo } from '../lib/music/keyDial';
import {
  NECK_FRETS,
  neckAriaLabel,
  neckChordMap,
  neckLegend,
  type NeckMarkerKind,
} from '../lib/music/neckChordMap';
import {
  legendLayout,
  numeralFontSize,
  verticalNeckLayout,
  type VerticalNeckLayout,
} from '../lib/verticalNeckLayout';
import styles from './KeyNeck.module.css';

/*
 * The key's chords on a vertical neck, in the key dial's place (Theory ›
 * Neck, package H2). Drawn like a chord chart: low E on the left, the nut at
 * the top, frets 0 to 12 going down. What it shows comes from the same
 * `describeKeyDial` info as the dial, through `neckChordMap`; where things sit
 * comes from `verticalNeckLayout`. The svg is drawn 1:1 in px at the size of
 * its box, so the size rule (marker 27 px down to 20, fret spaces never under
 * 1.15 markers) is exact.
 */

/** Frets with an inlay, as on a real neck; 12 has two. */
const INLAYS = [3, 5, 7, 9];
const FRET_NUMBER_BOLD = [3, 5, 7, 9, 12];
/** Baseline offset that centres a capital in a marker: half the cap height of Inter. */
const CAP_CENTER = 0.364;

const kindClass: Record<NeckMarkerKind, string> = {
  home: styles.home,
  major: styles.major,
  minor: styles.minor,
  dim: styles.dim,
  extra: styles.extra,
};

interface MarkerProps {
  x: number;
  y: number;
  r: number;
  kind: NeckMarkerKind;
  numeral: string;
  dimmed?: boolean;
  title?: string;
}

/** One marker: a disc in its style, with the chord's numeral. */
function Marker({ x, y, r, kind, numeral, dimmed, title }: MarkerProps) {
  const font = numeralFontSize(numeral, r * 2);
  return (
    <g className={`${styles.marker} ${kindClass[kind]}`} data-dim={dimmed ? 'true' : undefined}>
      {title ? <title>{title}</title> : null}
      <circle className={styles.disc} cx={x} cy={y} r={r} />
      <text className={styles.numeral} x={x} y={y + font * CAP_CENTER} style={{ fontSize: font }}>
        {numeral}
      </text>
    </g>
  );
}

/** The board: string names, nut, fret wires, strings, inlays and fret numbers. */
function Board({ layout }: { layout: VerticalNeckLayout }) {
  const { fretY, markerY, stringX, boardLeft, boardRight, centerX, stringGap } = layout;
  const order = Array.from({ length: STRING_COUNT }, (_, i) => STRING_COUNT - 1 - i);
  return (
    <g aria-hidden="true">
      {order.map((string) => (
        <text key={`name-${string}`} className={styles.name} x={stringX[string]} y={layout.nameY}>
          {STRING_LABELS[string]}
        </text>
      ))}
      {Array.from({ length: NECK_FRETS }, (_, i) => i + 1).map((n) => (
        <line
          key={`fret-${n}`}
          className={n === NECK_FRETS ? styles.fretOctave : styles.fret}
          x1={boardLeft}
          x2={boardRight}
          y1={fretY[n]}
          y2={fretY[n]}
        />
      ))}
      <line className={styles.nut} x1={boardLeft} x2={boardRight} y1={fretY[0]} y2={fretY[0]} />
      {order.map((string, i) => (
        <line
          key={`string-${string}`}
          className={styles.string}
          x1={stringX[string]}
          x2={stringX[string]}
          y1={fretY[0]}
          y2={fretY[NECK_FRETS]}
          // The low strings are a little thicker: 1.7 px on the E, 0.9 on the e.
          strokeWidth={1.7 - i * 0.16}
        />
      ))}
      {INLAYS.map((n) => (
        <circle key={`inlay-${n}`} className={styles.inlay} cx={centerX} cy={markerY[n]} r={3.5} />
      ))}
      {[-stringGap, stringGap].map((dx) => (
        <circle
          key={`inlay-12-${dx}`}
          className={styles.inlay}
          cx={centerX + dx}
          cy={markerY[NECK_FRETS]}
          r={3.5}
        />
      ))}
      {Array.from({ length: NECK_FRETS }, (_, i) => i + 1).map((n) => (
        <text
          key={`number-${n}`}
          className={FRET_NUMBER_BOLD.includes(n) ? styles.numberKey : styles.number}
          x={layout.numberX}
          y={markerY[n] + 4}
        >
          {n}
        </text>
      ))}
    </g>
  );
}

interface KeyNeckProps {
  /** What the dial shows; null until the dial has told the stage. */
  info: KeyDialInfo | null;
}

export function KeyNeck({ info }: KeyNeckProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // The box the dial fills: the figure is drawn to its size.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = root;
      if (width <= 0 || height <= 0) return;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => (size ? verticalNeckLayout(size.height, size.width) : null),
    [size],
  );
  const markers = useMemo(() => (info ? neckChordMap(info) : []), [info]);
  const legend = useMemo(() => (info ? neckLegend(info) : []), [info]);

  const row = layout
    ? legendLayout(
        legend.map((item) => item.word),
        layout.markerD,
        layout.width,
      )
    : null;
  // What the markers show changes with the key and the view; they fade in as a set.
  const setKey = info ? `${info.major}|${info.state.mode}|${info.state.view}` : '';

  return (
    <figure ref={rootRef} className={styles.root}>
      {layout && info && row ? (
        <svg
          className={styles.neck}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={neckAriaLabel(info)}
        >
          <Board layout={layout} />
          <g key={setKey} className={styles.markers}>
            {markers.map((m) => (
              <Marker
                key={`${m.string}:${m.fret}`}
                x={layout.stringX[m.string]}
                y={layout.markerY[m.fret]}
                r={layout.markerR}
                kind={m.kind}
                numeral={m.numeral}
                dimmed={m.dimmed}
                title={m.title}
              />
            ))}
          </g>
          <g
            className={styles.legend}
            transform={
              row.fit < 1
                ? `translate(${layout.width / 2} ${layout.legendY}) scale(${row.fit}) translate(${-layout.width / 2} ${-layout.legendY})`
                : undefined
            }
          >
            {legend.map((item, i) => (
              <g key={item.word}>
                <Marker
                  x={row.markerX[i]}
                  y={layout.legendY}
                  r={layout.markerR}
                  kind={item.kind}
                  numeral={item.numeral}
                  dimmed={item.dimmed}
                />
                <text className={styles.word} x={row.wordX[i]} y={layout.legendY + 4}>
                  {item.word}
                </text>
              </g>
            ))}
          </g>
        </svg>
      ) : null}
    </figure>
  );
}
