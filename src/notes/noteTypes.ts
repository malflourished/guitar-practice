/**
 * Notes: the owner's comments and pen marks on the running app, kept so that
 * whoever works on the app next can see exactly what each one is about.
 *
 * A **sheet** is one visit to Notes mode on one screen: a screenshot of the
 * window with the marks on it, and one or more numbered **notes**. The Mac
 * app writes each sheet to `<userData>/notes/<id>.json` and `<id>.jpg`
 * (`electron/notesFiles.cjs`); in a browser the sheets stay in localStorage
 * and there is no screenshot.
 */

/** A point in the window, in CSS pixels from its top-left corner. */
export type Point = [x: number, y: number];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What a note is attached to, in words that can be searched for in `src/`. */
export interface NoteTarget {
  /** The frame region it sits in: strip, neck, deck, side or home. */
  region: string | null;
  /** The labelled things around it, outermost first. */
  path: string[];
  /** Its own name: its label, title or text. */
  label: string;
  tag: string;
  /** CSS-module class names, its own first, without the hash: `chordStrip`. */
  classes: string[];
  /** The text it shows, cut short. */
  text: string;
}

export interface Note {
  /** The number drawn beside it on the screenshot. */
  n: number;
  text: string;
  /** Set to `done`, with a `reply`, by whoever dealt with it. */
  status: 'open' | 'done';
  reply?: string;
  /** `pin`: a click on one thing. `marks`: pen strokes. */
  kind: 'pin' | 'marks';
  /** Where it points: the click, a loop's middle, or the end of an arrow. */
  at: { x: number; y: number };
  /** The thing's outline (pin) or the strokes' bounds (marks). */
  box: Box | null;
  target: NoteTarget | null;
  strokes: Point[][];
}

export interface SheetContext {
  /** The study mode, or `home`. */
  mode: string;
  theme: string;
  viewport: { width: number; height: number };
  /** The app's saved settings at the time: key, chord, tempo and so on. */
  settings: Record<string, unknown>;
}

export interface Sheet {
  /** Also the file name: `2026-11-21_140322-practice`. */
  id: string;
  createdAt: string;
  context: SheetContext;
  /** The screenshot's file name beside the JSON, or null in a browser. */
  screenshot: string | null;
  /** Screenshot pixels per CSS pixel: multiply `at` and `box` by it. */
  screenshotScale?: number;
  notes: Note[];
}
