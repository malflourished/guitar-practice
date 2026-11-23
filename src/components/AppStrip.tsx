import { Strip, StripEnd } from './Frame';
import { KeySelector } from './KeySelector';
import { Popover } from './Popover';
import { StudyModeSelector } from './StudyModeControls';
import { WordmarkButton } from './WordmarkButton';
import type { NotationPreference } from '../lib/music';
import type { NoteName, StudyMode } from '../types/music';
import type { TheoryReturn } from '../modes/theory/useTheoryState';
import { NotesButton } from '../notes/NotesButton';
import glass from '../styles/glass.module.css';

interface AppStripProps {
  studyMode: StudyMode;
  /** Home is showing: no mode is lit, and the wordmark has moved onto the page. */
  home: boolean;
  onHome: () => void;
  onStudyModeChange: (mode: StudyMode) => void;
  theoryReturn: TheoryReturn | null;
  onBackToTheory: () => void;
  /** Show the Key menu (every mode with one root except Practice). */
  showKey: boolean;
  keyLabel: string;
  activeNotes: Set<NoteName>;
  notation: NotationPreference;
  onApplyKey: (note: NoteName, action: 'select' | 'deselect' | 'set') => void;
  onNotationChange: (notation: NotationPreference) => void;
  hasSide: boolean;
  sideShown: boolean;
  onToggleSide: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

/** The top strip: the wordmark (Home), Practice, the Explore menu and Theory, the way back, Key, Panel, Notes and Settings. Theme is in Settings. */
export function AppStrip({
  studyMode,
  home,
  onHome,
  onStudyModeChange,
  theoryReturn,
  onBackToTheory,
  showKey,
  keyLabel,
  activeNotes,
  notation,
  onApplyKey,
  onNotationChange,
  hasSide,
  sideShown,
  onToggleSide,
  settingsOpen,
  onToggleSettings,
}: AppStripProps) {
  return (
    <Strip>
      <WordmarkButton onClick={onHome} onHome={home} />
      <StudyModeSelector
        studyMode={home ? null : studyMode}
        onStudyModeChange={onStudyModeChange}
      />
      {theoryReturn && (
        <button
          type="button"
          className={`${glass.pill} backToTheory`}
          title={`Back to ${theoryReturn.title} in Theory`}
          onClick={onBackToTheory}
        >
          ← Back<span className="backToTheoryTopic"> to {theoryReturn.title}</span>
        </button>
      )}
      <StripEnd>
        {showKey && (
          <Popover
            label="Key"
            buttonLabel={`Key ${keyLabel}. Change key`}
            button={
              <>
                <span className="stripLabel">Key</span>
                {keyLabel}
              </>
            }
          >
            {(close) => (
              <div className="keyMenu">
                <KeySelector
                  activeNotes={activeNotes}
                  notation={notation}
                  singleRootMode
                  onApplyKey={(note, action) => {
                    onApplyKey(note, action);
                    if (action === 'set') close();
                  }}
                  onNotationChange={onNotationChange}
                />
              </div>
            )}
          </Popover>
        )}
        {hasSide && (
          <button
            type="button"
            className={sideShown ? glass.pillSelected : glass.pill}
            aria-pressed={sideShown}
            title={sideShown ? 'Hide the side panel' : 'Show the side panel: this key, chord shapes, reading'}
            onClick={onToggleSide}
          >
            Panel
          </button>
        )}
        <NotesButton />
        <button
          type="button"
          className={`${settingsOpen ? glass.pillSelected : glass.pill} settingsButton`}
          aria-pressed={settingsOpen}
          aria-label="Settings"
          title={
            settingsOpen
              ? 'Close Settings (Esc)'
              : 'Settings: sound, tempo, labels, theme'
          }
          onClick={onToggleSettings}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
          </svg>
        </button>
      </StripEnd>
    </Strip>
  );
}
