/**
 * A small seeded random source (Marsaglia's 32-bit xorshift), so that the
 * note-to-note variation of a modelled instrument is the same on every run
 * and tests can rely on it.
 */
export class Random {
  private state: number;

  constructor(seed = 0x2545f491) {
    this.state = seed >>> 0 || 0x2545f491;
  }

  /** Uniform in [0, 1). */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  /** Uniform in [-1, 1). */
  bipolar(): number {
    return this.next() * 2 - 1;
  }

  /**
   * A new source that runs on independently of this one. Give one to each
   * part of an instrument that draws numbers at its own pace (each noise
   * generator, say), so that what one part draws never depends on how often
   * another did, or on how the caller slices its blocks.
   */
  fork(): Random {
    return new Random((this.next() * 4294967296) >>> 0);
  }
}
