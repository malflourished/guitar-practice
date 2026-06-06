import { useState } from 'react';
import type { NoteName } from '../types/music';
import { ALL_NOTES } from '../lib/colors';
import { ENHARMONIC_FLAT } from '../lib/music';
import styles from './DebugPanel.module.css';

interface DebugPanelProps {
  whiteBackground: boolean;
  whiteText: boolean;
  showColorEditor: boolean;
  noteColors: Record<NoteName, string>;
  onWhiteBackgroundChange: (value: boolean) => void;
  onWhiteTextChange: (value: boolean) => void;
  onColorChange: (note: NoteName, color: string) => void;
  onColorReset: () => void;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function paletteToCode(colors: Record<NoteName, string>): string {
  const lines = ALL_NOTES.map((note) => {
    const key = note.includes('#') ? `'${note}'` : note;
    return `  ${key}: '${colors[note].toUpperCase()}',`;
  });
  return `export const NOTE_COLORS: Record<NoteName, string> = {\n${lines.join('\n')}\n};`;
}

function DebugToggle({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={pressed ? styles.toggleActive : styles.toggle}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function DebugPanel({
  whiteBackground,
  whiteText,
  showColorEditor,
  noteColors,
  onWhiteBackgroundChange,
  onWhiteTextChange,
  onColorChange,
  onColorReset,
}: DebugPanelProps) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paletteToCode(noteColors));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        Debug {open ? '▾' : '▸'}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Background</span>
            <div className={styles.toggleGroup}>
              <DebugToggle
                label="Black"
                pressed={!whiteBackground}
                onClick={() => onWhiteBackgroundChange(false)}
              />
              <DebugToggle
                label="White"
                pressed={whiteBackground}
                onClick={() => onWhiteBackgroundChange(true)}
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Text</span>
            <div className={styles.toggleGroup}>
              <DebugToggle
                label="Black"
                pressed={!whiteText}
                onClick={() => onWhiteTextChange(false)}
              />
              <DebugToggle
                label="White"
                pressed={whiteText}
                onClick={() => onWhiteTextChange(true)}
              />
            </div>
          </div>

          {showColorEditor && (
            <>
              <div className={styles.divider} />
              <p className={styles.sectionTitle}>Note colors</p>
              <div className={styles.colorGrid}>
                {ALL_NOTES.map((note) => {
                  const flat = ENHARMONIC_FLAT[note];
                  const label = flat ? `${note}/${flat}` : note;
                  const color = noteColors[note];
                  return (
                    <label key={note} className={styles.swatch}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={color}
                        onChange={(event) =>
                          onColorChange(note, event.target.value)
                        }
                        aria-label={`${label} color`}
                      />
                      <span className={styles.noteName}>{label}</span>
                      <input
                        type="text"
                        className={styles.hexInput}
                        value={color}
                        spellCheck={false}
                        onChange={(event) => {
                          const next = event.target.value.trim();
                          if (HEX_PATTERN.test(next)) {
                            onColorChange(note, next);
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied!' : 'Copy as code'}
                </button>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={onColorReset}
                >
                  Reset to defaults
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
