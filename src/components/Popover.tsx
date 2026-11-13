import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import glass from '../styles/glass.module.css';
import styles from './Popover.module.css';

interface PopoverProps {
  /** Accessible name of the panel, e.g. "Key". */
  label: string;
  /** What the trigger button shows. */
  button: ReactNode;
  buttonLabel?: string;
  align?: 'start' | 'end';
  /** Open upward, for a trigger at the bottom of the window (the deck). */
  above?: boolean;
  /** Extra class on the trigger button. */
  buttonClassName?: string;
  /** Render prop so the content can close the popover after a choice. */
  children: (close: () => void) => ReactNode;
}

/** A pill that opens a small panel below it. Esc or a click outside closes it. */
export function Popover({
  label,
  button,
  buttonLabel,
  align = 'end',
  above = false,
  buttonClassName,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={`${open ? glass.pillSelected : glass.pill}${buttonClassName ? ` ${buttonClassName}` : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={buttonLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        {button}
      </button>
      <div
        id={panelId}
        className={[
          align === 'start' ? styles.panelStart : styles.panel,
          above ? styles.above : '',
        ].join(' ')}
        role="dialog"
        aria-label={label}
        hidden={!open}
      >
        {open ? children(() => setOpen(false)) : null}
      </div>
    </div>
  );
}
