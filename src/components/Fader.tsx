import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  FADER_MAX_DB,
  FADER_MIN_DB,
  FADER_STEPS,
  faderDb,
  faderLevelAtStep,
  faderStep,
  formatFaderLevel,
  nudgeFaderLevel,
  type FaderLevel,
} from '../lib/audio/jamMix';
import styles from './Fader.module.css';

interface FaderProps {
  /** What it sets: "Guitar". */
  label: string;
  level: FaderLevel;
  onChange: (level: FaderLevel) => void;
}

/**
 * A small vertical fader for one layer of the jam's mix: off at the bottom,
 * then -24 dB up to +6 dB, with 0 dB (the level the jam had before faders)
 * marked near the top. Drag or click the track; the arrow keys move 1 dB and
 * Shift+arrow 3 dB; double-click, or Delete, puts it back at 0 dB. The level
 * reads out while the pointer is over it, while it is dragged and while it has
 * focus. It does not touch audio: `onChange` carries the new level.
 */
export function Fader({ label, level, onChange }: FaderProps) {
  const travelRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const step = faderStep(level);
  const text = formatFaderLevel(level);

  const levelAt = (clientY: number): FaderLevel | null => {
    const rect = travelRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return null;
    return faderLevelAtStep(((rect.bottom - clientY) / rect.height) * FADER_STEPS);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const next = levelAt(event.clientY);
    if (next === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onChange(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // Not compared with `level`: two moves can land before the screen catches up.
    const next = levelAt(event.clientY);
    if (next !== null) onChange(next);
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const size = event.shiftKey ? 3 : 1;
    let next: FaderLevel;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = nudgeFaderLevel(level, size);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = nudgeFaderLevel(level, -size);
        break;
      case 'PageUp':
        next = nudgeFaderLevel(level, 3);
        break;
      case 'PageDown':
        next = nudgeFaderLevel(level, -3);
        break;
      case 'Home':
        next = 'off';
        break;
      case 'End':
        next = FADER_MAX_DB;
        break;
      case 'Delete':
      case 'Backspace':
        next = 0;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== level) onChange(next);
  };

  return (
    <div className={styles.fader} data-off={level === 'off' ? 'true' : undefined} data-dragging={dragging ? 'true' : undefined}>
      <span className={styles.value} aria-hidden="true">
        {text}
      </span>
      <div
        className={styles.slider}
        role="slider"
        tabIndex={0}
        aria-label={`${label} level`}
        aria-orientation="vertical"
        aria-valuemin={FADER_MIN_DB - 1}
        aria-valuemax={FADER_MAX_DB}
        aria-valuenow={faderDb(level)}
        aria-valuetext={text}
        title={`${label}: drag, or use the arrow keys. Double-click for 0 dB.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={() => setDragging(false)}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onChange(0)}
      >
        <div ref={travelRef} className={styles.travel}>
          <span className={styles.rail} aria-hidden="true" />
          <span className={styles.fill} style={{ height: `${(step / FADER_STEPS) * 100}%` }} aria-hidden="true" />
          <span className={styles.zero} style={{ bottom: `${(faderStep(0) / FADER_STEPS) * 100}%` }} aria-hidden="true" />
          <span className={styles.cap} style={{ bottom: `${(step / FADER_STEPS) * 100}%` }} aria-hidden="true" />
        </div>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
