/** Types for notesFiles.cjs, so the tests in src/notes can call it. */
interface StoredSheet {
  id: string;
  notes: unknown[];
  screenshot?: string | null;
  screenshotScale?: number;
}

declare const notesFiles: {
  SHEET_ID: RegExp;
  saveSheet<T extends StoredSheet>(
    dir: string,
    sheet: T,
    jpeg: Uint8Array | null,
    screenshotScale?: number,
  ): T & { screenshot: string | null; screenshotScale?: number };
  listSheets(dir: string): StoredSheet[];
  removeNote(dir: string, id: string, n: number): void;
};

export = notesFiles;
