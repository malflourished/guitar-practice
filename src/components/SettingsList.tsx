import type { ReactNode } from 'react';
import styles from './SettingsList.module.css';

/*
 * Since the single-screen layout, sections titled like "This key" or
 * "Topics" live in the side panel, and rows (a label beside its control)
 * sit inline in the deck.
 */

interface SettingsSectionProps {
  title?: string;
  /** Lets Settings scroll to this section when it opens at it. */
  id?: string;
  children: ReactNode;
}

export function SettingsSection({ title, id, children }: SettingsSectionProps) {
  return (
    <section id={id} className={styles.section}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  children: ReactNode;
  stack?: boolean;
  fullWidth?: boolean;
}

export function SettingsRow({
  label,
  children,
  stack = false,
  fullWidth = false,
}: SettingsRowProps) {
  if (stack) {
    return (
      <div className={styles.rowStack}>
        <span className={styles.rowLabel}>{label}</span>
        <div
          className={fullWidth ? styles.rowControlFull : styles.rowControl}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={fullWidth ? styles.rowControlFull : styles.rowControl}>
        {children}
      </div>
    </div>
  );
}
