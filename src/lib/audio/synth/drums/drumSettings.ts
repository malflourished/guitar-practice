/**
 * Which kit the jam loop plays, and how each kit is set up.
 *
 * One saved copy, shared by the audio engine (which plays it) and the sound
 * lab (which changes it). No React and no audio here, so both can import it.
 * Whether the drums sound at all is the Drums fader's business, with the
 * other faders: it starts at off.
 */
import { DEFAULT_HUMANIZE } from '../../drumGrooves';
import {
  DEFAULT_DRUM_PARAMS,
  DRUM_KIT_IDS,
  isDrumKitId,
  sanitizeDrumParams,
  type DrumKitId,
  type DrumParams,
} from './drumParams';

export interface DrumSettings {
  /** The kit the jam loop plays: the sound lab's choice of A, B or C. */
  kit: DrumKitId;
  /** Each kit's controls. */
  params: Record<DrumKitId, DrumParams>;
  /**
   * Each kit's level trim, in decibels: what the sound lab found makes it as
   * loud as the acoustic kit with these controls. 0 for the defaults.
   */
  trimDb: Record<DrumKitId, number>;
  /** How much the grooves' timing and dynamics wander, 0 to 1. */
  humanize: number;
}

export const DRUM_SETTINGS_KEY = 'vibrato:drums';
const TRIM_LIMIT_DB = 24;

export const DEFAULT_DRUM_SETTINGS: DrumSettings = {
  kit: 'acoustic',
  params: DEFAULT_DRUM_PARAMS,
  trimDb: { acoustic: 0, machine: 0, brushes: 0 },
  humanize: DEFAULT_HUMANIZE,
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/** Settings from saved text, with anything missing or out of range put right. */
export function parseDrumSettings(raw: string | null): DrumSettings {
  let saved: Record<string, unknown> = {};
  try {
    saved = record(raw ? JSON.parse(raw) : null);
  } catch {
    // not JSON: use the defaults
  }
  const savedParams = record(saved.params);
  const savedTrim = record(saved.trimDb);
  const params = {} as Record<DrumKitId, DrumParams>;
  const trimDb = {} as Record<DrumKitId, number>;
  for (const kit of DRUM_KIT_IDS) {
    params[kit] = sanitizeDrumParams(savedParams[kit], DEFAULT_DRUM_PARAMS[kit]);
    const trim = savedTrim[kit];
    trimDb[kit] = typeof trim === 'number' && Number.isFinite(trim) ? Math.min(TRIM_LIMIT_DB, Math.max(-TRIM_LIMIT_DB, trim)) : 0;
  }
  const humanize = saved.humanize;
  return {
    kit: isDrumKitId(saved.kit) ? saved.kit : DEFAULT_DRUM_SETTINGS.kit,
    params,
    trimDb,
    humanize: typeof humanize === 'number' && Number.isFinite(humanize) ? Math.min(1, Math.max(0, humanize)) : DEFAULT_HUMANIZE,
  };
}

let current: DrumSettings | null = null;
const listeners = new Set<() => void>();

export function getDrumSettings(): DrumSettings {
  if (current) return current;
  try {
    current = parseDrumSettings(localStorage.getItem(DRUM_SETTINGS_KEY));
  } catch {
    current = DEFAULT_DRUM_SETTINGS; // no storage here
  }
  return current;
}

export function setDrumSettings(update: (settings: DrumSettings) => DrumSettings): void {
  const next = update(getDrumSettings());
  current = parseDrumSettings(JSON.stringify(next));
  try {
    localStorage.setItem(DRUM_SETTINGS_KEY, JSON.stringify(current));
  } catch {
    // storage is unavailable: the choice lasts until the page closes
  }
  listeners.forEach((notify) => notify());
}

export function subscribeDrumSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
