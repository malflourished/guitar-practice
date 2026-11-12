import { useContext, useEffect, useState, type ReactNode } from 'react';
import { FrameContext, type SideState } from './frameContext';
import styles from './Frame.module.css';

/**
 * The single-screen frame (roadmap package A). The page never scrolls: a top
 * strip, the neck (which takes every spare pixel), a deck of fixed height
 * under it, and a side panel that is the only region allowed to scroll.
 *
 * Mode components return their regions as siblings (`<Neck/>`, `<Deck/>`,
 * `<SidePanel/>`); the frame's CSS grid places them by area, so a mode can
 * split its own state across regions without lifting it into App.
 */

/** How long the side panel takes to fade in or out. */
const SIDE_FADE_MS = 200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const join = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(' ');

interface FrameProps {
  side: SideState;
  focus: boolean;
  practice?: boolean;
  /** The mode shows no deck: the neck takes its height. */
  noDeck?: boolean;
  onCloseSide: () => void;
  children: ReactNode;
}

export function Frame({ side: wanted, focus, practice, noDeck, onCloseSide, children }: FrameProps) {
  // On close the panel stays for one fade before the grid gives its column
  // back; opening and switching are immediate (the panel fades itself in).
  const [shown, setShown] = useState<SideState>(wanted);
  if (wanted !== 'closed' && shown !== wanted) setShown(wanted);
  const closing = wanted === 'closed' && shown !== 'closed';
  useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(
      () => setShown('closed'),
      prefersReducedMotion() ? 0 : SIDE_FADE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [closing]);
  const side = shown;

  return (
    <FrameContext.Provider value={{ side, closing, closeSide: onCloseSide }}>
      <div
        className={`app ${styles.frame}`}
        data-side={side}
        data-focus={focus ? 'true' : undefined}
        data-practice={practice ? 'true' : undefined}
        data-deck={noDeck ? 'none' : undefined}
      >
        <div className={styles.surface} aria-hidden="true" />
        {children}
        {side === 'drawer' && (
          <div className={styles.backdrop} aria-hidden="true" onClick={onCloseSide} />
        )}
      </div>
    </FrameContext.Provider>
  );
}

export function Strip({ children }: { children: ReactNode }) {
  return (
    <header className={styles.strip} data-region="strip">
      {children}
    </header>
  );
}

export function StripEnd({ children }: { children: ReactNode }) {
  return <div className={styles.stripEnd}>{children}</div>;
}

interface NeckProps {
  /** Fixed-height bar above the board: position slider, prompt, caption. */
  bar?: ReactNode;
  /** Right end of the bar (the Focus button). */
  barEnd?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Neck({ bar, barEnd, className, children }: NeckProps) {
  return (
    // `fretboardStage` keeps the roadmap's no-scroll check snippet working.
    <section
      className={join('fretboardStage', styles.neck, className)}
      data-region="neck"
      aria-label="Neck"
    >
      <div className={styles.neckBar}>
        <div className={styles.neckBarMain}>{bar}</div>
        {barEnd ? <div className={styles.neckBarEnd}>{barEnd}</div> : null}
      </div>
      <div className={styles.neckBody}>{children}</div>
    </section>
  );
}

interface DeckProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

export function Deck({ label = 'Controls', className, children }: DeckProps) {
  return (
    <section className={join(styles.deck, className)} data-region="deck" aria-label={label}>
      {children}
    </section>
  );
}

interface DeckRowProps {
  /** Pin this row to the bottom of the deck (sound and transport). */
  end?: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}

export function DeckRow({ end, label, className, children }: DeckRowProps) {
  return (
    <div
      className={join(end ? styles.rowEnd : styles.row, className)}
      role={label ? 'group' : undefined}
      aria-label={label}
    >
      {children}
    </div>
  );
}

interface SidePanelProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export function SidePanel({ label, className, children }: SidePanelProps) {
  const { side, closing, closeSide } = useContext(FrameContext);
  if (side === 'closed') return null;
  return (
    <aside
      className={join(styles.side, className)}
      data-region="side"
      data-side={side}
      data-closing={closing ? 'true' : undefined}
      aria-label={label}
    >
      {side === 'drawer' && (
        <button type="button" className={styles.sideClose} onClick={closeSide}>
          Close
        </button>
      )}
      {children}
    </aside>
  );
}
