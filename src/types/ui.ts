export type UiTheme = 'vibrato' | 'scholar';

/** Where the Vibrato gradient resolves below the colorful blobs. */
export type VibratoCanvas = 'dark' | 'light';

/**
 * How Vibrato marks its regions on the lava: with the panel edges as hairlines
 * (Outline, the default since 2026-11-13) or not at all (Off). Under Outline
 * the panels can also take a fill, 0 to 1 (see useUiTheme); a full fill is the
 * filled panels the old setting called On.
 */
export type VibratoPanels = 'outline' | 'off';
