import type { ComponentProps, ReactNode } from 'react';
import { AudioControls } from '../components/AudioControls';
import { DisplayToggles } from '../components/DisplayToggles';
import { Deck, DeckRow } from '../components/Frame';
import type { DisplaySettings } from '../hooks/useDisplaySettings';
import type { StudyMode } from '../types/music';

interface ModeDeckProps {
  /** The mode's own controls (the first row). */
  controls: ReactNode;
  /** The neck is shown: add the transport and the sound / display row. */
  showFretboard: boolean;
  /** The position bar is shown: add the Tones and Arpeggio toggles. */
  showDisplayToggles: boolean;
  audioProps: ComponentProps<typeof AudioControls>;
  display: DisplaySettings;
  studyMode: StudyMode;
  supportsChordTones: boolean;
}

/**
 * The deck every neck mode shares: the mode's controls on top, then the
 * transport, then the views that change what is shown (Tones, Arpeggio).
 * Sound, tempo and labels live in Settings.
 */
export function ModeDeck({
  controls,
  showFretboard,
  showDisplayToggles,
  audioProps,
  display,
  studyMode,
  supportsChordTones,
}: ModeDeckProps) {
  return (
    <Deck>
      <DeckRow>{controls}</DeckRow>
      {showFretboard && (
        <DeckRow>
          <AudioControls {...audioProps} />
        </DeckRow>
      )}
      {showFretboard && showDisplayToggles && (
        <DeckRow end>
          <DisplayToggles
            showChordTones={
              supportsChordTones ? display.showChordTones : undefined
            }
            onChordTonesToggle={
              supportsChordTones
                ? () => display.setShowChordTones((prev) => !prev)
                : undefined
            }
            harmonyLayer={
              studyMode === 'scales' ? display.harmonyLayer : undefined
            }
            onHarmonyLayerChange={
              studyMode === 'scales' ? display.setHarmonyLayer : undefined
            }
          />
        </DeckRow>
      )}
    </Deck>
  );
}
