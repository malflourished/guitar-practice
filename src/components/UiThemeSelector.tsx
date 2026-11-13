import { AMBIENT_MOTIONS, AMBIENT_MOTION_LABELS, type AmbientMotion } from '../lib/ambientMotion';
import type { UiTheme, VibratoCanvas } from '../types/ui';
import { setTexture, useTexture } from '../lab/analogStore';
import { Popover } from './Popover';
import glass from '../styles/glass.module.css';
import styles from './UiThemeSelector.module.css';

const UI_THEMES: { id: UiTheme; label: string }[] = [
  { id: 'vibrato', label: 'Vibrato' },
  { id: 'scholar', label: 'Scholar' },
];

const CANVASES: { id: VibratoCanvas; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

interface UiThemeSelectorProps {
  motion: AmbientMotion;
  onMotionChange: (motion: AmbientMotion) => void;
  uiTheme: UiTheme;
  vibratoCanvas: VibratoCanvas;
  onUiThemeChange: (theme: UiTheme) => void;
  onCanvasChange: (canvas: VibratoCanvas) => void;
}

/**
 * The look settings, in one menu in the top strip. Each setting has its own
 * labelled row: the canvas used to flip on a second click of "Vibrato", and
 * Texture used to sit beside the themes as if it were a third one.
 */
export function UiThemeSelector({
  motion,
  onMotionChange,
  uiTheme,
  vibratoCanvas,
  onUiThemeChange,
  onCanvasChange,
}: UiThemeSelectorProps) {
  const texture = useTexture();
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
              <span className={styles.label}>Canvas</span>
              <div className={styles.options} role="group" aria-label="Vibrato canvas">
                {CANVASES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={pill(vibratoCanvas === id)}
                    aria-pressed={vibratoCanvas === id}
                    onClick={() => onCanvasChange(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          <span className={styles.label}>Texture</span>
          <div className={styles.options} role="group" aria-label="Analog texture">
            {[true, false].map((on) => (
              <button
                key={String(on)}
                type="button"
                className={pill(texture.on === on)}
                aria-pressed={texture.on === on}
                onClick={() => setTexture((current) => ({ ...current, on }))}
              >
                {on ? 'On' : 'Off'}
              </button>
            ))}
            <span className={styles.hint}>Hold B to compare</span>
          </div>

          {uiTheme === 'vibrato' && (
            <>
              <span className={styles.label}>Lava</span>
              <div className={styles.options}>
                <select
                  className={glass.select}
                  aria-label="Background motion"
                  value={motion}
                  onChange={(event) => onMotionChange(event.target.value as AmbientMotion)}
                >
                  {AMBIENT_MOTIONS.map((id) => (
                    <option key={id} value={id}>
                      {AMBIENT_MOTION_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}
