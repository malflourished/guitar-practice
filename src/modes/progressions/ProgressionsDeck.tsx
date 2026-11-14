import { useMemo } from 'react';
import { PlayControl, type PlayControlProps } from '../../components/PlayControl';
import { DisplayToggles } from '../../components/DisplayToggles';
import { Deck } from '../../components/Frame';
import type { DisplaySettings } from '../../hooks/useDisplaySettings';
import type { FaderLevel, JamLayer, JamMix } from '../../lib/audio/jamMix';
import { formatClimb, type ClimbNow } from '../../lib/music';
import type { ProgressionsState } from './useProgressionsState';
import { FormStrip } from './FormStrip';
import { MixFaders } from './MixFaders';
import { ProgressionsControls } from './ProgressionsControls';
import { jamChordsOf } from './jamChords';
import type { JamLoopState } from './useJamLoop';
import styles from './ProgressionsDeck.module.css';

interface ProgressionsDeckProps {
  progressions: ProgressionsState;
  /** Where the jam loop is. */
  jam: JamLoopState;
  /** While "Move along the neck" plays: the region the pass is in and what comes next. */
  climb: ClimbNow | null;
  /** Beats a minute, for the form strip's playhead. */
  tempo: number;
  play: PlayControlProps;
  display: DisplaySettings;
  supportsChordTones: boolean;
  mix: JamMix;
  onMixChange: (layer: JamLayer, level: FaderLevel) => void;
}

/**
 * The Progressions deck, in three columns: the pickers, the current chord and
 * its next change, and Play on the left; the form as a lead sheet in the
 * middle; the Guitar, Bass and Pad faders at the right end. It takes over the
 * shared `ModeDeck`'s layout because the form and the mix need the deck's
 * whole height.
 */
export function ProgressionsDeck({
  progressions,
  jam,
  climb,
  tempo,
  play,
  display,
  supportsChordTones,
  mix,
  onMixChange,
}: ProgressionsDeckProps) {
  const {
    progressionId,
    progressionStepIndex,
    resolvedProgressionSteps: steps,
    handleProgressionChange,
    setProgressionStepIndex,
  } = progressions;
  const chords = useMemo(() => jamChordsOf(steps), [steps]);
  // "frets 3–7 · up next pass": it sits under the form strip, which is wide enough for it
  // (the beat row beside the dots is not: 284 px at the smallest window)
  const climbText = climb ? formatClimb(climb, play.options.jamLoop) : '';

  return (
    <Deck>
      <div className={styles.layout}>
        <div className={styles.controlsBox}>
          <div className={styles.controls}>
            <ProgressionsControls
              progressionId={progressionId}
              progressionStepIndex={progressionStepIndex}
              resolvedSteps={steps}
              onProgressionChange={handleProgressionChange}
              onProgressionStepChange={setProgressionStepIndex}
              jam={jam}
              climbText={climbText}
              loop={play.options.jamLoop}
            />
            <div className={styles.playRow}>
              <PlayControl {...play} />
              {supportsChordTones && (
                <DisplayToggles
                  showChordTones={display.showChordTones}
                  onChordTonesToggle={() => display.setShowChordTones((prev) => !prev)}
                />
              )}
            </div>
          </div>
        </div>
        <FormStrip
          steps={steps}
          chords={chords}
          selectedIndex={progressionStepIndex}
          jam={jam}
          tempo={tempo}
          caption={climbText}
          onSelect={setProgressionStepIndex}
        />
        <MixFaders mix={mix} onChange={onMixChange} />
      </div>
    </Deck>
  );
}
