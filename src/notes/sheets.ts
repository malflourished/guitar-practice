import { targetSummary } from './describeTarget';
import type { Note, Sheet } from './noteTypes';

const two = (value: number) => String(value).padStart(2, '0');

/** A sheet's id and file name, from the local time: `2026-11-21_140322-practice`. */
export function sheetId(now: Date, mode: string): string {
  const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const time = `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
  const slug = mode.toLowerCase().replace(/[^a-z]/g, '') || 'app';
  return `${day}_${time}-${slug}`;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function isNote(value: unknown): value is Note {
  return (
    isObject(value) &&
    typeof value.n === 'number' &&
    typeof value.text === 'string' &&
    isObject(value.at)
  );
}

export function isSheet(value: unknown): value is Sheet {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    isObject(value.context) &&
    Array.isArray(value.notes) &&
    value.notes.every(isNote)
  );
}

/** Read saved sheets, dropping anything that is not one. Newest first. */
export function parseSheets(raw: string | null): Sheet[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? sortSheets(parsed.filter(isSheet)) : [];
  } catch {
    return [];
  }
}

export function sortSheets(sheets: Sheet[]): Sheet[] {
  return [...sheets].sort((a, b) => b.id.localeCompare(a.id));
}

/** Put a sheet in the list, replacing an earlier save of the same one. */
export function upsertSheet(sheets: Sheet[], sheet: Sheet): Sheet[] {
  return sortSheets([...sheets.filter((other) => other.id !== sheet.id), sheet]);
}

/** Take one note out. A sheet with no notes left goes too. */
export function withoutNote(sheets: Sheet[], id: string, n: number): Sheet[] {
  return sheets
    .map((sheet) =>
      sheet.id === id ? { ...sheet, notes: sheet.notes.filter((note) => note.n !== n) } : sheet,
    )
    .filter((sheet) => sheet.notes.length > 0);
}

export function countOpen(sheets: Sheet[]): number {
  return sheets.reduce(
    (sum, sheet) => sum + sheet.notes.filter((note) => note.status !== 'done').length,
    0,
  );
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** "Practice · 21 Nov, 14:03", from the id, so it does not depend on a time zone. */
export function sheetTitle(sheet: Sheet): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(sheet.id);
  const mode = capital(sheet.context.mode || 'app');
  if (!match) return mode;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, , month, day, hour, minute] = match;
  return `${mode} · ${Number(day)} ${months[Number(month) - 1] ?? month}, ${hour}:${minute}`;
}

/** Every note as text, for pasting somewhere when there are no files to read. */
export function notesMarkdown(sheets: Sheet[]): string {
  if (sheets.length === 0) return 'No notes yet.';
  return sheets
    .map((sheet) => {
      const { width, height } = sheet.context.viewport;
      const lines = sheet.notes.map((note) => {
        const done = note.status === 'done' ? ' (done)' : '';
        const text = note.text.trim() || '(a mark with no words)';
        const where = `${targetSummary(note.target)} at ${Math.round(note.at.x)}, ${Math.round(note.at.y)}`;
        const classes = note.target?.classes.length ? ` · classes: ${note.target.classes.join(', ')}` : '';
        return `${note.n}. ${text}${done}\n   on: ${where}${classes}`;
      });
      return [`## ${sheetTitle(sheet)} (${sheet.id}, window ${width}×${height})`, ...lines].join('\n');
    })
    .join('\n\n');
}

/**
 * The app's saved settings, for a sheet's context: the key, the chord, the
 * tempo and so on. Long values (practice history, these notes) are left out.
 */
export function collectSettings(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || key === 'vibrato:notes') continue;
    if (!key.startsWith('vibrato:') && !key.startsWith('guitar-practice-')) continue;
    const raw = storage.getItem(key) ?? '';
    if (raw.length > 240) continue;
    try {
      settings[key] = JSON.parse(raw) as unknown;
    } catch {
      settings[key] = raw;
    }
  }
  return settings;
}
