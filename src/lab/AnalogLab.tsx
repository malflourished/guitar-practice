import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import './AnalogLab.css';

/**
 * Analog lab: a PROTOTYPE for the look work in docs/ROADMAP.md (package F).
 *
 * Off by default, and it renders nothing until it is switched on. Press the
 * backquote key (`) to open the panel, or load the app with ?lab=analog.
 * Deleting src/lab and its one line in main.tsx removes it completely.
 *
 * The idea being tested: keep the interface clean and minimal, and put the
 * texture in the medium it is seen through. Each theme gets the medium it
 * resembles: Vibrato is emitted light (glow that bleeds, grain that moves),
 * Scholar is ink on paper (fixed paper tooth, ink spread, warm stock).
 */

const DIALS = ['grain', 'glow', 'fade', 'warmth', 'vignette', 'raster', 'motion'] as const;
type Dial = (typeof DIALS)[number];
type Levels = Record<Dial, number>;
type Medium = 'tube' | 'slide' | 'paper';

interface LabState extends Levels {
  on: boolean;
  open: boolean;
  preset: string;
}

const PRESETS: Record<string, Levels> = {
  subtle: { grain: 26, glow: 30, fade: 8, warmth: 30, vignette: 20, raster: 0, motion: 50 },
  film: { grain: 46, glow: 50, fade: 18, warmth: 70, vignette: 34, raster: 0, motion: 60 },
  tube: { grain: 20, glow: 72, fade: 12, warmth: 10, vignette: 46, raster: 36, motion: 85 },
  print: { grain: 60, glow: 36, fade: 10, warmth: 50, vignette: 14, raster: 0, motion: 0 },
};

/** The same dial means a different thing in each medium. [light, paper] */
const DIAL_NAMES: Record<Dial, [string, string]> = {
  grain: ['Grain', 'Paper tooth'],
  glow: ['Glow', 'Ink spread'],
  fade: ['Black lift', 'Ink fade'],
  warmth: ['Warmth', 'Stock tint'],
  vignette: ['Falloff', 'Edge tone'],
  raster: ['Raster', 'Halftone'],
  motion: ['Motion', 'Motion'],
};

const MEDIUM_NAMES: Record<Medium, string> = {
  tube: 'Emitted light · Vibrato dark',
  slide: 'Light table · Vibrato light',
  paper: 'Ink on paper · Scholar',
};

const THEME_NAMES: Record<Medium, string> = {
  tube: 'vibrato-dark',
  slide: 'vibrato-light',
  paper: 'scholar',
};

const STORAGE_KEY = 'vibrato:analog-lab';

function loadState(): LabState {
  const state: LabState = { on: false, open: false, preset: 'off', ...PRESETS.subtle };
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const stored = parsed as Record<string, unknown>;
      for (const dial of DIALS) {
        const value = stored[dial];
        if (typeof value === 'number' && value >= 0 && value <= 100) state[dial] = value;
      }
      if (typeof stored.on === 'boolean') state.on = stored.on;
      if (typeof stored.open === 'boolean') state.open = stored.open;
      if (typeof stored.preset === 'string') state.preset = stored.preset;
    }
  } catch {
    // ignore storage read failures
  }
  if (new URLSearchParams(window.location.search).get('lab') === 'analog') {
    state.open = true;
    if (!state.on) {
      state.on = true;
      state.preset = state.preset === 'off' ? 'subtle' : state.preset;
    }
  }
  return state;
}

function readMedium(): Medium {
  const root = document.querySelector<HTMLElement>('.themeRoot');
  if (root?.dataset.uiTheme === 'scholar') return 'paper';
  if (root?.dataset.vibratoCanvas === 'light') return 'slide';
  return 'tube';
}

function subscribeMedium(notify: () => void): () => void {
  const root = document.querySelector('.themeRoot');
  if (!root) return () => {};
  const observer = new MutationObserver(notify);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-ui-theme', 'data-vibrato-canvas'],
  });
  return () => observer.disconnect();
}

let grainTile: string | null = null;

