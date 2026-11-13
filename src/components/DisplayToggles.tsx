import type { HarmonyLayer } from '../types/music';
import styles from './DisplayToggles.module.css';

interface DisplayTogglesProps {
  showChordTones?: boolean;
  onChordTonesToggle?: () => void;
  harmonyLayer?: HarmonyLayer;
  onHarmonyLayerChange?: (layer: HarmonyLayer) => void;
}

export function DisplayToggles({
  showChordTones,
  onChordTonesToggle,
  harmonyLayer,
  onHarmonyLayerChange,
}: DisplayTogglesProps) {
  const arpeggioActive = harmonyLayer === 'arpeggio';

  return (
    <div className={styles.toggleGroup} role="group" aria-label="Display options">
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
