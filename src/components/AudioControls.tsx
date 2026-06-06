import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/engine';
import type { ScaleDirection } from '../lib/audio/pitch';
import styles from './AudioControls.module.css';

interface AudioControlsProps {
  instrument: GuitarInstrumentName;
  volume: number;
  muted: boolean;
  loading: boolean;
  canPlay: boolean;
  sequenceMode: boolean;
  playingDirection: ScaleDirection | null;
  tempo: number;
  onInstrumentChange: (name: GuitarInstrumentName) => void;
  onVolumeChange: (volume: number) => void;
  onMutedToggle: () => void;
  onTempoChange: (bpm: number) => void;
  onStrum: () => void;
  onPlayScale: (direction: ScaleDirection) => void;
}

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 400;

export function AudioControls({
  instrument,
  volume,
  muted,
  loading,
  canPlay,
  sequenceMode,
  playingDirection,
  tempo,
  onInstrumentChange,
  onVolumeChange,
  onMutedToggle,
  onTempoChange,
  onStrum,
  onPlayScale,
}: AudioControlsProps) {
  const playDisabled = !canPlay || muted;
  return (
    <div className={styles.row} role="group" aria-label="Audio">
      {sequenceMode ? (
        <div className={styles.playGroup} role="group" aria-label="Play scale">
          {(['ascending', 'descending'] as const).map((direction) => {
            const active = playingDirection === direction;
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

      {sequenceMode && (
        <label className={styles.tempo}>
          <span className={styles.tempoLabel}>{tempo} BPM</span>
          <input
            className={styles.slider}
            type="range"
            min={MIN_TEMPO}
            max={MAX_TEMPO}
            value={tempo}
            aria-label="Tempo (beats per minute)"
            onChange={(event) => onTempoChange(Number(event.target.value))}
          />
        </label>
      )}
    </div>
  );
}
