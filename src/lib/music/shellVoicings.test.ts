import { describe, expect, it } from 'vitest';
import {
  getColorTonePitchClasses,
  getShellDef,
  getShellPitchClasses,
  isShellComplete,
} from './shellVoicings';

describe('shell voicings', () => {
  it('reduces each seventh chord to root, 3rd, and 7th', () => {
    expect(getShellDef('maj7')).toMatchObject({ intervals: [0, 4, 11], third: 4, seventh: 11 });
    expect(getShellDef('dom7')).toMatchObject({ intervals: [0, 4, 10], third: 4, seventh: 10 });
    expect(getShellDef('min7')).toMatchObject({ intervals: [0, 3, 10], third: 3, seventh: 10 });
  });

  it('computes the shell pitch classes for a root', () => {
    expect(getShellPitchClasses('C', 'dom7')).toEqual(new Set([0, 4, 10]));
  });

  it('isolates the two color tones', () => {
    expect(getColorTonePitchClasses('C', 'maj7')).toEqual(new Set([4, 11]));
  });

  it('validates a built shell regardless of octave or extra notes', () => {
    expect(isShellComplete('C', [0, 4, 11], 'maj7')).toBe(true);
    expect(isShellComplete('C', [12, 16, 23], 'maj7')).toBe(true);
    expect(isShellComplete('C', [0, 4], 'maj7')).toBe(false);
  });
});
