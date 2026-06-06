import type { NoteName } from '../types/music';
import { ALL_NOTES } from '../lib/colors';
import {
  ENHARMONIC_FLAT,
  formatNoteDisplay,
  isAccidental,
  type NotationPreference,
} from '../lib/music';
import glass from '../styles/glass.module.css';

interface KeySelectorProps {
  activeNotes: Set<NoteName>;
  notation: NotationPreference;
  singleRootMode: boolean;
  onToggle: (note: NoteName) => void;
}

export function KeySelector({
  activeNotes,
  notation,
  singleRootMode,
  onToggle,
}: KeySelectorProps) {
  return (
    <div className={glass.keyRow} role="group" aria-label="Select key">
      {ALL_NOTES.map((note) => {
        const isActive = activeNotes.has(note);
        const label = formatNoteDisplay(note, notation);
        const altName = ENHARMONIC_FLAT[note];
        const accidental = isAccidental(note);

        let className = accidental ? glass.keyTileAccidental : glass.keyTile;
        if (isActive) {
          className = accidental
            ? glass.keyTileAccidentalActive
            : glass.keyTileActive;
        }

        return (
          <button
            key={note}
            type="button"
            className={className}
            onClick={() => onToggle(note)}
            aria-pressed={isActive}
            title={
              altName
                ? `${formatNoteDisplay(note, 'sharps')} = ${formatNoteDisplay(note, 'flats')}`
                : note
            }
          >
            {label}
          </button>
        );
      })}
      {!singleRootMode && (
        <span className={glass.keyHint}>Multi-select in Notes mode</span>
      )}
    </div>
  );
}
