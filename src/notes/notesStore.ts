import { useSyncExternalStore } from 'react';
import type { Sheet } from './noteTypes';
import { parseSheets, upsertSheet, withoutNote } from './sheets';

/** Whether Notes mode is on. One shared copy: the strip's button and the layer both use it. */
let open = false;
const listeners = new Set<() => void>();

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function setNotesOpen(next: boolean | ((current: boolean) => boolean)): void {
  const value = typeof next === 'function' ? next(open) : next;
  if (value === open) return;
  open = value;
  listeners.forEach((notify) => notify());
}

export function useNotesOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

/** Where sheets are kept. The Mac app's bridge writes files; a browser keeps them in localStorage. */
export interface NotesBridge {
  /** Save the sheet (the Mac app also captures the window now). Resolves with every sheet. */
  save(sheet: Sheet): Promise<{ sheet: Sheet; sheets: Sheet[] }>;
  list(): Promise<Sheet[]>;
  remove(id: string, n: number): Promise<Sheet[]>;
  /** Open the notes folder. Only the Mac app has one. */
  reveal?: () => Promise<void>;
  where(): Promise<string>;
}

declare global {
  interface Window {
    /** Set by electron/preload.cjs. */
    vibratoNotes?: NotesBridge;
  }
}

const STORAGE_KEY = 'vibrato:notes';

function readLocal(): Sheet[] {
  try {
    return parseSheets(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeLocal(sheets: Sheet[]): Sheet[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
  return sheets;
}

const localBridge: NotesBridge = {
  async save(sheet) {
    const saved = { ...sheet, screenshot: null };
    return { sheet: saved, sheets: writeLocal(upsertSheet(readLocal(), saved)) };
  },
  async list() {
    return readLocal();
  },
  async remove(id, n) {
    return writeLocal(withoutNote(readLocal(), id, n));
  },
  async where() {
    return 'this browser';
  },
};

export function notesBridge(): NotesBridge {
  return (typeof window !== 'undefined' && window.vibratoNotes) || localBridge;
}

/** True where notes are files with a screenshot (the Mac app). */
export const notesAreFiles = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.vibratoNotes);
