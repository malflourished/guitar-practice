import { TheoryActions } from '../../components/TheoryStage';
import type { TheoryState } from './useTheoryState';

interface TheoryControlsProps {
  theory: TheoryState;
  onShowFretboardChange: (show: boolean) => void;
  onPracticeLink: () => void;
}

/**
 * Theory's controls: Dial | Neck, the diagram switch and the practice link.
 * They sit in the deck when the neck is shown, and inside the stage beside
 * the dial otherwise (the dial takes the deck's height).
 */
export function TheoryControls({
  theory,
  onShowFretboardChange,
  onPracticeLink,
}: TheoryControlsProps) {
  return (
    <TheoryActions
      topic={theory.activeTheoryTopic}
      diagramView={theory.theoryDiagramView}
      onDiagramViewChange={theory.setTheoryDiagramView}
      showFretboard={theory.theoryShowFretboard}
      onShowFretboardChange={onShowFretboardChange}
      onPracticeLink={
        theory.activeTheoryTopic.practiceLink ? onPracticeLink : undefined
      }
    />
  );
}
