import type { NoteTarget } from './noteTypes';

/** The few things this module reads from a DOM element, so it can be tested without one. */
export interface ElementLike {
  tagName: string;
  parentElement: ElementLike | null;
  getAttribute(name: string): string | null;
  textContent: string | null;
  /** The text as it is laid out, where the element has it: blocks do not run together. */
  innerText?: string;
}

const SVG_PARTS = new Set([
  'g', 'circle', 'path', 'text', 'tspan', 'line', 'rect', 'polygon', 'polyline', 'ellipse', 'use',
]);

/** Tags that are a thing in themselves, with or without a class. */
const OWN_THING = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'label', 'li', 'p', 'h1', 'h2', 'h3', 'h4',
  'section', 'aside', 'header', 'nav', 'main', 'svg', 'canvas', 'img',
]);

const tagOf = (el: ElementLike) => el.tagName.toLowerCase();

const collapse = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

const textOf = (el: ElementLike) => collapse(el.innerText ?? el.textContent);

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * Class names as they are written in the stylesheets. Vite names a CSS-module
 * class `_chordStrip_1pzvq_8`; `chordStrip` is what is in `src/`.
 */
export function localClassNames(value: string | null): string[] {
  return collapse(value)
    .split(' ')
    .filter(Boolean)
    .map((name) => /^_(.+)_[A-Za-z0-9]+_\d+$/.exec(name)?.[1] ?? name);
}

const isNamed = (el: ElementLike) =>
  Boolean(el.getAttribute('aria-label') || el.getAttribute('data-region'));

/**
 * The thing a pointer is on, given the innermost element under it. Inside a
 * drawing that is the labelled group (a note on the neck) rather than the
 * circle; elsewhere it is the nearest element with a name, a role or a class
 * of its own.
 */
export function pickTarget<T extends ElementLike>(el: T): T {
  if (SVG_PARTS.has(tagOf(el))) {
    let classed: T | null = null;
    for (let node: T | null = el; node; node = node.parentElement as T | null) {
      if (tagOf(node) === 'svg') return classed ?? node;
      if (node.getAttribute('aria-label')) return node;
      if (!classed && node.getAttribute('class')) classed = node;
    }
    return classed ?? el;
  }
  let node: T | null = el;
  for (let depth = 0; node && depth < 4; depth += 1) {
    if (
      OWN_THING.has(tagOf(node)) ||
      isNamed(node) ||
      node.getAttribute('role') ||
      node.getAttribute('class')
    ) {
      return node;
    }
    node = node.parentElement as T | null;
  }
  return el;
}

function ownLabel(el: ElementLike, classes: string[]): string {
  const named = el.getAttribute('aria-label') || el.getAttribute('title');
  if (named) return clip(collapse(named), 70);
  const tag = tagOf(el);
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    return el.getAttribute('name') || el.getAttribute('placeholder') || el.getAttribute('type') || tag;
  }
  const text = tag === 'svg' ? '' : textOf(el);
  if (text) return clip(text, 70);
  return el.getAttribute('data-region') || classes[0] || tag;
}

/** Describe an element so that it can be found again in the source. */
export function describeTarget(el: ElementLike): NoteTarget {
  const path: string[] = [];
  const classes = localClassNames(el.getAttribute('class'));
  let region = el.getAttribute('data-region');
  let depth = 0;
  for (let node = el.parentElement; node; node = node.parentElement) {
    const nodeRegion = node.getAttribute('data-region');
    if (nodeRegion && !region) region = nodeRegion;
    const name = node.getAttribute('aria-label');
    if (name) path.unshift(clip(collapse(name), 70));
    if (depth < 3) {
      for (const local of localClassNames(node.getAttribute('class'))) {
        if (!classes.includes(local)) classes.push(local);
      }
    }
    depth += 1;
  }
  return {
    region: region || null,
    path,
    label: ownLabel(el, classes),
    tag: tagOf(el),
    classes: classes.slice(0, 8),
    text: clip(tagOf(el) === 'svg' ? '' : textOf(el), 160),
  };
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** One line for the screen: "Deck › Practice block › Em". The thing itself is never the part cut. */
export function targetSummary(target: NoteTarget | null): string {
  if (!target) return 'The whole screen';
  const parts: string[] = [];
  const add = (part: string | null | undefined) => {
    if (part && !parts.some((seen) => seen.toLowerCase() === part.toLowerCase())) parts.push(part);
  };
  add(target.region ? capital(target.region) : null);
  const around = target.path[target.path.length - 1];
  // "Major and its modes: Mixolydian" already says which group it is in.
  if (around && !target.label.toLowerCase().includes(around.toLowerCase())) add(around);
  add(target.label);
  // A long label in the middle (a fretboard's full title) gives way first.
  if (parts.length === 3 && parts.join(' › ').length > 72) parts.splice(1, 1);
  return clip(parts.join(' › '), 90) || 'The whole screen';
}
