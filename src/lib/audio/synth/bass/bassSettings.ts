/**
 * Which bass the jam loop plays, and how the modelled bass is set up.
 *
 * One saved copy, shared by the audio engine (which plays it) and the sound
 * lab (which changes it). No React and no audio here, so both can import it.
 * The default is the modelled bass: the owner judged it by ear on 2026-11-13
 * ("model bass sounds great"). The synth bass stays as the lab's A, and as the
 * fall-back when the worklet cannot load.
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
/**
 * Settings saved before the modelled bass became the default carry no version.
 * Their A/B choice was made while comparing, so it gives way to the new default
 * once. Their sound settings are kept.
 */
const SETTINGS_VERSION = 2;

export const DEFAULT_BASS_SETTINGS: BassSettings = {
  jamBass: 'modelled',
  params: DEFAULT_BASS_PARAMS,
  trimDb: 0,
};

/** Settings from saved text, with anything missing or out of range put right. */
export function parseBassSettings(raw: string | null): BassSettings {
  let saved: Partial<Record<keyof BassSettings | 'v', unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed === 'object' && parsed !== null) saved = parsed;
  } catch {
    // not JSON: use the defaults
  }
  const trim = typeof saved.trimDb === 'number' && Number.isFinite(saved.trimDb) ? saved.trimDb : 0;
  const choiceKept = saved.v === SETTINGS_VERSION && (saved.jamBass === 'synth' || saved.jamBass === 'modelled');
  return {
    jamBass: choiceKept ? (saved.jamBass as JamBassChoice) : DEFAULT_BASS_SETTINGS.jamBass,
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
  current = parseBassSettings(JSON.stringify({ ...next, v: SETTINGS_VERSION }));
  try {
    localStorage.setItem(BASS_SETTINGS_KEY, JSON.stringify({ ...current, v: SETTINGS_VERSION }));
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
