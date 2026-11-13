/**
 * Which bass the jam loop plays, and how the modelled bass is set up.
 *
 * One saved copy, shared by the audio engine (which plays it) and the sound
 * lab (which changes it). No React and no audio here, so both can import it.
 * The default is the original synth bass: the modelled bass is opt-in until
 * the owner has judged it by ear.
 */
import { DEFAULT_BASS_PARAMS, sanitizeBassParams, type BassParams } from './bassParams';

/** `synth` is `BassVoice`, the sawtooth-and-triangle bass. `modelled` is the string model. */
export type JamBassChoice = 'synth' | 'modelled';

export interface BassSettings {
  jamBass: JamBassChoice;
  params: BassParams;
  /**
   * Level trim for the modelled bass, in decibels: what the sound lab found
   * makes it as loud as the synth bass with these parameters. 0 for the defaults.
   */
  trimDb: number;
}

export const BASS_SETTINGS_KEY = 'vibrato:bass';
const TRIM_LIMIT_DB = 24;

export const DEFAULT_BASS_SETTINGS: BassSettings = {
  jamBass: 'synth',
  params: DEFAULT_BASS_PARAMS,
  trimDb: 0,
};

/** Settings from saved text, with anything missing or out of range put right. */
export function parseBassSettings(raw: string | null): BassSettings {
  let saved: Partial<Record<keyof BassSettings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed === 'object' && parsed !== null) saved = parsed;
  } catch {
    // not JSON: use the defaults
  }
  const trim = typeof saved.trimDb === 'number' && Number.isFinite(saved.trimDb) ? saved.trimDb : 0;
  return {
    jamBass: saved.jamBass === 'modelled' ? 'modelled' : 'synth',
    params: sanitizeBassParams(saved.params),
    trimDb: Math.min(TRIM_LIMIT_DB, Math.max(-TRIM_LIMIT_DB, trim)),
  };
}

let current: BassSettings | null = null;
const listeners = new Set<() => void>();

export function getBassSettings(): BassSettings {
  if (current) return current;
  try {
    current = parseBassSettings(localStorage.getItem(BASS_SETTINGS_KEY));
  } catch {
    current = DEFAULT_BASS_SETTINGS; // no storage here
  }
  return current;
}

export function setBassSettings(update: (settings: BassSettings) => BassSettings): void {
  const next = update(getBassSettings());
  current = parseBassSettings(JSON.stringify(next));
  try {
    localStorage.setItem(BASS_SETTINGS_KEY, JSON.stringify(current));
  } catch {
    // storage is unavailable: the choice lasts until the page closes
  }
  listeners.forEach((notify) => notify());
}

export function subscribeBassSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
