import type { ReactNode } from 'react';
import { SettingsSection } from '../../components/SettingsList';
import { TheoryNavigator } from '../../components/TheoryNavigator';
import { TheoryPanel as TheoryReading } from '../../components/TheoryPanel';
import type { TheoryState } from './useTheoryState';

/** Theory side panel: this key, the topic list, then the reading for the open topic. */
export function TheoryPanel({
  keyContext,
  theory,
}: {
  keyContext: ReactNode;
  theory: TheoryState;
}) {
  return (
    <>
      {keyContext}

      <SettingsSection title="Topics">
        <TheoryNavigator
          activeTopicId={theory.theoryTopicId}
          onTopicChange={theory.handleTheoryTopicChange}
        />
      </SettingsSection>

      <SettingsSection title="About">
        <TheoryReading theory={theory.activeTheoryTopic.theory} defaultOpen />
      </SettingsSection>
    </>
  );
}
