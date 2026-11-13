/**
 * A bank of resonant modes: the linear heart of a struck plate or bar.
 *
 * Each mode is a two-pole resonator with its own frequency and decay time.
 * The bank stands for one object that keeps ringing: every stroke adds
 * energy to it, so strokes build on each other, and changing the damping
 * (a hand on a cymbal, the foot closing a hi-hat) chokes what is already
 * sounding. See docs/sound/drums.md.
 *
 * A two-pole resonator alone also passes everything below its own frequency,
 * so thirty of them would add a thump under every stroke that no cymbal has.
 * The inputs are therefore differenced first (each sample minus the one two
 * before it), which makes every mode a true band-pass: nothing at 0 Hz.
 *
 * It has two inputs, each with its own gain per mode:
 * - `strike`, a short pulse or burst. A mode with strike gain g rings at
 *   amplitude g after a pulse whose samples sum to 1 (a pulse short against
 *   the mode's period; a longer one excites it less, as a soft stick does).
 * - `cascade`, a longer noise signal. A mode with cascade gain g settles at
 *   an RMS level of g times the noise's RMS, whatever its decay time and
 *   whatever the sample rate. It stands for the energy that the other modes
 *   of a real cymbal keep feeding in, and it turns each partial from a clean
 *   sine into a narrow, fluttering band of noise.
 */
export interface ModeSpec {
  /** Frequency in hertz. */
  hz: number;
  /** Time to fall by 60 dB when nothing damps it, in seconds. */
  t60: number;
  /** Gain from the strike input. */
  strike: number;
  /** Gain from the cascade input. */
  cascade: number;
}

/** Below this, a mode's memory is set to exactly zero so it never reaches denormal numbers. */
const FLUSH_LEVEL = 1e-12;

export class ModalBank {
  readonly count: number;
  /** True while any mode holds energy. A sleeping bank costs nothing. */
  active = false;

  private readonly sampleRate: number;
  private readonly cosine: Float64Array;
  private readonly sine: Float64Array;
  private readonly t60: Float64Array;
  private readonly strikeGain: Float64Array;
  private readonly cascadeBase: Float64Array;
  private readonly cascadeGain: Float64Array;
  private readonly a1: Float64Array;
  private readonly a2: Float64Array;
  private readonly y1: Float64Array;
  private readonly y2: Float64Array;
  private damping = 1;
  private floor = 0;
  // The last two samples of each input, for the differencing, and somewhere to put its result.
  private strikeBefore = 0;
  private strikeBeforeThat = 0;
  private cascadeBefore = 0;
  private cascadeBeforeThat = 0;
  private strikeWork = new Float64Array(128);
  private cascadeWork = new Float64Array(128);

  constructor(sampleRate: number, modes: readonly ModeSpec[]) {
    this.sampleRate = sampleRate;
    // A mode above 45% of the sample rate cannot be made: leave it out.
    const usable = modes.filter((mode) => mode.hz > 0 && mode.hz < sampleRate * 0.45 && mode.t60 > 0);
    const count = usable.length;
    this.count = count;
    this.cosine = new Float64Array(count);
    this.sine = new Float64Array(count);
    this.t60 = new Float64Array(count);
    this.strikeGain = new Float64Array(count);
    this.cascadeBase = new Float64Array(count);
    this.cascadeGain = new Float64Array(count);
    this.a1 = new Float64Array(count);
    this.a2 = new Float64Array(count);
    this.y1 = new Float64Array(count);
    this.y2 = new Float64Array(count);
    usable.forEach((mode, i) => {
      const w = (2 * Math.PI * mode.hz) / sampleRate;
      this.cosine[i] = Math.cos(w);
      this.sine[i] = Math.sin(w);
      this.t60[i] = mode.t60;
      // With its input differenced, the resonator answers a unit sample with 2 r^n cos(n w).
      this.strikeGain[i] = mode.strike / 2;
      this.cascadeBase[i] = mode.cascade * Math.SQRT1_2;
    });
    this.setDamping(1);
  }

  /**
   * Change the modes' gains and decay times in place, without touching what
   * is ringing: for a tone control. `modes` must be the list the bank was
   * built from, with new numbers.
   */
  retune(modes: readonly ModeSpec[]): void {
    const usable = modes.filter((mode) => mode.hz > 0 && mode.hz < this.sampleRate * 0.45 && mode.t60 > 0);
    if (usable.length !== this.count) return;
    usable.forEach((mode, i) => {
      this.t60[i] = mode.t60;
      this.strikeGain[i] = mode.strike / 2;
      this.cascadeBase[i] = mode.cascade * Math.SQRT1_2;
    });
    this.setDamping(this.damping, this.floor);
  }

  /**
   * Scale every decay time: 1 is the free object, 0.05 a hand or a foot on
   * it. `floorSeconds` keeps the shortest decay from collapsing to nothing.
   * Takes effect at once, on what is already ringing too.
   */
  setDamping(scale: number, floorSeconds = 0.004): void {
    this.damping = scale;
    this.floor = floorSeconds;
    const { a1, a2, cosine, t60, cascadeGain, cascadeBase, sampleRate } = this;
    for (let i = 0; i < this.count; i++) {
      const seconds = Math.max(floorSeconds, t60[i] * scale);
      const r = Math.exp(-6.907755 / (seconds * sampleRate));
      a1[i] = 2 * r * cosine[i];
      a2[i] = r * r;
      // Under steady noise a mode's power is 2 · gain² · σ² / (1 - r²): take that out.
      cascadeGain[i] = cascadeBase[i] * Math.sqrt(1 - r * r);
    }
  }

