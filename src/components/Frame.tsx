import { useContext, type ReactNode } from 'react';
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

const join = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(' ');

interface FrameProps {
  side: SideState;
  focus: boolean;
  practice?: boolean;
  onCloseSide: () => void;
  children: ReactNode;
}

export function Frame({ side, focus, practice, onCloseSide, children }: FrameProps) {
  return (
    <FrameContext.Provider value={{ side, closeSide: onCloseSide }}>
      <div
        className={`app ${styles.frame}`}
        data-side={side}
        data-focus={focus ? 'true' : undefined}
        data-practice={practice ? 'true' : undefined}
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
  const { side, closeSide } = useContext(FrameContext);
  if (side === 'closed') return null;
  return (
    <aside
      className={join(styles.side, className)}
      data-region="side"
      data-side={side}
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
