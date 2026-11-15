import { DeckRow } from '../../components/Frame';
import { KeySelector } from '../../components/KeySelector';
import { ALL_NOTES } from '../../lib/colors';
import { NATURAL_NOTES, describeNoteSet } from '../../lib/music';
import type { KeyState } from '../../hooks/useKeyState';
import glass from '../../styles/glass.module.css';
import { ModeCaption } from '../ModePicker';

interface NotesControlsProps {
  keyState: KeyState;
}

/**
 * Notes deck: pick any notes, with All, Naturals and Clear, and one line on
 * what the picked notes are (an interval, a chord, a scale). Labels are in
 * Settings.
 */
export function NotesControls({ keyState }: NotesControlsProps) {
  const { activeNotes, setActiveNotes, notation, setNotation, applyKey } =
    keyState;
  const reading = describeNoteSet(activeNotes, notation);
  return (
    <>
      <KeySelector
        activeNotes={activeNotes}
        notation={notation}
        singleRootMode={false}
        onApplyKey={applyKey}
        onNotationChange={setNotation}
      />
      <DeckRow>
        <div className="shortcuts" role="group" aria-label="Selection">
        <button
          type="button"
          className={glass.pill}
          onClick={() => setActiveNotes(new Set(ALL_NOTES))}
        >
          All
        </button>
        <button
          type="button"
          className={glass.pill}
          title="The seven notes with no sharp or flat: the white keys"
          onClick={() => setActiveNotes(new Set(NATURAL_NOTES))}
        >
          Naturals
        </button>
        <button
          type="button"
          className={glass.pill}
          onClick={() => setActiveNotes(new Set())}
        >
          Clear
        </button>
        </div>
      </DeckRow>
      <ModeCaption name={reading.title} notes={reading.notes} line={reading.line} />
    </>
  );
}
