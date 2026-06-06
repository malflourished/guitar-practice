import { useState } from 'react';
import type { NoteName } from '../types/music';
import { ALL_NOTES } from '../lib/colors';
import { ENHARMONIC_FLAT } from '../lib/music';
import styles from './ColorDebugPanel.module.css';

interface ColorDebugPanelProps {
  noteColors: Record<NoteName, string>;
  onColorChange: (note: NoteName, color: string) => void;
  onReset: () => void;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function paletteToCode(colors: Record<NoteName, string>): string {
  const lines = ALL_NOTES.map((note) => {
    const key = note.includes('#') ? `'${note}'` : note;
    return `  ${key}: '${colors[note].toUpperCase()}',`;
  });
  return `export const NOTE_COLORS: Record<NoteName, string> = {\n${lines.join('\n')}\n};`;
}

export function ColorDebugPanel({
  noteColors,
  onColorChange,
  onReset,
}: ColorDebugPanelProps) {
  const [open, setOpen] = useState(false);
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
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? 'Hide' : 'Edit'} colors (debug)
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.grid}>
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
                    onChange={(event) => onColorChange(note, event.target.value)}
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
            <button type="button" className={styles.actionButton} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy as code'}
            </button>
            <button type="button" className={styles.actionButton} onClick={onReset}>
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
