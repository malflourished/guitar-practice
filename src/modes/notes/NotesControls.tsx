import { KeySelector } from '../../components/KeySelector';
import { ALL_NOTES } from '../../lib/colors';
import type { KeyState } from '../../hooks/useKeyState';
import glass from '../../styles/glass.module.css';

interface NotesControlsProps {
  keyState: KeyState;
}

/** Notes deck: pick any notes, All / Clear. Labels are in Settings. */
export function NotesControls({ keyState }: NotesControlsProps) {
  const { activeNotes, setActiveNotes, notation, setNotation, applyKey } =
    keyState;
  return (
    <>
      <KeySelector
        activeNotes={activeNotes}
        notation={notation}
        singleRootMode={false}
        onApplyKey={applyKey}
        onNotationChange={setNotation}
      />
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
          onClick={() => setActiveNotes(new Set())}
        >
          Clear
        </button>
      </div>
    </>
  );
}
