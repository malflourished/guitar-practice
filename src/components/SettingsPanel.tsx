import { useEffect, useState } from 'react';
import { SidePanel } from './Frame';
import { SettingsRow as StackedRow, SettingsSection } from './SettingsList';
import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/instruments';
import {
  MAX_TEMPO,
  MIN_TEMPO,
  SLIDER_MAX_TEMPO,
  clampTempo,
} from '../lib/audio/tempo';
import { LABEL_MODES, LABEL_MODE_TEXT } from '../hooks/displayLabels';
import type { AppTheme } from '../hooks/useAppTheme';
import type { DisplaySettings } from '../hooks/useDisplaySettings';
import type { SettingsSectionId } from '../hooks/useFrameState';
import { ROOM_MAX } from '../hooks/soundSettings';
import type { UseInstrument } from '../hooks/useInstrument';
import type { UiTheme, VibratoPanels } from '../types/ui';
import glass from '../styles/glass.module.css';
import styles from './SettingsPanel.module.css';

const UI_THEMES: { id: UiTheme; label: string }[] = [
  { id: 'vibrato', label: 'Vibrato' },
  { id: 'scholar', label: 'Scholar' },
];

const PANELS: { id: VibratoPanels; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'off', label: 'Off' },
];

/** A label in a fixed column, so every control starts at the same place. */
function SettingsRow({
  label,
  stack = false,
  children,
}: {
  label: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  if (stack) return <StackedRow label={label} stack>{children}</StackedRow>;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  );
}

interface SettingsPanelProps {
  audio: UseInstrument;
  tempo: number;
  onTempoChange: (bpm: number) => void;
  display: DisplaySettings;
  theme: AppTheme;
  /** Scroll to this section when the page opens. */
  section: SettingsSectionId | null;
}