/** A seamless 256px noise tile: fine grain plus a coarser clump layer, with a little colour. */
function getGrainTile(): string {
  if (grainTile !== null) return grainTile;
  const size = 256;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return (grainTile = 'none');
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  const coarse = Float32Array.from({ length: half * half }, gauss);
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const x0 = x >> 1;
      const y0 = y >> 1;
      const x1 = (x0 + 1) % half;
      const y1 = (y0 + 1) % half;
      const fx = (x & 1) / 2;
      const fy = (y & 1) / 2;
      const clump =
        (coarse[y0 * half + x0] * (1 - fx) + coarse[y0 * half + x1] * fx) * (1 - fy) +
        (coarse[y1 * half + x0] * (1 - fx) + coarse[y1 * half + x1] * fx) * fy;
      const luma = gauss() * 0.8 + clump * 0.7;
      const index = (y * size + x) * 4;
      image.data[index] = 128 + (luma + gauss() * 0.18) * 44;
      image.data[index + 1] = 128 + (luma + gauss() * 0.18) * 44;
      image.data[index + 2] = 128 + (luma + gauss() * 0.18) * 44;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  grainTile = `url(${canvas.toDataURL('image/png')})`;
  return grainTile;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && target.type !== 'range';
}

export default function AnalogLab() {
  const [state, setState] = useState<LabState>(loadState);
  const [comparing, setComparing] = useState(false);
  const medium = useSyncExternalStore(subscribeMedium, readMedium);
  const layersRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);

  const active = state.on && !comparing;
  const glowing = active && state.glow > 0;
  const { on, open, motion } = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage write failures
    }
  }, [state]);

  // ` shows or hides the panel. While the treatment is on, hold B to see the app without it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.code === 'Backquote') {
        event.preventDefault();
        setState((current) =>
          current.open
            ? { ...current, open: false }
            : current.on
              ? { ...current, open: true }
              : { ...current, open: true, on: true, preset: current.preset === 'off' ? 'subtle' : current.preset },
        );
      } else if (event.code === 'KeyB' && !event.repeat) {
        setComparing(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyB') setComparing(false);
    };
    const onBlur = () => setComparing(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Light bleed and ink spread need the whole frame, so they run as one filter on the root element.
  useEffect(() => {
    if (!glowing) return;
    const root = document.documentElement;
    root.style.filter = `url(#${medium === 'tube' ? 'analog-light' : 'analog-ink'})`;
    return () => {
      root.style.filter = '';
    };
  }, [glowing, medium]);

  // Grain moves at film cadence, not at the display's frame rate. Paper does not move at all.
  useEffect(() => {
    if (!active) return;
    const layers = layersRef.current;
    if (!layers) return;
    const grains = layers.querySelectorAll<HTMLElement>('.analog-grain');
    const tile = getGrainTile();
    grains.forEach((grain) => {
      grain.style.backgroundImage = tile;
    });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const moving = !reduced && medium !== 'paper' && motion > 0;
    if (!moving && !open) return;
    const interval = 1000 / (8 + (motion / 100) * 16);
    let frame = 0;
    let lastStep = 0;
    let frames = 0;
    let windowStart = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      frames += 1;
      if (now - windowStart >= 1000) {
        if (fpsRef.current) {
          fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - windowStart))} fps`;
        }
        frames = 0;
        windowStart = now;
      }
      if (!moving || now - lastStep < interval) return;
      lastStep = now;
      const position = `${Math.floor(Math.random() * 256)}px ${Math.floor(Math.random() * 256)}px`;
      grains.forEach((grain) => {
        grain.style.backgroundPosition = position;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, medium, motion, open]);

  if (!on && !open) return null;

  const glow = state.glow / 100;
  const warmth = state.warmth / 100;
  const haloTint = `1 0 0 0 0  0 ${(1 - 0.28 * warmth).toFixed(3)} 0 0 0  0 0 ${(1 - 0.5 * warmth).toFixed(3)} 0 0  0 0 0 1 0`;
  const variables = Object.fromEntries(
    DIALS.map((dial) => [`--a-${dial}`, String(state[dial] / 100)]),
  ) as CSSProperties;
  const nameIndex = medium === 'tube' ? 0 : 1;
  const summary = `analog on ${THEME_NAMES[medium]} · ${on ? state.preset : 'off'} · ${DIALS.map((dial) => `${dial} ${state[dial]}`).join(' · ')}`;

  const applyPreset = (name: string) => {
    setState((current) =>
      name === 'off'
        ? { ...current, on: false, preset: 'off' }
        : { ...current, ...PRESETS[name], on: true, preset: name },
    );
  };

  const copySummary = () => {
    summaryRef.current?.select();
    void navigator.clipboard?.writeText(summary).catch(() => {});
  };

  return (
    <>
      {on && (
        <div
          ref={layersRef}
          className="analog"
          data-medium={medium}
          data-bypass={comparing ? 'true' : undefined}
          style={variables}
          aria-hidden="true"
        >
          <svg className="analog-defs" width="0" height="0">
            <filter id="analog-light" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feComponentTransfer in="SourceGraphic" result="bright">
                <feFuncR type="linear" slope="1.7" intercept="-0.5" />
                <feFuncG type="linear" slope="1.7" intercept="-0.5" />
                <feFuncB type="linear" slope="1.7" intercept="-0.5" />
              </feComponentTransfer>
              <feGaussianBlur in="bright" stdDeviation="7" result="tight" />
              <feGaussianBlur in="bright" stdDeviation="26" result="wide" />
              <feComposite
                in="tight"
                in2="wide"
                operator="arithmetic"
                k1="0"
                k2={(0.95 * glow).toFixed(3)}
                k3={(0.6 * glow).toFixed(3)}
                k4="0"
                result="bleed"
              />
              <feColorMatrix in="bleed" type="matrix" values={haloTint} result="halo" />
              <feBlend in="halo" in2="SourceGraphic" mode="screen" />
            </filter>
            <filter id="analog-ink" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation={(0.25 + 0.7 * glow).toFixed(2)} result="spread" />
              <feBlend in="spread" in2="SourceGraphic" mode="darken" />
            </filter>
          </svg>
          <div className="analog-layer analog-raster" />
          <div className="analog-layer analog-grain analog-grain-body" />
          <div className="analog-layer analog-grain analog-grain-floor" />
          <div className="analog-layer analog-fade" />
          <div className="analog-layer analog-warmth" />
          <div className="analog-layer analog-vignette" />
          <div className="analog-layer analog-breath" />
        </div>
      )}
      {open && (
        <aside className="analog-panel" aria-label="Analog lab, a prototype">
          <header>
            <strong>Analog lab</strong>
            <span>prototype</span>
            <button
              type="button"
              aria-label="Hide the panel"
              onClick={() => setState((current) => ({ ...current, open: false }))}
            >
              ×
            </button>
          </header>
          <p className="analog-medium">{MEDIUM_NAMES[medium]}</p>
          <div className="analog-presets">
            {['off', ...Object.keys(PRESETS)].map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={on ? state.preset === name : name === 'off'}
                onClick={() => applyPreset(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {DIALS.map((dial) => (
            <label key={dial} className="analog-dial">
              <span>{DIAL_NAMES[dial][nameIndex]}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={state[dial]}
                disabled={dial === 'motion' && medium === 'paper'}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setState((current) => ({ ...current, [dial]: value, on: true, preset: 'custom' }));
                }}
              />
              <output>{state[dial]}</output>
            </label>
          ))}
          <div className="analog-actions">
            <button
              type="button"
              onPointerDown={() => setComparing(true)}
              onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)}
            >
              Hold to compare
            </button>
            <button type="button" onClick={copySummary}>
              Copy
            </button>
          </div>
          <input
            ref={summaryRef}
            className="analog-summary"
            readOnly
            value={summary}
            aria-label="Current settings as text"
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="analog-foot">
            <span ref={fpsRef}>– fps</span> · ` hides this · hold B to compare
          </p>
        </aside>
      )}
    </>
  );
}
