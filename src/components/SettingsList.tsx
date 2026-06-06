import type { ReactNode } from 'react';
import styles from './SettingsList.module.css';

interface SettingsListProps {
  children: ReactNode;
}

export function SettingsList({ children }: SettingsListProps) {
  return (
    <div className={styles.list} aria-label="Settings">
      {children}
    </div>
  );
}

interface SettingsSectionProps {
  title?: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className={styles.section}>
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
