/**
 * Pure parts of the analog texture layer (docs/ROADMAP.md, package F):
 * the dial values, which ones each theme uses, and reading saved state.
 */

export const DIALS = ['grain', 'glow', 'fade', 'warmth', 'vignette', 'raster', 'motion'] as const;
export type Dial = (typeof DIALS)[number];
export type Levels = Record<Dial, number>;

export const PRESETS: Record<string, Levels> = {
  subtle: { grain: 26, glow: 30, fade: 8, warmth: 30, vignette: 20, raster: 0, motion: 50 },
  film: { grain: 46, glow: 50, fade: 18, warmth: 70, vignette: 34, raster: 0, motion: 60 },
  tube: { grain: 20, glow: 72, fade: 12, warmth: 10, vignette: 46, raster: 36, motion: 85 },
  print: { grain: 60, glow: 36, fade: 10, warmth: 50, vignette: 14, raster: 0, motion: 0 },
};

/** The levels the owner chose: Subtle on Vibrato (dark and light), Print on Scholar. */
export function levelsForTheme(uiTheme: string): Levels {
  return { ...(uiTheme === 'scholar' ? PRESETS.print : PRESETS.subtle) };
}

export interface TextureState {
  /** Always true since 2026-11-21, when the owner took the Texture switch out of the theme menu. */
  on: boolean;
  /** 'theme' follows the theme; otherwise a preset name or 'custom' (set from the lab panel). */
  preset: string;
  /** Lab-panel levels that override the theme's. Null follows the theme. */
  override: Levels | null;
}

export const TEXTURE_STORAGE_KEY = 'vibrato:texture';

export const DEFAULT_TEXTURE: TextureState = { on: true, preset: 'theme', override: null };

function readLevels(value: unknown): Levels | null {
  if (!value || typeof value !== 'object') return null;
  const stored = value as Record<string, unknown>;
  const levels = {} as Levels;
  for (const dial of DIALS) {
    const level = stored[dial];
    if (typeof level !== 'number' || !Number.isFinite(level) || level < 0 || level > 100) return null;
    levels[dial] = level;
  }
  return levels;
}

/** Reads saved state from its JSON text. Anything missing or invalid falls back to the defaults. */
export function parseTexture(raw: string | null): TextureState {
  const state: TextureState = { ...DEFAULT_TEXTURE };
  if (raw === null) return state;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return state;
  }
  if (!parsed || typeof parsed !== 'object') return state;
  const stored = parsed as Record<string, unknown>;
  // A saved "off" from when there was a switch is ignored: the texture is always on.
  const override = readLevels(stored.override);
  if (override) {
    state.override = override;
    state.preset = typeof stored.preset === 'string' && stored.preset !== 'theme' ? stored.preset : 'custom';
  }
  return state;
}

/** The levels in use: the lab panel's override if there is one, else the theme's. */
export function effectiveLevels(state: TextureState, uiTheme: string): Levels {
  return state.override ?? levelsForTheme(uiTheme);
}
