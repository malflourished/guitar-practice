import { describe, expect, it } from 'vitest';
import {
  labelFlags,
  labelModeFromLegacy,
  readLabelMode,
  type ReadableStorage,
} from './displayLabels';

const storage = (values: Record<string, unknown>): ReadableStorage => ({
  getItem: (key) => {
    const name = key.replace(/^vibrato:/, '');
    return name in values ? JSON.stringify(values[name]) : null;
  },
});

describe('Labels migration', () => {
  it('starts on note names when nothing was saved', () => {
    expect(readLabelMode(storage({}))).toBe('names');
  });

  it('turns the old switches into one choice', () => {
    expect(labelModeFromLegacy(true, false)).toBe('names');
    expect(labelModeFromLegacy(true, true)).toBe('fingers');
    expect(labelModeFromLegacy(false, false)).toBe('none');
    // Labels off hid everything, fingers included.
    expect(labelModeFromLegacy(false, true)).toBe('none');
    expect(labelModeFromLegacy(undefined, true)).toBe('fingers');
  });

  it('reads the old keys when the new one is missing', () => {
    expect(readLabelMode(storage({ 'show-fingers': true }))).toBe('fingers');
    expect(readLabelMode(storage({ 'show-note-labels': false }))).toBe('none');
  });

  it('prefers the saved choice over the old keys', () => {
    expect(
      readLabelMode(
        storage({ 'label-mode': 'intervals', 'show-note-labels': false }),
      ),
    ).toBe('intervals');
  });

  it('ignores a saved choice that is no longer valid', () => {
    expect(
      readLabelMode(storage({ 'label-mode': 'roman', 'show-fingers': true })),
    ).toBe('fingers');
  });

  it('survives storage that throws or holds junk', () => {
    expect(
      readLabelMode({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe('names');
    expect(readLabelMode({ getItem: () => '{not json' })).toBe('names');
  });

  it('gives the flags the neck and chord diagrams still take', () => {
    expect(labelFlags('names')).toEqual({
      showNoteLabels: true,
      showFingers: false,
      showIntervals: false,
    });
    expect(labelFlags('fingers').showFingers).toBe(true);
    expect(labelFlags('intervals').showIntervals).toBe(true);
    expect(labelFlags('none').showNoteLabels).toBe(false);
  });
});
