import type { ReactNode } from 'react';
import { ChordPositionStrip } from '../../components/ChordPositionStrip';
import { SettingsSection } from '../../components/SettingsList';
import type { DisplaySettings } from '../../hooks/useDisplaySettings';
import type { ChordPositionView, NotationPreference } from '../../lib/music';
import type { ChordQuality, NoteName } from '../../types/music';

interface ChordsPanelProps {
  /** "This key": the chords of the key (built by the frame, shown first). */
  keyContext: ReactNode;
  positions: ChordPositionView[];
  activeIndex: number;
  notation: NotationPreference;
  display: DisplaySettings;
  rootNote: NoteName;
  chordQuality: ChordQuality;
  onSelectPosition: (index: number) => void;
}

/** Chords side panel: this key, then the chord's shapes up the neck. */
export function ChordsPanel({
  keyContext,
  positions,
  activeIndex,
  notation,
  display,
  rootNote,
  chordQuality,
  onSelectPosition,
}: ChordsPanelProps) {
  return (
    <>
      {keyContext}
      {positions.length > 0 && (
        <SettingsSection title="Positions">
          <ChordPositionStrip
            wrap
            positions={positions}
            activeIndex={activeIndex}
            notation={notation}
            showFingers={display.showFingers}
            showNoteLabels={display.showNoteLabels}
            fullDotOpacity={display.fullDotOpacity}
            showChordTones={display.showChordTones}
            rootNote={rootNote}
            chordQuality={chordQuality}
            onSelectPosition={onSelectPosition}
          />
        </SettingsSection>
      )}
    </>
  );
}
