import type { AmbientMotion } from './AmbientBackground';
import type { UiTheme, VibratoCanvas } from '../types/ui';
import { setTexture, useTexture } from '../lab/analogStore';
import styles from './UiThemeSelector.module.css';

const UI_THEMES: { id: UiTheme; label: string }[] = [
  { id: 'vibrato', label: 'Vibrato' },
  { id: 'scholar', label: 'Scholar' },
];

interface UiThemeSelectorProps {
  motion: AmbientMotion;
  onMotionChange: (motion: AmbientMotion) => void;
  uiTheme: UiTheme;
  vibratoCanvas: VibratoCanvas;
  onUiThemeChange: (theme: UiTheme) => void;
}

export function UiThemeSelector({
  motion, onMotionChange,
  uiTheme,
  vibratoCanvas,
  onUiThemeChange,
}: UiThemeSelectorProps) {
  const texture = useTexture();
  return (
    <div className={styles.dock}>
      <div className={styles.themes} role="group" aria-label="Interface style">
      {UI_THEMES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={
            uiTheme === id ? styles.themeButtonSelected : styles.themeButton
          }
          aria-pressed={uiTheme === id}
          aria-label={
            id === 'vibrato' && uiTheme === 'vibrato'
              ? `Vibrato, ${vibratoCanvas === 'dark' ? 'dark' : 'light'} canvas. Click to switch canvas.`
              : label
          }
          onClick={() => onUiThemeChange(id)}
        >
          {label}
        </button>
      ))}
      </div>
      <button
        type="button"
        className={texture.on ? styles.themeButtonSelected : styles.themeButton}
        aria-pressed={texture.on}
        aria-label="Texture"
        onClick={() => setTexture((current) => ({ ...current, on: !current.on }))}
      >
        Texture
      </button>
      {uiTheme === 'vibrato' && <select className={styles.motion} aria-label="Background motion" value={motion} onChange={e => onMotionChange(e.target.value as AmbientMotion)}><option value="flow">Lava · flow</option><option value="calm">Lava · calm</option><option value="still">Lava · still</option></select>}
    </div>
  );
}
