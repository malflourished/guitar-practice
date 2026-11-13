import { describe, expect, it } from 'vitest';
import {
  AMBIENT_MOTIONS,
  AMBIENT_SPEED,
  isAmbientMotion,
  readAmbientMotion,
} from './ambientMotion';

const storageWith = (value: string | null) => ({
  getItem: (key: string) => (key === 'vibrato:ambient-motion' ? value : null),
});

describe('ambient motion setting', () => {
  it('offers Flow, Rise and Boil, each faster than the last', () => {
    expect(AMBIENT_MOTIONS).toEqual(['flow', 'rise', 'boil']);
    expect(AMBIENT_SPEED.flow).toBe(1);
    expect(AMBIENT_SPEED.rise).toBeGreaterThan(AMBIENT_SPEED.flow);
    expect(AMBIENT_SPEED.boil).toBeGreaterThan(AMBIENT_SPEED.rise);
  });

  it('keeps a saved current choice', () => {
    expect(readAmbientMotion(storageWith('"rise"'))).toBe('rise');
    expect(readAmbientMotion(storageWith('"boil"'))).toBe('boil');
    expect(readAmbientMotion(storageWith('"flow"'))).toBe('flow');
  });

  it('turns a saved calm or still into flow', () => {
    expect(readAmbientMotion(storageWith('"calm"'))).toBe('flow');
    expect(readAmbientMotion(storageWith('"still"'))).toBe('flow');
    expect(isAmbientMotion('calm')).toBe(false);
    expect(isAmbientMotion('still')).toBe(false);
  });

  it('falls back to flow when nothing or junk was saved', () => {
    expect(readAmbientMotion(storageWith(null))).toBe('flow');
    expect(readAmbientMotion(storageWith('not json'))).toBe('flow');
    expect(readAmbientMotion(storageWith('7'))).toBe('flow');
  });
});
