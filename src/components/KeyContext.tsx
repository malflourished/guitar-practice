import type { ChordQuality, KeyMode, NoteName } from '../types/music';
import {
  formatChordName,
  formatNoteDisplay,
  getDiatonicQuality,
  getDiatonicRoot,
  getRelativeMajor,
  getRelativeMinor,
  type NotationPreference,
} from '../lib/music';
import styles from './KeyContext.module.css';

const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_NUMERALS = ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'];

interface KeyContextProps {
  keyRoot: NoteName;
  keyMode: KeyMode;
  notation: NotationPreference;
  /** Hide the maj/min toggle when the mode is implied by the current context. */
  keyModeLocked?: boolean;
  onKeyModeChange: (mode: KeyMode) => void;
  /** Open Chords mode on a diatonic chord. */
  onSelectChord: (root: NoteName, quality: ChordQuality) => void;
  /** Open Scales mode on the key's scale. */
  onSelectScale: () => void;
  /** Open Progressions mode in this key. */
  onSelectProgressions: () => void;
  /** Open the relative key (swaps root + mode). */
  onSelectRelative: (root: NoteName, mode: KeyMode) => void;
  /** Open the Theory topic explaining diatonic chords. */
  onExplainChords: () => void;
}

/**
 * The connective tissue between modes: every facet of the current key, one
 * click away. Chord chips open Chords mode preloaded; Scale/Progressions/Why
 * links carry the key with them.
 */
export function KeyContext({
  keyRoot,
  keyMode,
  notation,
  keyModeLocked = false,
  onKeyModeChange,
  onSelectChord,
  onSelectScale,
  onSelectProgressions,
  onSelectRelative,
  onExplainChords,
}: KeyContextProps) {
  const numerals = keyMode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;
  const relativeRoot =
    keyMode === 'major' ? getRelativeMinor(keyRoot) : getRelativeMajor(keyRoot);
  const relativeMode: KeyMode = keyMode === 'major' ? 'minor' : 'major';
  const relativeLabel = `${formatNoteDisplay(relativeRoot, notation)} ${
    relativeMode === 'minor' ? 'minor' : 'major'
  }`;

  return (
    <div className={styles.wrap}>
      {!keyModeLocked && (
        <div className={styles.modeRow} role="group" aria-label="Key mode">
          {(['major', 'minor'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={
                keyMode === mode ? styles.modeButtonActive : styles.modeButton
              }
              aria-pressed={keyMode === mode}
              onClick={() => onKeyModeChange(mode)}
            >
              {mode === 'major' ? 'Major' : 'Minor'}
            </button>
          ))}
        </div>
      )}

      <div className={styles.chips} role="group" aria-label="Diatonic chords">
        {numerals.map((numeral, index) => {
          const degree = index + 1;
          const root = getDiatonicRoot(keyRoot, keyMode, degree);
          const quality = getDiatonicQuality(keyMode, degree);
          return (
            <button
              key={numeral}
              type="button"
              className={styles.chip}
              title={`Open ${formatChordName(root, quality, notation)} in Chords`}
              onClick={() => onSelectChord(root, quality)}
            >
              <span className={styles.chipNumeral}>{numeral}</span>
              <span className={styles.chipName}>
                {formatChordName(root, quality, notation)}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.links}>
        <button type="button" className={styles.link} onClick={onSelectScale}>
          Scale →
        </button>
        <button
          type="button"
          className={styles.link}
          onClick={onSelectProgressions}
        >
          Progressions →
        </button>
        <button
          type="button"
          className={styles.link}
          onClick={() => onSelectRelative(relativeRoot, relativeMode)}
        >
          Relative: {relativeLabel} →
        </button>
        <button type="button" className={styles.link} onClick={onExplainChords}>
          Why these chords? →
        </button>
      </div>
    </div>
  );
}
