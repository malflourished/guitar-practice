import type { UiTheme, VibratoPanels } from '../types/ui';
import { Popover } from './Popover';
import glass from '../styles/glass.module.css';
import styles from './UiThemeSelector.module.css';

const UI_THEMES: { id: UiTheme; label: string }[] = [
  { id: 'vibrato', label: 'Vibrato' },
  { id: 'scholar', label: 'Scholar' },
];

const PANELS: { id: VibratoPanels; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'off', label: 'Off' },
];

interface UiThemeSelectorProps {
  uiTheme: UiTheme;
  onUiThemeChange: (theme: UiTheme) => void;
  vibratoPanels: VibratoPanels;
  onPanelsChange: (panels: VibratoPanels) => void;
  /** 0 to 1; used under Outline only. */
  panelFill: number;
  onPanelFillChange: (fill: number) => void;
}

/**
 * The look settings, in one menu in the top strip, each on its own labelled
 * row: the style, and for Vibrato its panels and their fill. The owner took
 * the rest out on 2026-11-21: the canvas is always dark (Scholar is the light
 * look), the texture is always on, and the lava always flows.
 */
export function UiThemeSelector({
  uiTheme,
  onUiThemeChange,
  vibratoPanels,
  onPanelsChange,
  panelFill,
  onPanelFillChange,
}: UiThemeSelectorProps) {
  const pill = (selected: boolean) => (selected ? glass.pillSelected : glass.pill);

  return (
    <Popover label="Theme" button="Theme">
      {() => (
        <div className={styles.menu}>
          <span className={styles.label}>Style</span>
          <div className={styles.options} role="group" aria-label="Interface style">
            {UI_THEMES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={pill(uiTheme === id)}
                aria-pressed={uiTheme === id}
                onClick={() => onUiThemeChange(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {uiTheme === 'vibrato' && (
            <>
              <span className={styles.label}>Panels</span>
              <div className={styles.options} role="group" aria-label="Vibrato panels">
                {PANELS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={pill(vibratoPanels === id)}
                    aria-pressed={vibratoPanels === id}
                    onClick={() => onPanelsChange(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <span className={styles.label}>Fill</span>
              <div className={styles.options}>
                {/* data-panel-fill lets the panels follow the thumb without
                    their fade while it is dragged (Frame.module.css). */}
                <input
                  className={`${glass.slider} ${styles.fill}`}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(panelFill * 100)}
                  aria-label="Panel fill"
                  aria-valuetext={`${Math.round(panelFill * 100)}%`}
                  data-panel-fill=""
                  disabled={vibratoPanels === 'off'}
                  onChange={(event) => onPanelFillChange(Number(event.target.value) / 100)}
                />
                <span className={styles.hint}>
                  {vibratoPanels === 'off' ? 'With Outline' : `${Math.round(panelFill * 100)}%`}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}
