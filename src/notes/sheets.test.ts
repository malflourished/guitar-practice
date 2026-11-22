import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import notesFiles from '../../electron/notesFiles.cjs';
import type { Note, Sheet } from './noteTypes';
import {
  collectSettings,
  countOpen,
  notesMarkdown,
  parseSheets,
  sheetId,
  sheetTitle,
  upsertSheet,
  withoutNote,
} from './sheets';

const note = (n: number, text: string, extra: Partial<Note> = {}): Note => ({
  n,
  text,
  status: 'open',
  kind: 'pin',
  at: { x: 1093, y: 400 },
  box: { x: 1080, y: 388, width: 26, height: 26 },
  target: {
    region: 'neck',
    path: ['Neck'],
    label: 'G, G string, fret 3',
    tag: 'g',
    classes: ['marker'],
    text: '',
  },
  strokes: [],
  ...extra,
});

const sheet = (id: string, notes: Note[]): Sheet => ({
  id,
  createdAt: '2026-11-21T22:03:22.000Z',
  context: { mode: 'practice', theme: 'vibrato dark', viewport: { width: 1440, height: 900 }, settings: {} },
  screenshot: null,
  notes,
});

const first = sheet('2026-11-21_140322-practice', [note(1, 'This dot looks dim'), note(2, 'Done already', { status: 'done' })]);
const second = sheet('2026-11-21_151000-chords', [note(1, '')]);

describe('sheetId', () => {
  it('is the local date and time, then the mode', () => {
    expect(sheetId(new Date(2026, 10, 21, 14, 3, 22), 'practice')).toBe('2026-11-21_140322-practice');
    expect(sheetId(new Date(2026, 0, 5, 9, 0, 7), 'Home')).toBe('2026-01-05_090007-home');
  });

  it('never puts anything but letters in the name', () => {
    expect(sheetId(new Date(2026, 10, 21, 14, 3, 22), '../etc')).toBe('2026-11-21_140322-etc');
    expect(sheetId(new Date(2026, 10, 21, 14, 3, 22), '')).toBe('2026-11-21_140322-app');
  });

  it('is an id the file store accepts', () => {
    expect(notesFiles.SHEET_ID.test(sheetId(new Date(), 'progressions'))).toBe(true);
  });
});

