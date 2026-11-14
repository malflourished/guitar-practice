import type { ReactNode } from 'react';
import styles from './ModePicker.module.css';

export interface PickerItem<T extends string> {
  id: T;
  label: string;
  /** Shown on hover: the item's one line. */
  title?: string;
  disabled?: boolean;
}

export interface PickerGroup<T extends string> {
  label: string;
  /** The buttons explain themselves: the label steps aside in a narrow deck. */
  labelOptional?: boolean;
  items: PickerItem<T>[];
}

interface ModePickerProps<T extends string> {
  /** Accessible name of the whole picker, e.g. "Chord". */
  label: string;
  /** Rows of groups: each group is a small label and its buttons. */
  rows: PickerGroup<T>[][];
  value: T;
  onChange: (id: T) => void;
  /** The buttons hold chord symbols: keep their case. */
  symbols?: boolean;
}

/**
 * A menu laid open in the deck: every choice is one click away and readable
 * from playing distance, grouped under small labels.
 */
export function ModePicker<T extends string>({
  label,
  rows,
  value,
  onChange,
  symbols = false,
}: ModePickerProps<T>) {
  // One group to a row: the labels line up in a column of their own.
  const aligned = rows.every((groups) => groups.length === 1);
  const classes = [aligned ? styles.pickerAligned : styles.picker, symbols ? styles.symbols : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} role="radiogroup" aria-label={label}>
      {rows.map((groups, index) => (
        <div key={index} className={aligned ? styles.pickerRowAligned : styles.pickerRow}>
          {groups.map((group) => (
            <div
              key={group.label}
              className={aligned ? styles.groupAligned : styles.group}
              role="group"
              aria-label={group.label}
            >
              <span
                className={group.labelOptional ? styles.groupLabelOptional : styles.groupLabel}
                aria-hidden="true"
              >
                {group.label}
              </span>
              <div className={styles.items}>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={value === item.id}
                    aria-label={item.title ? `${group.label}: ${item.label}` : undefined}
                    title={item.title}
                    disabled={item.disabled}
                    className={value === item.id ? styles.pillSelected : styles.pill}
                    onClick={() => onChange(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface ModeCaptionProps {
  /** What is chosen: "C major", "A Dorian". */
  name: string;
  /** Its formula in scale degrees. */
  formula?: string;
  /** Its notes in this key. */
  notes?: string;
  /** One line about it. */
  line: string;
}

/** What is chosen, its formula and notes, and one line a teacher would say. */
export function ModeCaption({ name, formula, notes, line }: ModeCaptionProps) {
  return (
    <div className={styles.caption} data-mode-caption>
      <p className={styles.captionHead}>
        <span className={styles.captionName}>{name}</span>
        {formula ? <span className={styles.captionFormula}>{formula}</span> : null}
        {notes ? <span className={styles.captionFormula}>{notes}</span> : null}
      </p>
      <p className={styles.captionLine} title={line}>
        {line}
      </p>
    </div>
  );
}

interface PillSwitchProps<T extends string> {
  label: string;
  choices: PickerItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** The buttons hold names whose case matters (the high e string): keep it. */
  symbols?: boolean;
}

/** A label and a small either-or switch, inline in the deck's last row. */
export function PillSwitch<T extends string>({
  label,
  choices,
  value,
  onChange,
  symbols = false,
}: PillSwitchProps<T>) {
  return (
    <div
      className={symbols ? `${styles.switch} ${styles.symbols}` : styles.switch}
      role="radiogroup"
      aria-label={label}
    >
      <span className={styles.switchLabel} aria-hidden="true">
        {label}
      </span>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          role="radio"
          aria-checked={value === choice.id}
          title={choice.title}
          disabled={choice.disabled}
          className={value === choice.id ? styles.pillSelected : styles.pill}
          onClick={() => onChange(choice.id)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

/** The line under a switch that says what its choices mean. */
export function DeckFootnote({ children }: { children: ReactNode }) {
  return <p className={styles.footnote}>{children}</p>;
}

interface NeckBarProps {
  /** The Play control, at the left end. */
  play: ReactNode;
  /** The position bar, when the mode has positions. */
  children?: ReactNode;
}

/** The band above the neck: Play at the left, the position bar beside it. */
export function NeckBar({ play, children }: NeckBarProps) {
  return (
    <div className={styles.neckBar}>
      <div className={styles.neckBarPlay}>{play}</div>
      <div className={styles.neckBarSlider}>{children}</div>
    </div>
  );
}
