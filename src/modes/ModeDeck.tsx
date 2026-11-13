import type { ReactNode } from 'react';
import { PlayControl, type PlayControlProps } from '../components/PlayControl';
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
  play: PlayControlProps;
  display: DisplaySettings;
  studyMode: StudyMode;
  supportsChordTones: boolean;
}

/**
 * The deck every neck mode shares: the mode's controls on top, then
 * Play, then the views that change what is shown (Tones, Arpeggio).
 * Sound, tempo and labels live in Settings.
 */
export function ModeDeck({
  controls,
  showFretboard,
  showDisplayToggles,
  play,
  display,
  studyMode,
  supportsChordTones,
}: ModeDeckProps) {
  return (
    <Deck>
      <DeckRow>{controls}</DeckRow>
      {showFretboard && (
        <DeckRow>
          <PlayControl {...play} />
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
