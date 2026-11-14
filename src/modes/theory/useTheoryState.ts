import { useMemo, useState } from 'react';
import {
  DEFAULT_THEORY_TOPIC_ID,
  THEORY_TOPICS,
  getTheoryTopicById,
} from '../../lib/music';
import { oneOf, usePersistentState } from '../../hooks/usePersistentState';
import type { StudyMode, TheoryDiagram } from '../../types/music';

/** Set when a Theory link jumps to another mode; shows "← Back to <topic>". */
export interface TheoryReturn {
  mode: StudyMode;
  topicId: string;
  title: string;
  /** Whether Neck was on when the link was followed (the vertical neck or the fretboard demo). */
  showFretboard: boolean;
}

export function useTheoryState(studyMode: StudyMode) {
  const [theoryTopicId, setTheoryTopicId] = usePersistentState(
    'theory-topic',
    DEFAULT_THEORY_TOPIC_ID,
    oneOf(THEORY_TOPICS.map((topic) => topic.id)),
  );
  // Neck, as the player chose it with the Dial | Neck switch (or Show on fretboard).
  const [theoryNeckChosen, setTheoryNeckChosen] = useState(false);
  const [theoryReturn, setTheoryReturn] = useState<TheoryReturn | null>(null);

  // The way back lasts only while the player stays where the link sent them.
  if (theoryReturn && studyMode !== theoryReturn.mode) setTheoryReturn(null);

  const activeTheoryTopic = useMemo(
    () => getTheoryTopicById(theoryTopicId) ?? getTheoryTopicById(DEFAULT_THEORY_TOPIC_ID)!,
    [theoryTopicId],
  );

  const theoryScaleQuality = activeTheoryTopic.fretboardDemo?.scaleQuality ?? 'major';

  // Neck means the key's chords on the vertical neck, in the dial's place, where
  // the topic has a dial. Where it has none, it is the fretboard demo: the
  // horizontal neck and the deck, which the hooks that build the board read as
  // `theoryShowFretboard`.
  const hasDial = Boolean(activeTheoryTopic.diagram);
  const theoryShowKeyNeck = theoryNeckChosen && hasDial;
  const theoryShowFretboard = theoryNeckChosen && !hasDial;

  // The diagram picked for the current topic; a new topic starts on its own.
  const [diagramChoice, setDiagramChoice] = useState<{
    topicId: string;
    view: TheoryDiagram;
  } | null>(null);
  const theoryDiagramView = activeTheoryTopic.diagram
    ? diagramChoice?.topicId === activeTheoryTopic.id
      ? diagramChoice.view
      : activeTheoryTopic.diagram
    : undefined;

  const handleTheoryTopicChange = (topicId: string) => {
    setTheoryTopicId(topicId);
    setTheoryNeckChosen(false);
  };

  return {
    theoryTopicId,
    setTheoryTopicId,
    theoryNeckChosen,
    setTheoryNeckChosen,
    theoryShowFretboard,
    theoryShowKeyNeck,
    /** The same setter as `setTheoryNeckChosen`, under the name callers outside Theory use to clear it. */
    setTheoryShowFretboard: setTheoryNeckChosen,
    theoryReturn,
    setTheoryReturn,
    activeTheoryTopic,
    theoryScaleQuality,
    theoryDiagramView,
    setTheoryDiagramView: (view: TheoryDiagram) =>
      setDiagramChoice({ topicId: activeTheoryTopic.id, view }),
    handleTheoryTopicChange,
  };
}

export type TheoryState = ReturnType<typeof useTheoryState>;
