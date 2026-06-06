import type {
  ChordQuality,
  NoteName,
  ScaleQuality,
  StudyMode,
} from '../types/music';
import { ALL_NOTES } from './colors';

export interface KeyBackgroundStyle {
  '--blob-1': string;
  '--blob-2': string;
  '--blob-3': string;
  '--accent-color': string;
  '--hero-color': string;
}

const NEUTRAL_BACKGROUND: KeyBackgroundStyle = {
  '--blob-1': '#1e3a5f',
  '--blob-2': '#0d9488',
  '--blob-3': '#312e81',
  '--accent-color': 'rgba(255, 255, 255, 0.95)',
  '--hero-color': 'rgba(255, 255, 255, 0.95)',
};

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const gray = l * 255;
    return [gray, gray, gray];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let channel = t;
    if (channel < 0) channel += 1;
    if (channel > 1) channel -= 1;
    if (channel < 1 / 6) return p + (q - p) * 6 * channel;
    if (channel < 1 / 2) return q;
    if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

function shiftHue(hex: string, degrees: number): string {
  const [r, g, b] = parseHex(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const shifted = hslToRgb((h + degrees + 360) % 360, s, l);
  return rgbToHex(...shifted);
}

function shiftLightness(hex: string, delta: number): string {
  const [r, g, b] = parseHex(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const adjusted = hslToRgb(h, s, Math.max(8, Math.min(92, l + delta * 100)));
  return rgbToHex(...adjusted);
}

function shiftSaturation(hex: string, delta: number): string {
  const [r, g, b] = parseHex(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const adjusted = hslToRgb(h, Math.max(15, Math.min(100, s + delta * 100)), l);
  return rgbToHex(...adjusted);
}

/** Hero/accent color with enough contrast on glass over vivid backgrounds. */
function heroColorForKey(hex: string): string {
  const [r, g, b] = parseHex(hex);
  const [, , l] = rgbToHsl(r, g, b);
  if (l > 72) {
    return shiftLightness(hex, -0.18);
  }
  return hex;
}

export function isMinorQuality(
  quality: ChordQuality | ScaleQuality,
): boolean {
  const minorScales: ScaleQuality[] = [
    'minor',
    'minorPentatonic',
    'minorBlues',
    'dorian',
    'phrygian',
    'locrian',
    'harmonicMinor',
    'melodicMinor',
  ];
  if (minorScales.includes(quality as ScaleQuality)) return true;

  const minorChords: ChordQuality[] = [
    'minor',
    'min6',
    'min7',
    'm7b5',
    'min9',
    'min11',
    'min13',
    'dim',
    'dim7',
  ];
  return minorChords.includes(quality as ChordQuality);
}

/** Which root drives the ambient background for the current mode. */
export function getBackgroundKeyForMode(
  studyMode: StudyMode,
  activeNotes: Set<NoteName>,
  rootNote: NoteName,
): NoteName | null {
  if (studyMode === 'notes') {
    const selected = ALL_NOTES.filter((note) => activeNotes.has(note));
    if (selected.length === 0) return null;
    return selected[0];
  }
  return rootNote;
}

export function getKeyBackgroundStyle(
  root: NoteName | null,
  quality: ChordQuality | ScaleQuality,
  noteColors: Record<NoteName, string>,
): KeyBackgroundStyle {
  if (!root) return NEUTRAL_BACKGROUND;

  const base = noteColors[root];
  const isMinor = isMinorQuality(quality);

  const blob1 = base;
  const blob2 = shiftHue(base, isMinor ? -18 : 12);
  const blob3 = shiftLightness(
    shiftHue(base, isMinor ? -28 : 28),
    isMinor ? -0.1 : 0.06,
  );
  const accent = isMinor
    ? shiftSaturation(shiftLightness(base, -0.04), -0.05)
    : shiftSaturation(shiftLightness(base, 0.04), 0.05);

  return {
    '--blob-1': blob1,
    '--blob-2': blob2,
    '--blob-3': blob3,
    '--accent-color': accent,
    '--hero-color': heroColorForKey(base),
  };
}
