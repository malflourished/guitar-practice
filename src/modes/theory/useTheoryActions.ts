import type { UseInstrument } from '../../hooks/useInstrument';
import type { UseNeckView } from '../../hooks/useNeckView';
import type { KeyMode, NoteName } from '../../types/music';
import type { ModeStates } from '../types';

/** Theory's moves: pick a key on the dial, switch to the neck, jump out and back. */
export function useTheoryActions(
  { setStudyMode, keyState, scales, theory }: ModeStates,
  audio: UseInstrument,
  neckView: UseNeckView,
) {
  const { setActiveNotes, setKeyCenter, setKeyMode } = keyState;
  const {
    activeTheoryTopic,
    theoryNeckChosen,
    theoryReturn,
    setTheoryReturn,
    setTheoryNeckChosen,
    setTheoryTopicId,
  } = theory;

  const handleBackToTheory = () => {
    if (!theoryReturn) return;
    audio.stopAll();
    setStudyMode('theory');
    setTheoryTopicId(theoryReturn.topicId);
    setTheoryNeckChosen(theoryReturn.showFretboard);
    setTheoryReturn(null);
  };

  const handleTheoryKeySelect = (note: NoteName, mode: KeyMode) => {
    setActiveNotes(new Set([note]));
    setKeyCenter(note);
    setKeyMode(mode);
  };

  // Dial | Neck, or Show on fretboard where the topic has no dial. Only the
  // fretboard demo has a neck view to set; the vertical neck has none.
  const handleTheoryShowFretboard = (show: boolean) => {
    setTheoryNeckChosen(show);
    const demoView = activeTheoryTopic.fretboardDemo?.neckView;
    if (show && demoView && !activeTheoryTopic.diagram) {
      neckView.applySpanPreset(demoView);
    }
  };

  const handleTheoryPracticeLink = () => {
    const link = activeTheoryTopic.practiceLink;
    if (!link) return;
    setTheoryReturn({
      mode: link.mode,
      topicId: activeTheoryTopic.id,
      title: activeTheoryTopic.title,
      showFretboard: theoryNeckChosen,
    });
    setStudyMode(link.mode);
    if (link.scaleQuality) {
      scales.setScaleQuality(link.scaleQuality);
    }
    if (link.neckView) {
      neckView.applySpanPreset(link.neckView);
    }
    setTheoryNeckChosen(false);
  };

  return {
    handleBackToTheory,
    handleTheoryKeySelect,
    handleTheoryShowFretboard,
    handleTheoryPracticeLink,
  };
}
