import type { UseInstrument } from '../../hooks/useInstrument';
import type { UseNeckView } from '../../hooks/useNeckView';
import type { KeyMode, NoteName } from '../../types/music';
import type { ModeStates } from '../types';

/** Theory's moves: pick a key on the wheel, show the neck, jump out and back. */
export function useTheoryActions(
  { setStudyMode, keyState, scales, theory }: ModeStates,
  audio: UseInstrument,
  neckView: UseNeckView,
) {
  const { setActiveNotes, setKeyCenter, setKeyMode } = keyState;
  const {
    activeTheoryTopic,
    theoryShowFretboard,
    theoryReturn,
    setTheoryReturn,
    setTheoryShowFretboard,
    setTheoryTopicId,
  } = theory;

  const handleBackToTheory = () => {
    if (!theoryReturn) return;
    audio.stopAll();
    setStudyMode('theory');
    setTheoryTopicId(theoryReturn.topicId);
    setTheoryShowFretboard(theoryReturn.showFretboard);
    setTheoryReturn(null);
  };

  const handleTheoryKeySelect = (note: NoteName, mode: KeyMode) => {
    setActiveNotes(new Set([note]));
    setKeyCenter(note);
    setKeyMode(mode);
  };

  const handleTheoryShowFretboard = (show: boolean) => {
    setTheoryShowFretboard(show);
    const demoView = activeTheoryTopic.fretboardDemo?.neckView;
    if (show && demoView) {
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
      showFretboard: theoryShowFretboard,
    });
    setStudyMode(link.mode);
    if (link.scaleQuality) {
      scales.setScaleQuality(link.scaleQuality);
    }
    if (link.neckView) {
      neckView.applySpanPreset(link.neckView);
    }
    setTheoryShowFretboard(false);
  };

  return {
    handleBackToTheory,
    handleTheoryKeySelect,
    handleTheoryShowFretboard,
    handleTheoryPracticeLink,
  };
}
