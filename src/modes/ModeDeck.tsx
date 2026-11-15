import type { CSSProperties, ReactNode } from 'react';
import { PlayControl, type PlayControlProps } from '../components/PlayControl';
import { DisplayToggles } from '../components/DisplayToggles';
import { Deck, DeckRow } from '../components/Frame';
import type { DisplaySettings } from '../hooks/useDisplaySettings';
import type { StudyMode } from '../types/music';
import styles from './ModeDeck.module.css';

interface ModeDeckProps {
  /** The mode's own controls, at the top. */
  controls: ReactNode;
  /**
   * The mode lays out its own rows (Notes, Chords, Scales: a picker, then a
   * caption). Otherwise the controls share one row.
   */
  ownRows?: boolean;
  /** The mode's small switches, at the start of the last row. */
  options?: ReactNode;
  /** One line under the last row. */
  footnote?: ReactNode;
  /** The neck is shown: add the transport and the sound / display row. */
  showFretboard: boolean;
  /** The position bar is shown: add the Tones and Arpeggio toggles. */
  showDisplayToggles: boolean;
  /** Play sits in the band above the neck (Notes, Chords, Scales), not here. */
  playInBar?: boolean;
  /**
   * Pixels the deck may rise into the empty band under the board, so the rule
   * sits close beneath the neck in a tall window. The neck does not move.
   */
  grow?: number;
  play: PlayControlProps;
  display: DisplaySettings;
  studyMode: StudyMode;
  supportsChordTones: boolean;
}

/**
 * The deck every neck mode shares: the mode's controls on top, then Play
 * (unless it sits above the neck), then the mode's switches and the views that
 * change what is shown (Tones, Arpeggio). Sound, tempo and labels live in
 * Settings.
 */
export function ModeDeck({
  controls,
  ownRows = false,
  options,
  footnote,
  showFretboard,
  showDisplayToggles,
  playInBar = false,
  grow = 0,
  play,
  display,
  studyMode,
  supportsChordTones,
}: ModeDeckProps) {
  const toggles = showFretboard && showDisplayToggles;
  return (
    <Deck
      className={ownRows ? styles.guided : undefined}
      style={grow > 0 ? ({ '--deck-grow': `${grow}px` } as CSSProperties) : undefined}
    >
      {ownRows ? controls : <DeckRow>{controls}</DeckRow>}
      {showFretboard && !playInBar && (
        <DeckRow>
          <PlayControl {...play} />
        </DeckRow>
      )}
      {(toggles || options) && (
        <DeckRow end>
          {options}
          {toggles && (
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
          )}
        </DeckRow>
      )}
      {footnote}
    </Deck>
  );
}
