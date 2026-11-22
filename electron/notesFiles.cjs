/**
 * Notes on disk (see src/notes/noteTypes.ts). One sheet is two files in the
 * notes folder: `<id>.json` and, when the window could be captured,
 * `<id>.jpg`. Plain `fs`, no Electron, so the tests can run it.
 */
const fs = require('node:fs');
const path = require('node:path');

const SHEET_ID = /^\d{4}-\d{2}-\d{2}_\d{6}-[a-z]+$/;
const MAX_SHEET_BYTES = 1024 * 1024;

const README = `vibrato~ notes

Comments and pen marks the owner left on the running app (the Notes button in
the top strip, or the N key).

Each visit to Notes mode is a sheet: <id>.json, and <id>.jpg, a screenshot of
the window with the numbered marks on it.

In the JSON, "context" is the mode, the window size and the app's saved
settings. Each note has the text, "at" (where it points, in CSS pixels from
the window's top-left corner; multiply by "screenshotScale" for pixels in the
screenshot) and "target": the frame region, the labels around the thing, and
its CSS-module class names, which can be searched for in src/.

When a note has been dealt with, set its "status" to "done" and add a short
"reply". The app shows both in its list of notes.
`;

function assertId(id) {
  if (typeof id !== 'string' || !SHEET_ID.test(id)) throw new Error('Not a sheet id');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, 'README.txt');
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, README);
}

/** Write a sheet, and its screenshot when there is one. Returns the sheet as saved. */
function saveSheet(dir, sheet, jpeg, screenshotScale) {
  if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.notes)) {
    throw new Error('Not a sheet');
  }
  assertId(sheet.id);
  ensureDir(dir);
  const saved = { ...sheet };
  if (jpeg) {
    saved.screenshot = `${sheet.id}.jpg`;
    saved.screenshotScale = screenshotScale || 1;
    fs.writeFileSync(path.join(dir, saved.screenshot), jpeg);
  } else if (!fs.existsSync(path.join(dir, `${sheet.id}.jpg`))) {
    saved.screenshot = null;
  }
  const json = JSON.stringify(saved, null, 2);
  if (Buffer.byteLength(json) > MAX_SHEET_BYTES) throw new Error('Sheet too large');
  fs.writeFileSync(path.join(dir, `${sheet.id}.json`), `${json}\n`);
  return saved;
}

/** Every sheet in the folder, newest first. Files that are not sheets are skipped. */
function listSheets(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const sheets = [];
  for (const name of names) {
    if (!name.endsWith('.json') || !SHEET_ID.test(name.slice(0, -5))) continue;
    try {
      const sheet = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (sheet && sheet.id === name.slice(0, -5) && Array.isArray(sheet.notes)) sheets.push(sheet);
    } catch {
      // A half-written or hand-edited file that does not parse: leave it alone.
    }
  }
  return sheets.sort((a, b) => b.id.localeCompare(a.id));
}

/** Take one note out of a sheet. The sheet's files go when no note is left. */
function removeNote(dir, id, n) {
  assertId(id);
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return;
  const sheet = JSON.parse(fs.readFileSync(file, 'utf8'));
  const notes = Array.isArray(sheet.notes) ? sheet.notes.filter((note) => note.n !== n) : [];
  if (notes.length === 0) {
    fs.rmSync(file);
    fs.rmSync(path.join(dir, `${id}.jpg`), { force: true });
    return;
  }
  fs.writeFileSync(file, `${JSON.stringify({ ...sheet, notes }, null, 2)}\n`);
}

module.exports = { saveSheet, listSheets, removeNote, SHEET_ID };
