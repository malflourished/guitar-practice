import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent } from 'react';
import type { KeyMode, NoteName, TheoryDiagram } from '../types/music';
import type { NotationPreference } from '../lib/music/notes';
import {
  DIAL_ALTERNATE,
  DIAL_MAJORS,
  defaultCellLabel,
  defaultSignature,
  describeKeyDial,
  dialKeyFor,
  dialNameToNote,
  type DialCell,
  type DialRing,
} from '../lib/music/keyDial';
import styles from './KeyDial.module.css';

/*
 * One dial for keys and chords. Geometry is in a 1000-unit view box (see
 * docs/design/key-wheel/): three rings, a window that turns to the key, key
 * signatures on the bezel. Labels stay upright; only the window turns.
 */

const C = 500;
const RINGS: Record<DialRing, { r0: number; r1: number; font: number; gap: number }> = {
  major: { r0: 336, r1: 430, font: 44, gap: 9 },
  minor: { r0: 256, r1: 336, font: 30, gap: 7 },
  dim: { r0: 196, r1: 256, font: 22, gap: 6 },
};
const RING_ORDER: DialRing[] = ['major', 'minor', 'dim'];
/** Numerals, alternates and key signatures. */
const SMALL = 20;
/** Inter's cap height as a share of the font size. */
const CAP = 0.72;
/** No rendered text is smaller than this many pixels. */
const MIN_PX = 12;

const rad = (deg: number) => (deg * Math.PI) / 180;
const point = (r: number, deg: number): [number, number] => [
  C + r * Math.sin(rad(deg)),
  C - r * Math.cos(rad(deg)),
];
const pt = (r: number, deg: number) =>
  point(r, deg)
    .map((v) => v.toFixed(2))
    .join(' ');
const arc = (r: number, a0: number, a1: number) =>
  `M${pt(r, a0)} A${r} ${r} 0 0 1 ${pt(r, a1)}`;
const sector = (r0: number, r1: number, a0: number, a1: number) =>
  `M${pt(r1, a0)} A${r1} ${r1} 0 0 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 0 0 ${pt(r0, a0)} Z`;
/** The window at the top of the dial: three columns over both rings, plus vii° under V. */
const WINDOW_SHAPE = `M${pt(430, -45)} A430 430 0 0 1 ${pt(430, 45)} L${pt(196, 45)} A196 196 0 0 0 ${pt(196, 15)} L${pt(256, 15)} A256 256 0 0 0 ${pt(256, -45)} Z`;
const WINDOW_SEPARATORS = `${arc(336, -45, 45)} ${arc(256, 15, 45)} M${pt(256, -15)} L${pt(430, -15)} M${pt(256, 15)} L${pt(430, 15)}`;
const DOMINANTS_ARC = sector(336, 430, 45, 165);
const HOME_MAJOR = sector(336, 430, -15, 15);
const HOME_MINOR = sector(256, 336, -15, 15);

const mod = (n: number, m: number) => ((n % m) + m) % m;

interface KeyDialProps {
  selectedRoot: NoteName;
  keyMode: KeyMode;
  onSelectKey: (root: NoteName, mode: KeyMode) => void;
  view: TheoryDiagram;
  /** Which name a black-key root takes when the two cost the same (F♯ or G♭). */
  notation?: NotationPreference;
}

