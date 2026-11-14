export type UiTheme = 'vibrato' | 'scholar';

/** Where the Vibrato gradient resolves below the colorful blobs. */
export type VibratoCanvas = 'dark' | 'light';

/**
 * How Vibrato marks its regions. On draws filled panels; the others lay the
 * controls straight on the lava with the panel edges (Outline, the default
 * since 2026-11-13), horizontal rules between the regions (Lines), or nothing
 * at all (Off).
 */
export type VibratoPanels = 'on' | 'outline' | 'lines' | 'off';
