import { useEffect, useRef } from 'react';
import { ordinalPosition, type Position } from '../lib/music';
import styles from './PositionSlider.module.css';

interface PositionSliderProps {
  regions: Position[];
  /** Active position index — the primary (filled) handle. */
  selectedIndex: number;
  onChange: (index: number) => void;
  /** Secondary handle index; equal to selectedIndex means the span is collapsed. */
  spanEndIndex?: number;
  onSpanEndChange?: (index: number) => void;
  /** Allow spawning/dragging a second handle to show a span of positions. */
  allowRange?: boolean;
  disabled?: boolean;
}

type DragTarget = 'primary' | 'span' | null;

export function PositionSlider({
  regions,
  selectedIndex,
  onChange,
  spanEndIndex,
  onSpanEndChange,
  allowRange = false,
  disabled = false,
}: PositionSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragTarget>(null);

  const count = regions.length;
  const lastIndex = Math.max(0, count - 1);
  const canRange = allowRange && onSpanEndChange !== undefined && count > 1;
  const effectiveSpan = canRange ? (spanEndIndex ?? selectedIndex) : selectedIndex;
  const isOpen = canRange && effectiveSpan !== selectedIndex;

  const pct = (index: number) =>
    count > 1 ? (index / lastIndex) * 100 : 0;

  const indexFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || count <= 1) return selectedIndex;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return selectedIndex;
    const fraction = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(lastIndex, Math.round(fraction * lastIndex)));
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const index = indexFromClientX(event.clientX);
      if (dragRef.current === 'primary') {
        onChange(index);
      } else {
        onSpanEndChange?.(index);
      }
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, onSpanEndChange, count, selectedIndex]);

  if (count === 0) return null;

  const region = regions[selectedIndex];
  const positionLabel = ordinalPosition(region.number);
  const lowIndex = Math.min(selectedIndex, effectiveSpan);
  const highIndex = Math.max(selectedIndex, effectiveSpan);

  const moveBy = (handle: Exclude<DragTarget, null>, delta: number) => {
    if (handle === 'primary') {
      onChange(Math.max(0, Math.min(lastIndex, selectedIndex + delta)));
    } else {
      onSpanEndChange?.(Math.max(0, Math.min(lastIndex, effectiveSpan + delta)));
    }
  };

  const onPrimaryPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.metaKey && canRange && !isOpen) {
      // Cmd-drag the active handle to spawn a second handle and open a span.
      dragRef.current = 'span';
      onSpanEndChange?.(indexFromClientX(event.clientX));
    } else {
      dragRef.current = 'primary';
    }
  };

  const onSpanPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = 'span';
  };

  const onTrackPointerDown = (event: React.PointerEvent) => {
    if (disabled || count <= 1) return;
    dragRef.current = 'primary';
    onChange(indexFromClientX(event.clientX));
  };

  const onPrimaryKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    const handle: Exclude<DragTarget, null> =
      event.shiftKey && canRange ? 'span' : 'primary';
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        moveBy(handle, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        moveBy(handle, -1);
        break;
      case 'Home':
        event.preventDefault();
        onChange(0);
        break;
      case 'End':
        event.preventDefault();
        onChange(lastIndex);
        break;
      default:
        break;
    }
  };

  const onSpanKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveBy('span', 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveBy('span', -1);
    }
  };

  const counterText = isOpen
    ? `${regions[lowIndex].number}–${regions[highIndex].number} / ${count}`
    : `${region.number} / ${count}${region.shapeLabel ? ` · ${region.shapeLabel}` : ''}`;

  return (
    <div className={styles.bar}>
      <span className={styles.counter} aria-hidden="true">
        {counterText}
        {canRange && !isOpen ? (
          <span className={styles.hint}> · ⌘-drag to span positions</span>
        ) : null}
      </span>
      <div
        ref={trackRef}
        className={disabled ? styles.trackDisabled : styles.track}
        onPointerDown={onTrackPointerDown}
        role="group"
        aria-label="Fretboard position"
      >
        <div className={styles.rail} />
        {isOpen && (
          <div
            className={styles.rangeFill}
            style={{
              left: `${pct(lowIndex)}%`,
              width: `${pct(highIndex) - pct(lowIndex)}%`,
            }}
          />
        )}
        {isOpen && (
          <div
            className={styles.thumbSpan}
            style={{ left: `${pct(effectiveSpan)}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Span end position"
            aria-valuemin={1}
            aria-valuemax={count}
            aria-valuenow={regions[effectiveSpan].number}
            onPointerDown={onSpanPointerDown}
            onKeyDown={onSpanKeyDown}
          />
        )}
        <div
          className={disabled ? styles.thumbDisabled : styles.thumb}
          style={{ left: `${pct(selectedIndex)}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Fretboard position"
          aria-disabled={disabled}
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={region.number}
          aria-valuetext={`${positionLabel} position, frets ${region.startFret} to ${region.endFret}${region.shapeLabel ? `, ${region.shapeLabel}` : ''}`}
          onPointerDown={onPrimaryPointerDown}
          onKeyDown={onPrimaryKeyDown}
        />
      </div>
    </div>
  );
}
