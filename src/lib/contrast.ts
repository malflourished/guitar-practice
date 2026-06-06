import type { KeyBackgroundStyle } from './keyPalette';

/** UI reads as a light background → use dark foreground. */
export type ContrastMode = 'light' | 'dark';

const CANVAS_HEX = '#dcd8e4';
/** Tuned so bright keys (C, D, E) flip to dark text; deep keys stay on white. */
const LIGHT_BACKGROUND_THRESHOLD = 0.4;

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance for sRGB hex colors. */
export function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
}

/**
 * Estimate perceived brightness behind the glass UI by blending blob colors
 * with the lavender canvas (vignette + glass wash).
 */
export function contrastModeFromBackgroundStyle(
  style: KeyBackgroundStyle,
): ContrastMode {
  const blobs = [
    style['--blob-1'],
    style['--blob-2'],
    style['--blob-3'],
  ].map(relativeLuminance);

  const avgBlob = blobs.reduce((sum, lum) => sum + lum, 0) / blobs.length;
  const peakBlob = Math.max(...blobs);
  const canvasLum = relativeLuminance(CANVAS_HEX);

  const effective = peakBlob * 0.5 + avgBlob * 0.3 + canvasLum * 0.2;

  return effective >= LIGHT_BACKGROUND_THRESHOLD ? 'light' : 'dark';
}
