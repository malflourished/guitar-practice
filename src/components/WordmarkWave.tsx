import { WAVE, waveFrames, wavePath } from '../lib/wordmarkWave';

const REST = wavePath(0);
const FRAMES = waveFrames().join(';');
/** Seconds for the wave to travel once along the string. */
const TRIP_SECONDS = 1.5;

/**
 * The ~ of the wordmark: a string held at both ends with a wave running along
 * it. Two lines are drawn and the stylesheet shows one: the moving one, or
 * the still one where motion is off (Scholar, and reduced motion).
 */
export function WordmarkWave() {
  return (
    <span className="wordmarkWave" aria-hidden="true">
      <svg viewBox={`0 0 ${WAVE.width} ${WAVE.height}`} focusable="false">
        <path className="wordmarkWaveStill" d={REST} />
        <path className="wordmarkWaveMoving" d={REST}>
          <animate attributeName="d" dur={`${TRIP_SECONDS}s`} repeatCount="indefinite" values={FRAMES} />
        </path>
      </svg>
    </span>
  );
}
