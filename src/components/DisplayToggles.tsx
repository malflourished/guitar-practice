import type { HarmonyLayer, NeckViewMode } from '../types/music';
import styles from './DisplayToggles.module.css';

const NECK_VIEWS: { id: NeckViewMode; label: string }[] = [
  { id: 'single', label: 'Box' },
  { id: 'connected', label: 'Linked' },
  { id: 'full', label: 'Neck' },
];

interface DisplayTogglesProps {
  showFingers: boolean;
  onFingersToggle: () => void;
  showNoteLabels: boolean;
  fullDotOpacity: boolean;
  onNoteLabelsToggle: () => void;
  onFullDotOpacityToggle: () => void;
  showChordTones?: boolean;
  onChordTonesToggle?: () => void;
  /** Number of position regions — the neck-view toggle only shows with more than one. */
  regionCount: number;
  viewMode?: NeckViewMode;
  onViewModeChange?: (mode: NeckViewMode) => void;
  harmonyLayer?: HarmonyLayer;
  onHarmonyLayerChange?: (layer: HarmonyLayer) => void;
}

export function DisplayToggles({
  showFingers,
  onFingersToggle,
  showNoteLabels,
  fullDotOpacity,
  onNoteLabelsToggle,
  onFullDotOpacityToggle,
  showChordTones,
  onChordTonesToggle,
  regionCount,
  viewMode,
  onViewModeChange,
  harmonyLayer,
  onHarmonyLayerChange,
}: DisplayTogglesProps) {
  const showViewToggle =
    viewMode !== undefined && onViewModeChange !== undefined && regionCount > 1;
  const arpeggioActive = harmonyLayer === 'arpeggio';

  return (
    <div className={styles.toggleGroup} role="group" aria-label="Display options">
      {showViewToggle && (
        <div className={styles.viewGroup} role="group" aria-label="Neck view">
          {NECK_VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={
                viewMode === id ? styles.viewButtonActive : styles.viewButton
              }
              aria-pressed={viewMode === id}
              onClick={() => onViewModeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {onHarmonyLayerChange && (
        <button
          type="button"
          className={
            arpeggioActive ? styles.fingersButtonActive : styles.fingersButton
          }
          aria-pressed={arpeggioActive}
          aria-label="Show only chord tones (the arpeggio inside the scale)"
          onClick={() =>
            onHarmonyLayerChange(arpeggioActive ? 'scale' : 'arpeggio')
          }
        >
          Arpeggio
        </button>
      )}
      <button
        type="button"
        className={
          showFingers ? styles.fingersButtonActive : styles.fingersButton
        }
        aria-pressed={showFingers}
        aria-label={showFingers ? 'Show note names' : 'Show fingering'}
        onClick={onFingersToggle}
      >
        {showFingers ? 'Notes' : 'Fingers'}
      </button>
      <button
        type="button"
        className={
          fullDotOpacity
            ? styles.fingersButtonOpacityActive
            : showNoteLabels
              ? styles.fingersButtonActive
              : styles.fingersButton
        }
        aria-pressed={showNoteLabels || fullDotOpacity}
        aria-label="Show note and finger labels. Command-click to show all dots at full opacity."
        onClick={(event) => {
          if (event.metaKey) {
            onFullDotOpacityToggle();
            return;
          }
          onNoteLabelsToggle();
        }}
      >
        Labels
      </button>
      {onChordTonesToggle && (
        <button
          type="button"
          className={
            showChordTones ? styles.fingersButtonActive : styles.fingersButton
          }
          aria-pressed={showChordTones}
          aria-label="Show chord tone shapes"
          onClick={onChordTonesToggle}
        >
          Tones
        </button>
      )}
    </div>
  );
}
