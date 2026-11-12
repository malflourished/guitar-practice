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
}

/** The top strip: wordmark, mode tabs, the way back, Key, Theme and Panel. */
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
      </StripEnd>
    </Strip>
  );
}
