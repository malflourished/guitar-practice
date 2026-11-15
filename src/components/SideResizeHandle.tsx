import { useContext, useRef } from 'react';
import {
  clampSideWidth,
  defaultSideWidth,
  sideWidthAfterKey,
  sideWidthLimits,
} from '../lib/sideWidth';
import { FrameContext } from './frameContext';
import styles from './SideResizeHandle.module.css';

/** The custom property the frame reads the wanted panel width from. */
const WANT = '--side-want';

/**
 * The docked side panel's left edge as a handle (roadmap package Q): drag it,
 * or focus it and use the arrow keys, to set the panel's width. It sits beside
 * the panel, not in it, because the panel scrolls and a handle inside would
 * scroll away. While dragging, the width goes straight onto the frame so
 * nothing re-renders per pointer move; the width is saved once, on release.
 */
export function SideResizeHandle() {
  const { sideWidth, setSideWidth } = useContext(FrameContext);
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startWidth: number;
    width: number;
    before: string;
  } | null>(null);

  const frame = () => handle.current?.closest<HTMLElement>('[data-frame]') ?? null;
  const panelWidth = () =>
    handle.current?.previousElementSibling?.getBoundingClientRect().width ??
    defaultSideWidth(window.innerWidth);

  const limits = sideWidthLimits(window.innerWidth);
  const now = clampSideWidth(
    sideWidth ?? defaultSideWidth(window.innerWidth),
    window.innerWidth,
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = frame();
    if (!target) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startWidth = panelWidth();
    drag.current = {
      startX: event.clientX,
      startWidth,
      width: startWidth,
      before: target.style.getPropertyValue(WANT),
    };
    target.dataset.resizing = 'true';
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    const target = frame();
    if (!current || !target) return;
    // The panel is on the right: dragging left widens it.
    current.width = clampSideWidth(
      current.startWidth + (current.startX - event.clientX),
      window.innerWidth,
    );
    target.style.setProperty(WANT, `${current.width}px`);
  };

  const finish = (commit: boolean) => {
    const current = drag.current;
    const target = frame();
    drag.current = null;
    if (!target) return;
    delete target.dataset.resizing;
    if (!current) return;
    if (commit && current.width !== Math.round(current.startWidth)) {
      setSideWidth(current.width);
    } else if (current.before) {
      target.style.setProperty(WANT, current.before);
    } else {
      target.style.removeProperty(WANT);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = sideWidthAfterKey(
      event.key,
      event.shiftKey,
      panelWidth(),
      window.innerWidth,
    );
    if (next === null) return;
    event.preventDefault();
    // Follow the key at once, not 250 ms behind it, until it is released.
    const target = frame();
    if (target) target.dataset.resizing = 'true';
    setSideWidth(next);
  };

  const onKeyUp = () => {
    if (!drag.current) delete frame()?.dataset.resizing;
  };

  return (
    <div
      ref={handle}
      className={styles.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel"
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={now}
      tabIndex={0}
      title="Drag to resize the side panel. Double-click for the usual width."
      data-side-handle=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onLostPointerCapture={() => drag.current && finish(true)}
      onDoubleClick={() => setSideWidth(null)}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onKeyUp}
    />
  );
}