function usePrefersReducedMotion(): () => boolean {
  return useCallback(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
}

export function KeyDial({
  selectedRoot,
  keyMode,
  onSelectKey,
  view,
  notation = 'sharps',
}: KeyDialProps) {
  // The one position printed both ways. The app only knows pitches, so the
  // dial remembers which name was clicked last (F♯ again gives G♭).
  const [sixPick, setSixPick] = useState<{ root: NoteName; flat: boolean } | null>(null);

  const keyName = useMemo(() => {
    const base = dialKeyFor(selectedRoot, keyMode, notation);
    if (dialNameToNote(base.major) !== 'F#') return base.major;
    if (sixPick && sixPick.root === selectedRoot) {
      return sixPick.flat ? DIAL_ALTERNATE[6] : DIAL_MAJORS[6];
    }
    return base.major;
  }, [selectedRoot, keyMode, notation, sixPick]);

  const info = useMemo(
    () => describeKeyDial({ major: keyName, mode: keyMode, view }),
    [keyName, keyMode, view],
  );
  const infoKey = `${keyName}|${keyMode}|${view}`;
  const [litKey, setLitKey] = useState(infoKey);
  const lit = litKey === infoKey;

  // Rendered width in px sets the smallest text the view box may carry.
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const measure = () => {
      const width = svg.getBoundingClientRect().width;
      if (width > 0) setScale(width / 1000);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const fs = (design: number) => Math.max(design, MIN_PX / scale);

  // The window turns the short way round, then lights the chords it lands on.
  const turnRef = useRef<SVGGElement>(null);
  const angleRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const target = info.k * 30;
  useLayoutEffect(() => {
    const turn = turnRef.current;
    if (!turn) return undefined;
    let cancelled = false;
    let frame = 0;
    const apply = (angle: number) =>
      turn.setAttribute('transform', `rotate(${angle} ${C} ${C})`);

    const start = angleRef.current;
    const delta = start === null ? 0 : mod(target - start + 180, 360) - 180;
    if (start === null || reduced() || Math.abs(delta) < 0.01) {
      angleRef.current = start === null ? target : start + delta;
      apply(angleRef.current);
      setLitKey(infoKey);
      return undefined;
    }
    const duration = 380 + Math.abs(delta) * 2.2;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      angleRef.current = start + delta * (1 - Math.pow(1 - t, 3));
      apply(angleRef.current);
      if (t < 1) frame = requestAnimationFrame(tick);
      else if (!cancelled) setLitKey(infoKey);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [target, infoKey, reduced]);

  const select = (ring: DialRing, pos: number) => {
    const here = info.k === pos;
    let major: string = DIAL_MAJORS[pos];
    let flat = false;
    if (pos === 6) {
      flat =
        here && keyMode === ring
          ? keyName !== DIAL_ALTERNATE[6]
          : here && keyName === DIAL_ALTERNATE[6];
      major = flat ? DIAL_ALTERNATE[6] : DIAL_MAJORS[6];
    }
    const next = describeKeyDial({
      major,
      mode: ring === 'minor' ? 'minor' : 'major',
      view,
    });
    const root = dialNameToNote(next.tonic);
    if (pos === 6) setSixPick({ root, flat });
    onSelectKey(root, ring === 'minor' ? 'minor' : 'major');
  };

  const handleKey = (event: KeyboardEvent<SVGElement>, ring: DialRing, pos: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(ring, pos);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      select(keyMode === 'minor' ? 'minor' : 'major', mod(info.k + (event.key === 'ArrowRight' ? 1 : -1), 12));
    }
  };

  // What is lit, by ring and position. The key's own chords sit on top.
  const litCells = new Map<string, { cell: DialCell; secondary: boolean }>();
  if (lit) {
    for (const cell of info.extra) litCells.set(`${cell.ring}${cell.pos}`, { cell, secondary: true });
    for (const cell of info.main) litCells.set(`${cell.ring}${cell.pos}`, { cell, secondary: false });
  }

  const sigFont = fs(SMALL);

  return (
    <figure className={styles.root}>
      <div className={styles.dialBox}>
        <svg
          ref={svgRef}
          viewBox="0 0 1000 1000"
          className={styles.dial}
          role="group"
          aria-label="Circle of fifths with the chords of the selected key"
        >
          {/* Bezel: ring lines, minute ticks and key signatures. */}
          <g>
            {(
              [
                [430, 0.24],
                [336, 0.13],
                [256, 0.11],
                [196, 0.22],
              ] as const
            ).map(([r, opacity]) => (
              <circle key={r} cx={C} cy={C} r={r} className={styles.hair} strokeOpacity={opacity} />
            ))}
            {Array.from({ length: 60 }, (_, i) => {
              const long = i % 5 === 0;
              const [x1, y1] = point(long ? 437 : 443, i * 6);
              const [x2, y2] = point(long ? 452 : 448, i * 6);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={styles.tick}
                  strokeOpacity={long ? 0.5 : 0.2}
                />
              );
            })}
            {DIAL_MAJORS.map((_, p) => {
              const [x, y] = point(476, p * 30);
              const home = p === info.k;
              return (
                <text
                  key={p}
                  x={x}
                  y={y + (sigFont * CAP) / 2}
                  className={home ? `${styles.sig} ${styles.sigHome}` : styles.sig}
                  style={{ fontSize: sigFont }}
                >
                  {home ? info.signature : defaultSignature(p)}
                </text>
              );
            })}
          </g>

          {/* The window, drawn at the top and turned to the key. */}
          <g ref={turnRef}>
            <path
              d={WINDOW_SHAPE}
              className={`${styles.ghost} ${view === 'borrowed' ? styles.ghostOn : ''}`}
              transform={`rotate(${typeof info.ghost === 'number' ? info.ghost : 0} ${C} ${C})`}
            />
            <path
              d={DOMINANTS_ARC}
              className={`${styles.ghost} ${view === 'dominants' ? styles.ghostOn : ''}`}
            />
            <path d={WINDOW_SHAPE} className={styles.win} />
            <path d={keyMode === 'minor' ? HOME_MINOR : HOME_MAJOR} className={styles.homeCell} />
            <path d={WINDOW_SEPARATORS} className={styles.sep} />
            <line
              x1={point(424, 0)[0]}
              y1={point(424, 0)[1]}
              x2={point(462, 0)[0]}
              y2={point(462, 0)[1]}
              className={styles.homeTick}
            />
          </g>

          {/* One cell per ring and position: a hit area and an upright label. */}
          <g>
            {RING_ORDER.map((ring) => {
              const spec = RINGS[ring];
              const rc = (spec.r0 + spec.r1) / 2;
              const font = fs(spec.font);
              const small = fs(SMALL);
              const capL = font * CAP;
              const capS = small * CAP;
              const clickable = ring !== 'dim';
              return DIAL_MAJORS.map((_, p) => {
                const [x, y] = point(rc, p * 30);
                const entry = litCells.get(`${ring}${p}`);
                const text = entry ? entry.cell.label : defaultCellLabel(ring, p);
                const alternate = clickable && DIAL_ALTERNATE[p] !== undefined && !entry;
                const shift = (spec.gap + capS) / 2;
                const height = capS + spec.gap + capL;
                const offset = entry ? (capS + spec.gap) / 2 : alternate ? -shift : 0;
                const classes = [styles.cell, styles[ring]];
                if (entry) classes.push(entry.secondary ? styles.lit2 : styles.lit);
                if (entry?.cell.home) classes.push(styles.home);
                return (
                  <g
                    key={`${ring}${p}`}
                    className={classes.join(' ')}
                    {...(clickable
                      ? {
                          tabIndex: 0,
                          role: 'button',
                          'aria-label': `${text} ${ring}`,
                          'aria-pressed': entry?.cell.home === true,
                          onClick: () => select(ring, p),
                          onKeyDown: (event: KeyboardEvent<SVGGElement>) => handleKey(event, ring, p),
                        }
                      : {})}
                  >
                    <path d={sector(spec.r0, spec.r1, p * 30 - 15, p * 30 + 15)} className={styles.hit} />
                    <text
                      x={x}
                      y={y + capL / 2}
                      className={styles.label}
                      style={{ fontSize: font, transform: `translate(0px, ${offset}px)` }}
                    >
                      {text}
                    </text>
                    {alternate ? (
                      <text
                        x={x}
                        y={y + capL / 2 - shift + spec.gap + capS}
                        className={styles.alt}
                        style={{ fontSize: small }}
                      >
                        {ring === 'major' ? DIAL_ALTERNATE[p] : alternateMinor(p)}
                      </text>
                    ) : null}
                    {entry ? (
                      <text
                        x={x}
                        y={y - height / 2 + capS}
                        className={[
                          styles.numeral,
                          entry.secondary ? styles.numeralSecondary : '',
                          entry.cell.home ? styles.numeralHome : '',
                        ].join(' ')}
                        style={{ fontSize: small }}
                      >
                        {entry.cell.numeral}
                      </text>
                    ) : null}
                  </g>
                );
              });
            })}
          </g>

          {/* The plate: the key at the centre. */}
          <text x={C} y={C + 16} className={styles.plateKey} style={{ fontSize: fs(150) }}>
            {info.plate.key}
          </text>
          <text x={C} y={C + 64} className={styles.plateSub} style={{ fontSize: fs(20) }}>
            {info.plate.sub}
          </text>
          <text x={C} y={C + 98} className={styles.plateRel} style={{ fontSize: fs(22) }}>
            {info.plate.rel}
          </text>
        </svg>
      </div>
      <figcaption className={styles.caption}>
        {info.caption.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </figcaption>
    </figure>
  );
}

/** The other name of the minor at the six-accidental position (E♭m beside D♯m). */
function alternateMinor(pos: number): string {
  const flatMajor = DIAL_ALTERNATE[pos];
  return describeKeyDial({ major: flatMajor, mode: 'minor', view: 'in-key' }).tonic + 'm';
}
