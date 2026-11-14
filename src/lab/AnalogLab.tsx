import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import './AnalogLab.css';
import { DIALS, PRESETS, effectiveLevels, type Dial } from './analogLevels';
import { setTexture, useTexture } from './analogStore';

/**
 * The analog texture layer: the app's default look (docs/ROADMAP.md, package F).
 *
 * Minimal interface, texture in the medium it is seen through. Vibrato is
 * emitted light (glow that bleeds, grain that moves) and uses the Subtle
 * levels; Scholar is ink on paper (fixed paper tooth, ink spread, warm stock)
 * and uses Print. The "Texture" switch in the theme dock turns it off.
 *
 * Hidden tuning tool: the backquote key (`) opens a panel whose presets and
 * dials override the theme's levels until the "theme" preset is picked.
 */

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

type Medium = 'tube' | 'slide' | 'paper';

const PRESET_NAMES = ['theme', ...Object.keys(PRESETS)];

function readMedium(): Medium {
  const root = document.querySelector<HTMLElement>('.themeRoot');
  if (root?.dataset.uiTheme === 'scholar') return 'paper';
  if (root?.dataset.vibratoCanvas === 'light') return 'slide';
  return 'tube';
}

function subscribeMedium(notify: () => void): () => void {
  // Watch the whole document: the theme root may not exist yet, or may be replaced.
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
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
  const texture = useTexture();
  const [open, setOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const medium = useSyncExternalStore(subscribeMedium, readMedium);
  const layersRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);

  const on = texture.on;
  const levels = effectiveLevels(texture, medium === 'paper' ? 'scholar' : 'vibrato');
  const active = on && !comparing;
  const glowing = active && levels.glow > 0;
  const { motion } = levels;

  // ` shows or hides the panel. While the treatment is on, hold B to see the app without it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.code === 'Backquote') {
        event.preventDefault();
        setOpen((current) => !current);
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

  const glow = levels.glow / 100;
  const warmth = levels.warmth / 100;
  const haloTint = `1 0 0 0 0  0 ${(1 - 0.28 * warmth).toFixed(3)} 0 0 0  0 0 ${(1 - 0.5 * warmth).toFixed(3)} 0 0  0 0 0 1 0`;
  const variables = Object.fromEntries(
    DIALS.map((dial) => [`--a-${dial}`, String(levels[dial] / 100)]),
  ) as CSSProperties;
  const nameIndex = medium === 'tube' ? 0 : 1;
  const summary = `texture ${on ? 'on' : 'off'} ${THEME_NAMES[medium]} · ${texture.preset} · ${DIALS.map((dial) => `${dial} ${levels[dial]}`).join(' · ')}`;

  const applyPreset = (name: string) => {
    setTexture((current) =>
      name === 'theme'
        ? { ...current, preset: 'theme', override: null }
        : { ...current, preset: name, override: { ...PRESETS[name] } },
    );
  };

  const setDial = (dial: Dial, value: number) => {
    setTexture((current) => ({
      ...current,
      preset: 'custom',
      override: { ...(current.override ?? levels), [dial]: value },
    }));
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
          <div className="analog-layer analog-grain analog-grain-bright" />
          <div className="analog-layer analog-fade" />
          <div className="analog-layer analog-warmth" />
          <div className="analog-layer analog-vignette" />
          <div className="analog-layer analog-breath" />
        </div>
      )}
      {open && (
        <aside className="analog-panel" aria-label="Texture tuning">
          <header>
            <strong>Texture</strong>
            <span>tuning</span>
            <button
              type="button"
              aria-label="Hide the panel"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <p className="analog-medium">
            {MEDIUM_NAMES[medium]}
            {!on && ' · Texture is off in the dock'}
          </p>
          <div className="analog-presets">
            {PRESET_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={texture.preset === name}
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
                value={levels[dial]}
                disabled={dial === 'motion' && medium === 'paper'}
                onChange={(event) => {
                  setDial(dial, Number(event.target.value));
                }}
              />
              <output>{levels[dial]}</output>
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
