import { setNotesOpen, useNotesOpen } from './notesStore';
import glass from '../styles/glass.module.css';

/** The top strip's Notes button: a pencil. The N key does the same. */
export function NotesButton() {
  const open = useNotesOpen();
  return (
    <button
      type="button"
      className={`${open ? glass.pillSelected : glass.pill} settingsButton`}
      aria-pressed={open}
      aria-label="Notes"
      title="Notes: comment on anything on screen, or draw on it (N)"
      onClick={() => setNotesOpen((current) => !current)}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
        <path d="M14.5 6l3 3" />
      </svg>
    </button>
  );
}
