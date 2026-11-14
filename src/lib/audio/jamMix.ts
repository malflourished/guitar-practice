/**
 * The jam's mix: what each of the four faders (Guitar, Bass, Pad, Drums) means.
 *
 * A fader sets a layer's level in decibels around its default, where 0 dB is
 * the level the layer was measured and balanced at. The track runs from off,
 * then -24 dB, up to +6 dB. All of it is pure; the engine only turns a gain
 * into a gain node's value.
 *
 * The drums came later than the other three (package S2) and start at off.
 * They are optional in a mix: a mix that does not mention them has no drums,
 * so everything written for three layers still holds.
 */

export const FADER_MIN_DB = -24;
export const FADER_MAX_DB = 6;
/** Stops on a track above "off", one per dB: stop 0 is off and this is the top. */
export const FADER_STEPS = FADER_MAX_DB - FADER_MIN_DB + 1;

/** A fader's setting: decibels around the default level, or off. */
export type FaderLevel = number | 'off';

export type JamLayer = 'guitar' | 'bass' | 'pad' | 'drums';
export const JAM_LAYERS: readonly JamLayer[] = ['guitar', 'bass', 'pad', 'drums'];
/** The three layers the jam has had from the start. */
type BandLayer = Exclude<JamLayer, 'drums'>;

/** Where each fader stands. Left out, the drums are off. */
export type JamMix = Record<BandLayer, FaderLevel> & { drums?: FaderLevel };
/** What each layer's gain node is set to: 1 at 0 dB, 0 when off. Left out, the drums are at 0. */
export type JamGains = Record<BandLayer, number> & { drums?: number };

export const DEFAULT_JAM_MIX: JamMix = { guitar: 0, bass: 0, pad: 0 };
/** The Drums fader starts at off: the owner turns it up after listening in the sound lab. */
export const DEFAULT_DRUMS_LEVEL: FaderLevel = 'off';

const clampDb = (db: number) => Math.min(FADER_MAX_DB, Math.max(FADER_MIN_DB, db));

/** Whether a saved value can be a level at all: "off", or a finite number of dB. */
export const isFaderLevel = (value: unknown): value is FaderLevel =>
  value === 'off' || (typeof value === 'number' && Number.isFinite(value));

/** A saved level, clamped onto the track; anything unusable is the default, 0 dB. */
export function clampFaderLevel(value: unknown): FaderLevel {
  if (value === 'off') return 'off';
  return typeof value === 'number' && Number.isFinite(value) ? clampDb(value) : 0;
}

/** The linear gain a level gives: 1 at 0 dB, about 2 at +6 dB, 0 when off. */
export function faderGain(level: FaderLevel): number {
  const clamped = clampFaderLevel(level);
  return clamped === 'off' ? 0 : 10 ** (clamped / 20);
}

/** The gains for a mix: the three layers, and the drums when the mix says where they stand. */
export function jamGains(mix: JamMix): JamGains {
  const gains: JamGains = { guitar: faderGain(mix.guitar), bass: faderGain(mix.bass), pad: faderGain(mix.pad) };
  if (mix.drums !== undefined) gains.drums = faderGain(mix.drums);
  return gains;
}

/** Where a level sits on the track: 0 is off, `FADER_STEPS` is the top. */
export function faderStep(level: FaderLevel): number {
  const clamped = clampFaderLevel(level);
  return clamped === 'off' ? 0 : Math.round(clamped) - FADER_MIN_DB + 1;
}

/** The level at a stop on the track; stops past either end are clamped. */
export function faderLevelAtStep(step: number): FaderLevel {
  const stop = Number.isFinite(step) ? Math.min(FADER_STEPS, Math.max(0, Math.round(step))) : faderStep(0);
  return stop === 0 ? 'off' : FADER_MIN_DB + stop - 1;
}

/** Move a level by whole dB, as the arrow keys do. From off, one step up is -24 dB. */
export function nudgeFaderLevel(level: FaderLevel, db: number): FaderLevel {
  return faderLevelAtStep(faderStep(level) + db);
}

/** A level in whole dB, for a screen reader: "off" counts as one below the lowest stop. */
export function faderDb(level: FaderLevel): number {
  const clamped = clampFaderLevel(level);
  return clamped === 'off' ? FADER_MIN_DB - 1 : Math.round(clamped);
}

/** "off", "0 dB", "−3 dB" (a true minus sign), "+2 dB". */
export function formatFaderLevel(level: FaderLevel): string {
  const clamped = clampFaderLevel(level);
  if (clamped === 'off') return 'off';
  const db = Math.round(clamped);
  if (db === 0) return '0 dB';
  return `${db < 0 ? '−' : '+'}${Math.abs(db)} dB`;
}