  /** The damping scale now in force. */
  get dampingScale(): number {
    return this.damping;
  }

  /**
   * Add the bank's sound to `out[0..count)`. `strike` and `cascade` are the
   * two inputs over the same stretch, or null when that input is silent.
   */
  process(out: Float64Array, strikeInput: Float64Array | null, cascadeInput: Float64Array | null, count: number): void {
    if (!strikeInput && !cascadeInput && !this.active) return;
    if (count > this.strikeWork.length) {
      this.strikeWork = new Float64Array(count);
      this.cascadeWork = new Float64Array(count);
    }
    // Difference each input: x[n] - x[n-2]. An input that has just stopped still has two samples to hand over.
    let strike: Float64Array | null = null;
    if (strikeInput || this.strikeBefore !== 0 || this.strikeBeforeThat !== 0) {
      strike = this.strikeWork;
      let before = this.strikeBefore;
      let beforeThat = this.strikeBeforeThat;
      for (let i = 0; i < count; i++) {
        const x = strikeInput ? strikeInput[i] : 0;
        strike[i] = x - beforeThat;
        beforeThat = before;
        before = x;
      }
      this.strikeBefore = before;
      this.strikeBeforeThat = beforeThat;
    }
    let cascade: Float64Array | null = null;
    if (cascadeInput || this.cascadeBefore !== 0 || this.cascadeBeforeThat !== 0) {
      cascade = this.cascadeWork;
      let before = this.cascadeBefore;
      let beforeThat = this.cascadeBeforeThat;
      for (let i = 0; i < count; i++) {
        const x = cascadeInput ? cascadeInput[i] : 0;
        cascade[i] = x - beforeThat;
        beforeThat = before;
        before = x;
      }
      this.cascadeBefore = before;
      this.cascadeBeforeThat = beforeThat;
    }
    const { a1, a2, y1, y2, strikeGain, cascadeGain } = this;
    const modes = this.count;
    for (let m = 0; m < modes; m++) {
      const c1 = a1[m];
      const c2 = a2[m];
      let s1 = y1[m];
      let s2 = y2[m];
      if (strike && cascade) {
        const gs = strikeGain[m];
        const gc = cascadeGain[m];
        for (let i = 0; i < count; i++) {
          const y = c1 * s1 - c2 * s2 + gs * strike[i] + gc * cascade[i];
          s2 = s1;
          s1 = y;
          out[i] += y;
        }
      } else if (strike || cascade) {
        const input = (strike ?? cascade)!;
        const g = strike ? strikeGain[m] : cascadeGain[m];
        for (let i = 0; i < count; i++) {
          const y = c1 * s1 - c2 * s2 + g * input[i];
          s2 = s1;
          s1 = y;
          out[i] += y;
        }
      } else {
        // a mode that has stopped has nothing to add
        if (s1 === 0 && s2 === 0) continue;
        for (let i = 0; i < count; i++) {
          const y = c1 * s1 - c2 * s2;
          s2 = s1;
          s1 = y;
          out[i] += y;
        }
      }
      y1[m] = s1;
      y2[m] = s2;
    }
    this.active = true;
  }

  /**
   * Housekeeping, for the caller to run now and then while no input is
   * arriving: zero any mode that has all but stopped, and go to sleep when
   * all have. Returns the largest value still held.
   */
  settle(): number {
    const { y1, y2 } = this;
    let largest = 0;
    for (let m = 0; m < this.count; m++) {
      const magnitude = Math.max(Math.abs(y1[m]), Math.abs(y2[m]));
      if (magnitude < FLUSH_LEVEL) {
        y1[m] = 0;
        y2[m] = 0;
      } else if (magnitude > largest) {
        largest = magnitude;
      }
    }
    if (largest === 0) this.active = false;
    return largest;
  }

  /** Stop at once and zero the memory. */
  sleep(): void {
    this.y1.fill(0);
    this.y2.fill(0);
    this.strikeBefore = this.strikeBeforeThat = this.cascadeBefore = this.cascadeBeforeThat = 0;
    this.strikeWork.fill(0);
    this.cascadeWork.fill(0);
    this.active = false;
  }

  /** Every number the bank remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void {
    this.y1.forEach(visit);
    this.y2.forEach(visit);
    [this.strikeBefore, this.strikeBeforeThat, this.cascadeBefore, this.cascadeBeforeThat].forEach(visit);
  }
}

/**
 * Mode frequencies for a plate: `count` of them from `lowHz` to `highHz`,
 * evenly spread on a logarithmic scale and then each moved by a repeatable
 * random amount, so that no two cymbals share a set and none of them forms a
 * harmonic series (which would give the cymbal a note). `seed` picks the set.
 */
export function plateModeFrequencies(count: number, lowHz: number, highHz: number, seed: number, jitter = 0.4): number[] {
  const frequencies: number[] = [];
  let state = (seed >>> 0) || 1;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const span = Math.log(highHz / lowHz);
  for (let k = 0; k < count; k++) {
    const position = (k + 0.5 + jitter * (next() * 2 - 1)) / count;
    frequencies.push(lowHz * Math.exp(span * position));
  }
  return frequencies;
}
