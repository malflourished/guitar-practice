import { Strip, StripEnd } from './Frame';
import { KeySelector } from './KeySelector';
import { Popover } from './Popover';
import { UiThemeSelector } from './UiThemeSelector';
import { StudyModeSelector } from './StudyModeControls';
import type { AppTheme } from '../hooks/useAppTheme';
import type { NotationPreference } from '../lib/music';
import { APP_NAME } from '../lib/brand';
import type { NoteName, StudyMode } from '../types/music';
import type { TheoryReturn } from '../modes/theory/useTheoryState';
import glass from '../styles/glass.module.css';

interface AppStripProps {
  studyMode: StudyMode;
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
  theme: AppTheme;
  hasSide: boolean;
  sideShown: boolean;
  onToggleSide: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

/** The top strip: wordmark, mode tabs, the way back, Key, Theme, Panel and Settings. */
export function AppStrip({
  studyMode,
  onStudyModeChange,
  theoryReturn,
  onBackToTheory,
  showKey,
  keyLabel,
  activeNotes,
  notation,
  onApplyKey,
  onNotationChange,
  theme,
  hasSide,
  sideShown,
  onToggleSide,
  settingsOpen,
  onToggleSettings,
}: AppStripProps) {
  return (
    <Strip>
      <p className="wordmark" aria-label={APP_NAME.slice(0, -1)}>
        {APP_NAME.slice(0, -1)}
        <span className="wordmarkWave">{APP_NAME.at(-1)}</span>
      </p>
      <StudyModeSelector
        studyMode={studyMode}
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
        <UiThemeSelector
          uiTheme={theme.uiTheme}
          vibratoCanvas={theme.vibratoCanvas}
          onUiThemeChange={theme.selectUiTheme}
          onCanvasChange={theme.selectCanvas}
          vibratoPanels={theme.vibratoPanels}
          onPanelsChange={theme.selectPanels}
          motion={theme.ambientMotion}
          onMotionChange={theme.setAmbientMotion}
        />
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
        <button
          type="button"
          className={`${settingsOpen ? glass.pillSelected : glass.pill} settingsButton`}
          aria-pressed={settingsOpen}
          aria-label="Settings"
          title={
            settingsOpen
              ? 'Close Settings (Esc)'
              : 'Settings: sound, tempo, labels'
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
