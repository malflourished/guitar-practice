import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AmbientShapeFamily } from '../lib/ambientShapes';
import { ALL_AMBIENT_SHAPE_DEFINITIONS } from '../lib/ambientShapes';
import styles from './AmbientBackground.module.css';

const KEY_CROSSFADE_MS = 450;

interface AmbientLayerProps {
  style: CSSProperties;
  family: AmbientShapeFamily;
  opacity: number;
  transitionDisabled?: boolean;
}

function AmbientLayer({
  style,
  family,
  opacity,
  layerId,
  transitionDisabled = false,
}: AmbientLayerProps & { layerId: number }) {
  return (
    <div
      className={
        transitionDisabled
          ? `${styles.layer} ${styles.layerNoTransition}`
          : styles.layer
      }
      data-ambient-family={family}
      data-layer-id={layerId}
      style={{ ...style, opacity }}
    >
      <div className={styles.ambientArt}>
        <div className={styles.canvasDark} />
        <div className={styles.canvasLight} />

        <div className={styles.glowField}>
          <div className={styles.shapeFill}>
            <div className={styles.fillBase} />
            <div className={styles.fillTop} />
            <div className={styles.fillRight} />
            <div className={styles.fillBody} />
            <div className={styles.fillHook} />
          </div>
        </div>

        <div className={styles.vignette} />
        <div className={styles.bottomFadeDark} />
        <div className={styles.bottomFadeLight} />
        <div className={styles.grain} />
      </div>
    </div>
  );
}

interface AmbientBackgroundProps {
  style: CSSProperties;
  family?: AmbientShapeFamily;
  colorBoundary?: string;
  onCommit?: (style: CSSProperties) => void;
}

interface FadeLayer {
  id: number;
  style: CSSProperties;
  family: AmbientShapeFamily;
  opacity: number;
}

interface AmbientTarget {
  style: CSSProperties;
  family: AmbientShapeFamily;
  signature: string;
}

function ambientSignature(
  style: CSSProperties,
  family: AmbientShapeFamily,
): string {
  const vars = style as Record<string, string | number | undefined>;
  return [
    family,
    vars['--blob-1'],
    vars['--blob-2'],
    vars['--blob-3'],
    vars['--ambient-mask'],
    vars['--ambient-fill-angle'],
    vars['--ambient-body-x'],
    vars['--ambient-body-y'],
    vars['--ambient-hook-x'],
    vars['--ambient-hook-y'],
    vars['--ambient-right-width'],
  ].join('|');
}

function resolveBaseLayer(
  layers: FadeLayer[],
  stackEl: HTMLElement | null,
): FadeLayer {
  if (layers.length === 0) {
    throw new Error('AmbientBackground requires at least one layer');
  }

  if (layers.length === 1) {
    return { ...layers[0], opacity: 1 };
  }

  return freezeVisibleLayer(layers, stackEl);
}

function freezeVisibleLayer(
  layers: FadeLayer[],
  stackEl: HTMLElement | null,
): FadeLayer {
  const nodes = stackEl?.querySelectorAll<HTMLElement>('[data-layer-id]');
  if (!nodes || nodes.length === 0) {
    return { ...layers[layers.length - 1], opacity: 1 };
  }

  let winner = layers[layers.length - 1];
  let maxOpacity = -1;

  nodes.forEach((node) => {
    const layerId = Number(node.dataset.layerId);
    const layer = layers.find((entry) => entry.id === layerId);
    if (!layer) return;
    const opacity = Number.parseFloat(getComputedStyle(node).opacity);
    if (opacity > maxOpacity) {
      maxOpacity = opacity;
      winner = layer;
    }
  });

  return { ...winner, opacity: 1 };
}