/** The tempo as a number the player can type: kept as text until it is committed. */
function TempoNumber({
  tempo,
  onTempoChange,
}: {
  tempo: number;
  onTempoChange: (bpm: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const parsed = Number(draft);
    if (draft !== null && draft.trim() !== '' && Number.isFinite(parsed)) {
      onTempoChange(clampTempo(parsed));
    }
    setDraft(null);
  };
  return (
    <input
      className={styles.number}
      type="text"
      inputMode="numeric"
      aria-label="Tempo in beats per minute"
      value={draft ?? String(tempo)}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          event.stopPropagation();
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/**
 * Settings: one page in the side panel, the same in every mode. Sound,
 * tempo, the way the neck is drawn and, last, the theme (it had a menu of its
 * own in the top strip until 2026-11-23; the owner seldom changes it). What changes *what* is shown (Tones,
 * Span, Focus) stays in the decks; Practice keeps its own key, tempo and
 * guitar on its start screen.
 */
export function SettingsPanel({
  audio,
  tempo,
  onTempoChange,
  display,
  theme,
  section,
}: SettingsPanelProps) {
  const fillPercent = Math.round(theme.panelFill * 100);
  useEffect(() => {
    if (!section) return;
    document
      .getElementById(`settings-${section}`)
      ?.scrollIntoView({ block: 'start' });
  }, [section]);

  return (
    <SidePanel label="Settings" page="settings">
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <SettingsSection title="Sound" id="settings-sound">
        <SettingsRow label="Guitar">
          <select
            className={glass.select}
            aria-label="Guitar sound"
            value={audio.instrument}
            onChange={(event) =>
              audio.setInstrument(event.target.value as GuitarInstrumentName)
            }
          >
            {GUITAR_INSTRUMENTS.map(({ name, label }) => (
              <option key={name} value={name}>
                {label}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label="Volume">
          <input
            className={`${glass.slider} ${styles.slider}`}
            type="range"
            min={0}
            max={100}
            value={Math.round(audio.volume * 100)}
            aria-label="Volume"
            onChange={(event) => audio.setVolume(Number(event.target.value) / 100)}
          />
        </SettingsRow>
        <SettingsRow label="Room">
          <input
            className={`${glass.slider} ${styles.slider}`}
            type="range"
            min={0}
            max={ROOM_MAX * 100}
            value={Math.round(audio.room * 100)}
            aria-label="Room ambience"
            onChange={(event) => audio.setRoom(Number(event.target.value) / 100)}
          />
        </SettingsRow>
        <SettingsRow label="Sound">
          {/* Two named states, the current one lit: no guessing what a lone Mute button means. */}
          <div className={styles.choices} role="radiogroup" aria-label="Sound">
            <button
              type="button"
              role="radio"
              aria-checked={!audio.muted}
              className={audio.muted ? glass.pill : glass.pillSelected}
              onClick={() => audio.setMuted(false)}
            >
              On
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={audio.muted}
              className={audio.muted ? glass.pillSelected : glass.pill}
              onClick={() => audio.setMuted(true)}
            >
              Muted
            </button>
          </div>
        </SettingsRow>
        {audio.error && (
          <p className={styles.note} role="alert">
            {audio.error}
          </p>
        )}
      </SettingsSection>

      <SettingsSection title="Tempo" id="settings-tempo">
        <SettingsRow label="BPM">
          <input
            className={`${glass.slider} ${styles.slider}`}
            type="range"
            min={MIN_TEMPO}
            max={SLIDER_MAX_TEMPO}
            value={Math.min(tempo, SLIDER_MAX_TEMPO)}
            aria-label="Tempo"
            onChange={(event) => onTempoChange(Number(event.target.value))}
          />
          <TempoNumber tempo={tempo} onTempoChange={onTempoChange} />
        </SettingsRow>
        <p className={styles.note}>
          Notes, Chords, Scales and Progressions play at this tempo ({MIN_TEMPO}
          –{MAX_TEMPO}). Practice sets its own on its start screen.
        </p>
      </SettingsSection>

      <SettingsSection title="Display" id="settings-display">
        <SettingsRow label="Labels" stack>
          <div className={styles.choices} role="radiogroup" aria-label="Labels">
            {LABEL_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={display.labelMode === mode}
                className={
                  display.labelMode === mode ? glass.pillSelected : glass.pill
                }
                onClick={() => display.setLabelMode(mode)}
              >
                {LABEL_MODE_TEXT[mode].label}
              </button>
            ))}
          </div>
          <p className={styles.note}>{LABEL_MODE_TEXT[display.labelMode].hint}</p>
        </SettingsRow>
        <SettingsRow label="Solid dots">
          <button
            type="button"
            className={display.fullDotOpacity ? glass.pillSelected : glass.pill}
            aria-pressed={display.fullDotOpacity}
            onClick={() => display.setFullDotOpacity((prev) => !prev)}
          >
            {display.fullDotOpacity ? 'On' : 'Off'}
          </button>
        </SettingsRow>
        <SettingsRow label="Interval colours">
          <button
            type="button"
            className={display.intervalColors ? glass.pillSelected : glass.pill}
            aria-pressed={display.intervalColors}
            onClick={() => display.setIntervalColors((prev) => !prev)}
          >
            {display.intervalColors ? 'On' : 'Off'}
          </button>
        </SettingsRow>
        <p className={styles.note}>
          Solid dots draw every note at full strength, not only the roots.
          Interval colours tint the dots in the Intervals drills.
        </p>
      </SettingsSection>

      <SettingsSection title="Theme" id="settings-theme">
        {/* Stacked, like Labels: the two names do not fit beside the label in a 280 px panel. */}
        <SettingsRow label="Style" stack>
          <div className={styles.choices} role="radiogroup" aria-label="Interface style">
            {UI_THEMES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme.uiTheme === id}
                className={theme.uiTheme === id ? glass.pillSelected : glass.pill}
                onClick={() => theme.selectUiTheme(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </SettingsRow>
        {theme.uiTheme === 'vibrato' && (
          <>
            <SettingsRow label="Panels">
              <div className={styles.choices} role="radiogroup" aria-label="Vibrato panels">
                {PANELS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={theme.vibratoPanels === id}
                    className={theme.vibratoPanels === id ? glass.pillSelected : glass.pill}
                    onClick={() => theme.selectPanels(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SettingsRow>
            <SettingsRow label="Fill">
              {/* data-panel-fill lets the panels follow the thumb without
                  their fade while it is dragged (Frame.module.css). */}
              <input
                className={`${glass.slider} ${styles.slider}`}
                type="range"
                min={0}
                max={100}
                value={fillPercent}
                aria-label="Panel fill"
                aria-valuetext={`${fillPercent}%`}
                data-panel-fill=""
                disabled={theme.vibratoPanels === 'off'}
                onChange={(event) => theme.selectPanelFill(Number(event.target.value) / 100)}
              />
              <span className={styles.note}>
                {theme.vibratoPanels === 'off' ? 'With Outline' : `${fillPercent}%`}
              </span>
            </SettingsRow>
          </>
        )}
      </SettingsSection>
    </SidePanel>
  );
}
