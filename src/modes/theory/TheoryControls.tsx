import { TheoryActions } from '../../components/TheoryStage';
import type { TheoryState } from './useTheoryState';

interface TheoryControlsProps {
  theory: TheoryState;
  onShowFretboardChange: (show: boolean) => void;
  onPracticeLink: () => void;
}

/**
 * Theory's controls: the view pills, Dial | Neck and the practice link. A
 * topic with a dial keeps them in the stage beside the figure, in both Dial and
 * Neck (the figure takes the deck's height); a topic without one keeps them in
 * the deck, with Show on fretboard.
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
      showFretboard={theory.theoryNeckChosen}
      onShowFretboardChange={onShowFretboardChange}
      onPracticeLink={
        theory.activeTheoryTopic.practiceLink ? onPracticeLink : undefined
      }
    />
  );
}
