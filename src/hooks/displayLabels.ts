/**
 * What the dots on the neck say: one choice that replaces the old Labels,
 * Fingers and Names switches. Saved under `vibrato:label-mode`; when that is
 * missing the old `show-note-labels` and `show-fingers` values decide it.
 */
export const LABEL_MODES = ['names', 'intervals', 'fingers', 'none'] as const;
export type LabelMode = (typeof LABEL_MODES)[number];

export const DEFAULT_LABEL_MODE: LabelMode = 'names';

export const LABEL_MODE_TEXT: Record<
  LabelMode,
  { label: string; hint: string }
> = {
  names: { label: 'Note names', hint: 'C, F♯, B♭' },
  intervals: { label: 'Intervals', hint: 'R, ♭3, 5 above the root' },
  fingers: { label: 'Fingers', hint: '1 to 4, where a shape has them' },
  none: { label: 'None', hint: 'Dots only' },
};

export function isLabelMode(value: unknown): value is LabelMode {
  return (
    typeof value === 'string' && (LABEL_MODES as readonly string[]).includes(value)
  );
}

/**
 * The old switches, as they were stored: Labels (`show-note-labels`, default
 * on) hid every label, and Fingers (`show-fingers`, default off) swapped names
 * for finger numbers. Labels off won, because nothing was drawn.
 */
export function labelModeFromLegacy(
  showNoteLabels: unknown,
  showFingers: unknown,
): LabelMode {
  if (showNoteLabels === false) return 'none';
  if (showFingers === true) return 'fingers';
  return DEFAULT_LABEL_MODE;
}

/** The part of `Storage` this file reads. */
export interface ReadableStorage {
  getItem(key: string): string | null;
}

function readJson(storage: ReadableStorage, key: string): unknown {
  try {
    const raw = storage.getItem(`vibrato:${key}`);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** The saved choice, or what the old switches said, or the default. */
export function readLabelMode(storage: ReadableStorage): LabelMode {
  const saved = readJson(storage, 'label-mode');
  if (isLabelMode(saved)) return saved;
  return labelModeFromLegacy(
    readJson(storage, 'show-note-labels'),
    readJson(storage, 'show-fingers'),
  );
}

/** What the neck and the chord diagrams still take as separate flags. */
export function labelFlags(mode: LabelMode) {
  return {
    showNoteLabels: mode !== 'none',
    showFingers: mode === 'fingers',
    showIntervals: mode === 'intervals',
  };
}