export function AmbientBackground({
  style,
  family = 'steppedCove',
  colorBoundary,
  onCommit,
}: AmbientBackgroundProps) {
  const layerIdRef = useRef(0);
  const stackRef = useRef<HTMLDivElement>(null);
  const committedSignatureRef = useRef<string | null>(null);
  const transitionIdRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const fadeLayersRef = useRef<FadeLayer[]>([]);

  const latestTargetRef = useRef<AmbientTarget>({
    style,
    family,
    signature: ambientSignature(style, family),
  });

  latestTargetRef.current = {
    style,
    family,
    signature: ambientSignature(style, family),
  };

  const signature = latestTargetRef.current.signature;

  const [fadeLayers, setFadeLayers] = useState<FadeLayer[]>(() => {
    const id = layerIdRef.current++;
    const initial = [{ id, style, family, opacity: 1 }];
    fadeLayersRef.current = initial;
    return initial;
  });
  const [transitionDisabled, setTransitionDisabled] = useState(false);

  const clearTimers = () => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
    setTransitionDisabled(false);
  };

  const schedule = (callback: () => void, delayMs: number) => {
    const timerId = window.setTimeout(callback, delayMs);
    timersRef.current.push(timerId);
  };

  const commitLayers = (layers: FadeLayer[]) => {
    fadeLayersRef.current = layers;
    setFadeLayers(layers);
  };

  const commitDisplay = (committedStyle: CSSProperties) => {
    onCommit?.(committedStyle);
  };

  const runCrossfadeTo = (target: AmbientTarget) => {
    const transitionId = ++transitionIdRef.current;
    clearTimers();

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      committedSignatureRef.current = target.signature;
      const id = layerIdRef.current++;
      const committedStyle = {
        id,
        style: target.style,
        family: target.family,
        opacity: 1,
      };
      commitLayers([committedStyle]);
      commitDisplay(target.style);
      setTransitionDisabled(false);
      return;
    }

    const baseLayer = resolveBaseLayer(
      fadeLayersRef.current,
      stackRef.current,
    );

    if (
      ambientSignature(baseLayer.style, baseLayer.family) === target.signature
    ) {
      committedSignatureRef.current = target.signature;
      commitLayers([{ ...baseLayer, opacity: 1 }]);
      commitDisplay(baseLayer.style);
      setTransitionDisabled(false);
      return;
    }

    setTransitionDisabled(true);
    commitLayers([{ ...baseLayer, opacity: 1 }]);

    const incomingId = layerIdRef.current++;
    const incoming: FadeLayer = {
      id: incomingId,
      style: target.style,
      family: target.family,
      opacity: 0,
    };

    schedule(() => {
      if (transitionId !== transitionIdRef.current) return;

      setTransitionDisabled(false);
      commitLayers([
        { ...baseLayer, opacity: 1 },
        incoming,
      ]);

      schedule(() => {
        if (transitionId !== transitionIdRef.current) return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (transitionId !== transitionIdRef.current) return;
            commitLayers([
              { ...baseLayer, opacity: 0 },
              { ...incoming, opacity: 1 },
            ]);
          });
        });
      }, 16);
    }, 16);

    schedule(() => {
      if (transitionId !== transitionIdRef.current) return;

      const latest = latestTargetRef.current;

      if (latest.signature !== target.signature) {
        runCrossfadeTo(latest);
        return;
      }

      committedSignatureRef.current = latest.signature;
      commitLayers([
        {
          id: incomingId,
          style: latest.style,
          family: latest.family,
          opacity: 1,
        },
      ]);
      commitDisplay(latest.style);
      setTransitionDisabled(false);
    }, 16 + KEY_CROSSFADE_MS);
  };

  useEffect(() => {
    const target = latestTargetRef.current;

    if (committedSignatureRef.current === null) {
      committedSignatureRef.current = target.signature;
      commitDisplay(target.style);
      return;
    }

    if (committedSignatureRef.current === target.signature) return;

    runCrossfadeTo(target);
  }, [signature]);

  useEffect(() => () => clearTimers(), []);

  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.maskDef} aria-hidden="true" width="0" height="0">
        <defs>
          <filter
            id="ambientMaskBlur"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="0.055" />
          </filter>
          {ALL_AMBIENT_SHAPE_DEFINITIONS.map(({ maskId, colorPaths }) => (
            <mask
              key={maskId}
              id={maskId}
              maskUnits="objectBoundingBox"
              maskContentUnits="objectBoundingBox"
            >
              <rect width="1" height="1" fill="black" />
              {colorPaths.map((colorPath, index) => (
                <path
                  key={`${maskId}-${index}`}
                  d={colorPath}
                  fill="white"
                  filter="url(#ambientMaskBlur)"
                />
              ))}
            </mask>
          ))}
        </defs>
      </svg>

      <div
        ref={stackRef}
        className={styles.stack}
        style={
          colorBoundary
            ? ({ '--color-boundary': colorBoundary } as CSSProperties)
            : undefined
        }
      >
        {fadeLayers.map((layer) => (
          <AmbientLayer
            key={layer.id}
            layerId={layer.id}
            style={layer.style}
            family={layer.family}
            opacity={layer.opacity}
            transitionDisabled={transitionDisabled}
          />
        ))}
      </div>
    </div>
  );
}
