import { describe, expect, it } from 'vitest';
import { DEFAULT_DRUMS_LEVEL, DEFAULT_JAM_MIX, JAM_LAYERS, faderGain, jamGains } from './jamMix';

describe('the Drums fader in the mix', () => {
  it('is the fourth layer, after Guitar, Bass and Pad', () => {
    expect(JAM_LAYERS).toEqual(['guitar', 'bass', 'pad', 'drums']);
  });

  it('starts at off: the owner turns it up after listening in the sound lab', () => {
    expect(DEFAULT_DRUMS_LEVEL).toBe('off');
    expect(faderGain(DEFAULT_DRUMS_LEVEL)).toBe(0);
  });

  it('a mix that says where the drums stand gets a drums gain; one that does not has none', () => {
    expect(jamGains({ ...DEFAULT_JAM_MIX, drums: 0 })).toEqual({ guitar: 1, bass: 1, pad: 1, drums: 1 });
    expect(jamGains({ ...DEFAULT_JAM_MIX, drums: 'off' })).toEqual({ guitar: 1, bass: 1, pad: 1, drums: 0 });
    expect(jamGains({ ...DEFAULT_JAM_MIX, drums: -6 }).drums).toBeCloseTo(0.501, 3);
    expect('drums' in jamGains(DEFAULT_JAM_MIX)).toBe(false);
  });

  it('has the same track as the others: clamped at +6 dB, never below -24 dB unless off', () => {
    expect(jamGains({ ...DEFAULT_JAM_MIX, drums: 40 }).drums).toBe(faderGain(6));
    expect(jamGains({ ...DEFAULT_JAM_MIX, drums: -90 }).drums).toBe(faderGain(-24));
  });
});
