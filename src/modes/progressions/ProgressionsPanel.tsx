import type { ReactNode } from 'react';
import { ProgressionStrip } from '../../components/ProgressionStrip';
import { SettingsSection } from '../../components/SettingsList';
import { TheoryPanel } from '../../components/TheoryPanel';
import type { DisplaySettings } from '../../hooks/useDisplaySettings';
import type { NotationPreference } from '../../lib/music';
import type { ProgressionViews } from './useProgressionViews';
import type { ProgressionsState } from './useProgressionsState';

interface ProgressionsPanelProps {
  keyContext: ReactNode;
  progressions: ProgressionsState;
  views: ProgressionViews;
  notation: NotationPreference;
  display: DisplaySettings;
}

/** Progressions side panel: this key, the chord diagrams, and the reading. */
export function ProgressionsPanel({
  keyContext,
  progressions,
  views,
  notation,
  display,
}: ProgressionsPanelProps) {
  const {
    progressionStepIndex,
    setProgressionStepIndex,
    activeProgression,
    activeProgressionStep,
    resolvedProgressionSteps,
    currentStepRole,
  } = progressions;
  const { displayProgressionChordViews } = views;

  return (
    <>
      {keyContext}

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
    </>
  );
}
