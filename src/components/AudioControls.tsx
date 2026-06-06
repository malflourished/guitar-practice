import { useEffect, useRef, useState } from 'react';
import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/engine';
import type { ScaleDirection } from '../lib/audio/pitch';
import type { ProgressionLadderDirection } from '../lib/music';
import styles from './AudioControls.module.css';

export type PlaybackMode = 'strum' | 'sequence' | 'progression';

interface AudioControlsProps {
  instrument: GuitarInstrumentName;
  volume: number;
  muted: boolean;
  loading: boolean;
  canPlay: boolean;
  playbackMode: PlaybackMode;
  playingId: string | null;
  tempo: number;
  onInstrumentChange: (name: GuitarInstrumentName) => void;
  onVolumeChange: (volume: number) => void;
  onMutedToggle: () => void;
  onTempoChange: (bpm: number) => void;
  onStrum: () => void;
  onPlayScale: (direction: ScaleDirection) => void;
  onPlayProgression: () => void;
  onPlayProgressionLadder: (direction: ProgressionLadderDirection) => void;
}

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 400;
export const DEFAULT_TEMPO = 90;

function clampTempo(bpm: number): number {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));
}

interface TempoFieldProps {
  tempo: number;
  onTempoChange: (bpm: number) => void;
}

function TempoField({ tempo, onTempoChange }: TempoFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(tempo));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(tempo));
  }, [tempo, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onTempoChange(clampTempo(parsed));
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(tempo));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={styles.tempoField}>
        <input
          ref={inputRef}
          className={styles.tempoInput}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Tempo in beats per minute"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
        />
        <span className={styles.tempoSuffix}>BPM</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.tempoButton}
      aria-label={`Tempo ${tempo} beats per minute. Click to edit.`}
      onClick={() => setEditing(true)}
    >
      {tempo} BPM
    </button>
  );
}

export function AudioControls({
  instrument,
  volume,
  muted,
  loading,
  canPlay,
  playbackMode,
  playingId,
  tempo,
  onInstrumentChange,
  onVolumeChange,
  onMutedToggle,
  onTempoChange,
  onStrum,
  onPlayScale,
  onPlayProgression,
  onPlayProgressionLadder,
}: AudioControlsProps) {
  const playDisabled = !canPlay || muted;
  const playingProgression = playingId === 'progression';
  const showTempo = playbackMode === 'sequence' || playbackMode === 'progression';

  return (
    <div className={styles.row} role="group" aria-label="Audio">
      {playbackMode === 'sequence' ? (
        <div className={styles.playGroup} role="group" aria-label="Play scale">
          {(['ascending', 'descending'] as const).map((direction) => {
            const active = playingId === direction;
            const label = direction === 'ascending' ? 'Ascending' : 'Descending';
            return (
              <button
                key={direction}
                type="button"
                className={`${styles.playButton} ${active ? styles.stopButton : ''}`}
                onClick={() => onPlayScale(direction)}
                disabled={playDisabled}
              >
                {active ? 'Stop' : loading ? 'Loading…' : label}
              </button>
            );
          })}
        </div>
      ) : playbackMode === 'progression' ? (
        <div className={styles.playGroup} role="group" aria-label="Play progression">
          <button
            type="button"
            className={styles.playButton}
            onClick={onStrum}
            disabled={playDisabled}
          >
            {loading ? 'Loading…' : 'Strum'}
          </button>
          <button
            type="button"
            className={`${styles.playButton} ${playingProgression ? styles.stopButton : ''}`}
            onClick={onPlayProgression}
            disabled={playDisabled}
          >
            {playingProgression ? 'Stop' : loading ? 'Loading…' : 'Play'}
          </button>
          {(['ascending', 'descending'] as const).map((direction) => {
            const playingIdForDirection =
              direction === 'ascending'
                ? 'progression-ascending'
                : 'progression-descending';
            const active = playingId === playingIdForDirection;
            const label = direction === 'ascending' ? 'Ascending' : 'Descending';
            return (
              <button
                key={direction}
                type="button"
                className={`${styles.playButton} ${active ? styles.stopButton : ''}`}
                onClick={() => onPlayProgressionLadder(direction)}
                disabled={playDisabled}
              >
                {active ? 'Stop' : loading ? 'Loading…' : label}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          className={styles.playButton}
          onClick={onStrum}
          disabled={playDisabled}
        >
          {loading ? 'Loading…' : 'Strum'}
        </button>
      )}

      <select
        className={styles.select}
        aria-label="Instrument sound"
        value={instrument}
        onChange={(event) =>
          onInstrumentChange(event.target.value as GuitarInstrumentName)
        }
      >
        {GUITAR_INSTRUMENTS.map(({ name, label }) => (
          <option key={name} value={name}>
            {label}
          </option>
        ))}
      </select>

      {showTempo && (
        <TempoField tempo={tempo} onTempoChange={onTempoChange} />
      )}

      <button
        type="button"
        className={muted ? styles.iconButtonSelected : styles.iconButton}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={onMutedToggle}
      >
        {muted ? 'Muted' : 'Sound'}
      </button>

      <input
        className={styles.slider}
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        aria-label="Volume"
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
      />
    </div>
  );
}
