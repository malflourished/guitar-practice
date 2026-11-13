import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JAM_MIX,
  FADER_MAX_DB,
  FADER_MIN_DB,
  FADER_STEPS,
  clampFaderLevel,
  faderDb,
  faderGain,
  faderLevelAtStep,
  faderStep,
  formatFaderLevel,
  isFaderLevel,
  jamGains,
  nudgeFaderLevel,
} from './jamMix';

describe('fader gain', () => {
  it('0 dB is a gain of 1, off is 0, +6 dB is about 2', () => {
    expect(faderGain(0)).toBe(1);
    expect(faderGain('off')).toBe(0);
    expect(faderGain(6)).toBeCloseTo(2, 1);
    expect(faderGain(6)).toBeCloseTo(1.995, 3);
  });

  it('every 6 dB down halves it, and -24 dB is a sixteenth', () => {
    expect(faderGain(-6)).toBeCloseTo(0.501, 3);
    expect(faderGain(-12)).toBeCloseTo(0.251, 3);
    expect(faderGain(-24)).toBeCloseTo(0.0631, 4);
  });

  it('a level outside the track is clamped, never extended and never turned off', () => {
    expect(faderGain(30)).toBe(faderGain(FADER_MAX_DB));
    expect(faderGain(-80)).toBe(faderGain(FADER_MIN_DB));
    expect(faderGain(-80)).toBeGreaterThan(0);
  });

  it('a default mix is today’s: every layer at 0 dB', () => {
    expect(jamGains(DEFAULT_JAM_MIX)).toEqual({ guitar: 1, bass: 1, pad: 1 });
    expect(jamGains({ guitar: 'off', bass: -6, pad: 6 })).toEqual({
      guitar: 0,
      bass: faderGain(-6),
      pad: faderGain(6),
    });
  });
});

describe('saved levels', () => {
  it('clamps a saved number into the track, and keeps off', () => {
    expect(clampFaderLevel(-40)).toBe(-24);
    expect(clampFaderLevel(12)).toBe(6);
    expect(clampFaderLevel(-3)).toBe(-3);
    expect(clampFaderLevel(0)).toBe(0);
    expect(clampFaderLevel('off')).toBe('off');
  });

  it('anything that is not a level is the default, 0 dB', () => {
    for (const junk of [null, undefined, 'loud', true, {}, [], NaN, Infinity, -Infinity]) {
      expect(clampFaderLevel(junk), String(junk)).toBe(0);
    }
  });

  it('accepts off and finite numbers as levels, and nothing else', () => {
    expect(isFaderLevel('off')).toBe(true);
    expect(isFaderLevel(-7)).toBe(true);
    expect(isFaderLevel(100)).toBe(true); // out of range, but it clamps
    for (const junk of ['on', null, NaN, Infinity, false]) expect(isFaderLevel(junk)).toBe(false);
  });
});

describe('the track: off, then one stop a dB from -24 to +6', () => {
  it('has 31 stops above off, with 0 dB at the 25th', () => {
    expect(FADER_STEPS).toBe(31);
    expect(faderStep('off')).toBe(0);
    expect(faderStep(-24)).toBe(1);
    expect(faderStep(0)).toBe(25);
    expect(faderStep(6)).toBe(31);
  });

  it('turns a stop back into a level, and clamps stops past the ends', () => {
    expect(faderLevelAtStep(0)).toBe('off');
    expect(faderLevelAtStep(1)).toBe(-24);
    expect(faderLevelAtStep(25)).toBe(0);
    expect(faderLevelAtStep(31)).toBe(6);
    expect(faderLevelAtStep(-4)).toBe('off');
    expect(faderLevelAtStep(99)).toBe(6);
    expect(faderLevelAtStep(12.4)).toBe(-13);
  });

  it('round-trips every level on the track', () => {
    for (let db = FADER_MIN_DB; db <= FADER_MAX_DB; db++) {
      expect(faderLevelAtStep(faderStep(db))).toBe(db);
    }
    expect(faderLevelAtStep(faderStep('off'))).toBe('off');
  });

  it('arrow keys: 1 dB a press, 3 with Shift, and off is one below the bottom', () => {
    expect(nudgeFaderLevel(0, 1)).toBe(1);
    expect(nudgeFaderLevel(0, -1)).toBe(-1);
    expect(nudgeFaderLevel(0, 3)).toBe(3);
    expect(nudgeFaderLevel(-24, -1)).toBe('off');
    expect(nudgeFaderLevel('off', 1)).toBe(-24);
    expect(nudgeFaderLevel('off', -1)).toBe('off');
    expect(nudgeFaderLevel(5, 3)).toBe(6);
    expect(nudgeFaderLevel(-23, -3)).toBe('off');
  });
});

describe('what the fader shows and says', () => {
  it('writes dB with a true minus sign, and "off"', () => {
    expect(formatFaderLevel(0)).toBe('0 dB');
    expect(formatFaderLevel(-3)).toBe('−3 dB');
    expect(formatFaderLevel(2)).toBe('+2 dB');
    expect(formatFaderLevel(-24)).toBe('−24 dB');
    expect(formatFaderLevel('off')).toBe('off');
    expect(formatFaderLevel(-0.2)).toBe('0 dB');
    expect(formatFaderLevel(40)).toBe('+6 dB');
  });

  it('gives a screen reader whole dB, with off one below the lowest stop', () => {
    expect(faderDb(-3)).toBe(-3);
    expect(faderDb(0)).toBe(0);
    expect(faderDb('off')).toBe(-25);
  });
});
