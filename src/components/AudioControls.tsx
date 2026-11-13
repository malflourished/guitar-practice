import type { ScaleAnchor, ScaleDirection } from '../lib/audio/pitch';
import type { ProgressionLadderDirection } from '../lib/music';
import styles from './AudioControls.module.css';

export type PlaybackMode = 'strum' | 'sequence' | 'progression';

const SCALE_ANCHORS: { id: ScaleAnchor; label: string; name: string }[] = [
  { id: 'root', label: 'Root', name: 'the root' },
  { id: 'third', label: '3rd', name: 'the 3rd' },
  { id: 'fifth', label: '5th', name: 'the 5th' },
];

const ANCHOR_TIP =
  'Start on: the scale note that scale runs (Ascending, Descending) start and end on. It changes playback only, not the notes shown.';

interface AudioControlsProps {
  muted: boolean;
  loading: boolean;
  canPlay: boolean;
  playbackMode: PlaybackMode;
  playingId: string | null;
  /** Enable "run the whole neck" traversal playback (multi-position scales). */
  canTraverse?: boolean;
  /** Which chord tone scale runs start on (scale playback only). */
  scaleAnchor?: ScaleAnchor;
  onScaleAnchorChange?: (anchor: ScaleAnchor) => void;
  onStrum: () => void;
  onPlayScale: (direction: ScaleDirection) => void;
  onPlayTraversal?: (direction: ScaleDirection) => void;
  onPlayProgression: () => void;
  onPlayProgressionLadder: (direction: ProgressionLadderDirection) => void;
}

export function AudioControls({
  muted,
  loading,
  canPlay,
  playbackMode,
  playingId,
  canTraverse = false,
  scaleAnchor,
  onScaleAnchorChange,
  onStrum,
  onPlayScale,
  onPlayTraversal,
  onPlayProgression,
  onPlayProgressionLadder,
}: AudioControlsProps) {
  const playDisabled = !canPlay || muted;
  const playingProgression = playingId === 'progression';
  const showTransport = true;

  return (
    <div
      className={styles.row}
      role="group"
      aria-label="Playback"
    >
      {showTransport && playbackMode === 'sequence' && scaleAnchor && onScaleAnchorChange && (
        <div className={styles.anchorField} title={ANCHOR_TIP}>
        <span className={styles.anchorLabel}>Start on</span>
        <div
          className={styles.anchorGroup}
          role="group"
          aria-label="Start on"
        >
          {SCALE_ANCHORS.map(({ id, label, name }) => (
            <button
              key={id}
              type="button"
              title={`Scale runs start and end on ${name} (playback only)`}
              className={
                scaleAnchor === id
                  ? styles.anchorButtonActive
                  : styles.anchorButton
              }
              aria-pressed={scaleAnchor === id}
              onClick={() => onScaleAnchorChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
      )}
      {!showTransport ? null : playbackMode === 'sequence' ? (
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
          {canTraverse &&
            onPlayTraversal &&
            (['ascending', 'descending'] as const).map((direction) => {
              const traverseId = `traverse-${direction}`;
              const active = playingId === traverseId;
              const label = direction === 'ascending' ? 'Neck ↑' : 'Neck ↓';
              return (
                <button
                  key={traverseId}
                  type="button"
                  className={`${styles.playButton} ${active ? styles.stopButton : ''}`}
                  onClick={() => onPlayTraversal(direction)}
                  disabled={playDisabled}
                  title="Play every position in turn, across the whole neck"
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
    </div>
  );
}