describe('the list of sheets', () => {
  it('reads saved sheets newest first and drops what is not one', () => {
    const raw = JSON.stringify([first, { id: 7 }, second, 'nonsense']);
    expect(parseSheets(raw).map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it('is empty for nothing or nonsense', () => {
    expect(parseSheets(null)).toEqual([]);
    expect(parseSheets('{not json')).toEqual([]);
    expect(parseSheets('{"a":1}')).toEqual([]);
  });

  it('replaces an earlier save of the same sheet', () => {
    const longer = { ...first, notes: [...first.notes, note(3, 'One more')] };
    const sheets = upsertSheet([first, second], longer);
    expect(sheets).toHaveLength(2);
    expect(sheets.find((entry) => entry.id === first.id)?.notes).toHaveLength(3);
  });

  it('takes one note out, and the sheet with its last note', () => {
    expect(withoutNote([first, second], first.id, 1)[0].notes.map((entry) => entry.n)).toEqual([2]);
    expect(withoutNote([first, second], second.id, 1).map((entry) => entry.id)).toEqual([first.id]);
  });

  it('counts the notes nobody has dealt with', () => {
    expect(countOpen([first, second])).toBe(2);
    expect(countOpen([])).toBe(0);
  });

  it('titles a sheet by mode and local time', () => {
    expect(sheetTitle(first)).toBe('Practice · 21 Nov, 14:03');
  });
});

describe('notesMarkdown', () => {
  it('writes each note with where it is and what to search for', () => {
    const text = notesMarkdown([first, second]);
    expect(text).toContain('## Practice · 21 Nov, 14:03 (2026-11-21_140322-practice, window 1440×900)');
    expect(text).toContain('1. This dot looks dim\n   on: Neck › G, G string, fret 3 at 1093, 400 · classes: marker');
    expect(text).toContain('2. Done already (done)');
    expect(text).toContain('1. (a mark with no words)');
  });

  it('says so when there are none', () => {
    expect(notesMarkdown([])).toBe('No notes yet.');
  });
});

describe('collectSettings', () => {
  const storage = (entries: Record<string, string>) => {
    const keys = Object.keys(entries);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => entries[k] ?? null };
  };

  it("keeps the app's small settings, parsed", () => {
    const settings = collectSettings(
      storage({
        'vibrato:study-mode': '"practice"',
        'vibrato:tempo': '84',
        'guitar-practice-ui-theme': 'vibrato',
        'vibrato:notes': '[]',
        'vibrato:practice-history': 'x'.repeat(500),
        'someone-else': '1',
      }),
    );
    expect(settings).toEqual({
      'vibrato:study-mode': 'practice',
      'vibrato:tempo': 84,
      'guitar-practice-ui-theme': 'vibrato',
    });
  });
});

describe('notes as files (the Mac app)', () => {
  const dirs: string[] = [];
  const folder = () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibrato-notes-'));
    dirs.push(dir);
    return join(dir, 'notes');
  };
  afterEach(() => {
    dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  });

  it('writes the sheet, its screenshot and a README, and reads them back', () => {
    const dir = folder();
    const saved = notesFiles.saveSheet(dir, first, Buffer.from('jpeg'), 2);
    expect(saved.screenshot).toBe(`${first.id}.jpg`);
    expect(saved.screenshotScale).toBe(2);
    expect(readdirSync(dir).sort()).toEqual([`${first.id}.jpg`, `${first.id}.json`, 'README.txt']);
    expect(readFileSync(join(dir, `${first.id}.jpg`), 'utf8')).toBe('jpeg');
    const listed = notesFiles.listSheets(dir) as Sheet[];
    expect(listed).toHaveLength(1);
    expect(listed[0].notes[0].text).toBe('This dot looks dim');
    expect(parseSheets(JSON.stringify(listed))).toHaveLength(1);
  });

  it('saves without a screenshot when the window could not be captured', () => {
    const dir = folder();
    expect(notesFiles.saveSheet(dir, second, null).screenshot).toBeNull();
    expect(readdirSync(dir)).not.toContain(`${second.id}.jpg`);
  });

  it('keeps the earlier screenshot when a later capture fails', () => {
    const dir = folder();
    notesFiles.saveSheet(dir, first, Buffer.from('jpeg'), 2);
    const again = notesFiles.saveSheet(dir, { ...first, screenshot: `${first.id}.jpg` }, null);
    expect(again.screenshot).toBe(`${first.id}.jpg`);
  });

  it('lists newest first and skips files that are not sheets', () => {
    const dir = folder();
    notesFiles.saveSheet(dir, first, null);
    notesFiles.saveSheet(dir, second, null);
    writeFileSync(join(dir, '2026-11-22_090000-scales.json'), '{ half written');
    writeFileSync(join(dir, 'stray.json'), '{}');
    expect((notesFiles.listSheets(dir) as Sheet[]).map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it('keeps a reply written into the file by hand', () => {
    const dir = folder();
    notesFiles.saveSheet(dir, first, null);
    const file = join(dir, `${first.id}.json`);
    const edited = JSON.parse(readFileSync(file, 'utf8')) as Sheet;
    edited.notes[0] = { ...edited.notes[0], status: 'done', reply: 'Brightened the dim dots' };
    writeFileSync(file, JSON.stringify(edited));
    const listed = notesFiles.listSheets(dir) as Sheet[];
    expect(listed[0].notes[0].reply).toBe('Brightened the dim dots');
    expect(countOpen(listed)).toBe(0);
  });

  it('removes one note, then the files with the last one', () => {
    const dir = folder();
    notesFiles.saveSheet(dir, first, Buffer.from('jpeg'), 2);
    notesFiles.removeNote(dir, first.id, 1);
    expect((notesFiles.listSheets(dir) as Sheet[])[0].notes.map((entry) => entry.n)).toEqual([2]);
    notesFiles.removeNote(dir, first.id, 2);
    expect(readdirSync(dir)).toEqual(['README.txt']);
  });

  it('refuses a name that could leave the folder', () => {
    const dir = folder();
    expect(() => notesFiles.saveSheet(dir, { ...first, id: '../../evil' }, null)).toThrow();
    expect(() => notesFiles.removeNote(dir, '../../evil', 1)).toThrow();
    expect(notesFiles.listSheets(dir)).toEqual([]);
  });
});
