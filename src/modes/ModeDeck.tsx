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
  /** The position bar is shown: add the dot-display toggles. */
  showDisplayToggles: boolean;
  audioProps: Omit<ComponentProps<typeof AudioControls>, 'part'>;
  display: DisplaySettings;
  studyMode: StudyMode;
  supportsChordTones: boolean;
}

/**
 * The deck every neck mode shares: the mode's controls on top, then the
 * transport, then sound and dot display pinned to the bottom.
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
          <AudioControls part="transport" {...audioProps} />
        </DeckRow>
      )}
      {showFretboard && (
        <DeckRow end>
          <AudioControls part="sound" {...audioProps} />
          {showDisplayToggles && (
            <DisplayToggles
              showFingers={display.showFingers}
              onFingersToggle={() => display.setShowFingers((prev) => !prev)}
              showNoteLabels={display.showNoteLabels}
              fullDotOpacity={display.fullDotOpacity}
              onNoteLabelsToggle={() =>
                display.setShowNoteLabels((prev) => !prev)
              }
              onFullDotOpacityToggle={() =>
                display.setFullDotOpacity((prev) => !prev)
              }
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
          )}
        </DeckRow>
      )}
    </Deck>
  );
}
