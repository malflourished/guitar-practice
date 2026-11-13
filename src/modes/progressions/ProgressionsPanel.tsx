import type { ReactNode } from 'react';
import { ProgressionStrip } from '../../components/ProgressionStrip';
import { SettingsSection } from '../../components/SettingsList';
import { TheoryPanel } from '../../components/TheoryPanel';
import type { DisplaySettings } from '../../hooks/useDisplaySettings';
import {
  getProgressionLibraryEntry,
  type NotationPreference,
} from '../../lib/music';
import { ProgressionLibrary, ProgressionNotes } from './ProgressionLibrary';
import type { ProgressionViews } from './useProgressionViews';
import type { ProgressionsState } from './useProgressionsState';

interface ProgressionsPanelProps {
  keyContext: ReactNode;
  progressions: ProgressionsState;
  views: ProgressionViews;
  notation: NotationPreference;
  display: DisplaySettings;
}

/** Progressions side panel: this key, the library, the chord diagrams, and the reading. */
export function ProgressionsPanel({
  keyContext,
  progressions,
  views,
  notation,
  display,
}: ProgressionsPanelProps) {
  const {
    progressionId,
    handleProgressionChange,
    progressionStepIndex,
    setProgressionStepIndex,
    activeProgression,
    activeProgressionStep,
    resolvedProgressionSteps,
    currentStepRole,
  } = progressions;
  const { displayProgressionChordViews } = views;
  const entry = getProgressionLibraryEntry(progressionId);

  return (
    <>
      {keyContext}

      <SettingsSection title="Library">
        <ProgressionLibrary
          activeId={progressionId}
          onSelect={handleProgressionChange}
        />
      </SettingsSection>

      {entry && (
        <SettingsSection>
          <ProgressionNotes entry={entry} />
        </SettingsSection>
      )}

      {displayProgressionChordViews.length > 0 && (
        <SettingsSection title="Chords">
          <ProgressionStrip
            wrap
            chords={displayProgressionChordViews}
            activeIndex={progressionStepIndex}
            notation={notation}
            showFingers={display.showFingers}
            showNoteLabels={display.showNoteLabels}
            fullDotOpacity={display.fullDotOpacity}
            showChordTones={display.showChordTones}
            onSelectStep={setProgressionStepIndex}
          />
        </SettingsSection>
      )}

      {activeProgression.theory.body.length > 0 && (
        <SettingsSection title="About">
          <TheoryPanel
            theory={activeProgression.theory}
            currentStepLabel={
              activeProgressionStep
                ? `${activeProgressionStep.chordName} (${activeProgressionStep.numeral})`
                : undefined
            }
            currentStepRole={currentStepRole}
            resolvedChords={resolvedProgressionSteps
              .map((step) => step.chordName)
              .join(' – ')}
          />
        </SettingsSection>
      )}
    </>
  );
}
