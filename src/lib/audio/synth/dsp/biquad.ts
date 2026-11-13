/**
 * A second-order filter section, with the common shapes from Robert
 * Bristow-Johnson's "Audio EQ Cookbook" formulas. Frequencies are in hertz,
 * so a design sounds the same at any sample rate.
 */
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private z1 = 0;
  private z2 = 0;

  /** Low-pass at `frequency`; `q` above 0.707 adds a resonant peak there. */
  setLowpass(frequency: number, q: number, sampleRate: number): this {
    const { cos, alpha } = prototype(frequency, q, sampleRate);
    const a0 = 1 + alpha;
    this.b0 = (1 - cos) / 2 / a0;
    this.b1 = (1 - cos) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  /** High-pass at `frequency`. */
  setHighpass(frequency: number, q: number, sampleRate: number): this {
    const { cos, alpha } = prototype(frequency, q, sampleRate);
    const a0 = 1 + alpha;
    this.b0 = (1 + cos) / 2 / a0;
    this.b1 = -(1 + cos) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  /** One sample through the filter (transposed direct form II). */
  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  /** Filter a whole buffer in place. */
  processBlock(samples: Float32Array | Float64Array, from = 0, to = samples.length): void {
    const { b0, b1, b2, a1, a2 } = this;
    let { z1, z2 } = this;
    for (let i = from; i < to; i++) {
      const x = samples[i];
      const y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      samples[i] = y;
    }
    this.z1 = z1;
    this.z2 = z2;
  }

  /** The filter's gain at `frequency`, as a plain ratio. */
  gainAt(frequency: number, sampleRate: number): number {
    const w = (2 * Math.PI * frequency) / sampleRate;
    const c1 = Math.cos(w);
    const s1 = Math.sin(w);
    const c2 = Math.cos(2 * w);
    const s2 = Math.sin(2 * w);
    const numerator = Math.hypot(this.b0 + this.b1 * c1 + this.b2 * c2, this.b1 * s1 + this.b2 * s2);
    const denominator = Math.hypot(1 + this.a1 * c1 + this.a2 * c2, this.a1 * s1 + this.a2 * s2);
    return numerator / denominator;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  /** The filter's memory, for checks that nothing has decayed into denormal numbers. */
  state(): [number, number] {
    return [this.z1, this.z2];
  }
}

function prototype(frequency: number, q: number, sampleRate: number) {
  const w = (2 * Math.PI * Math.min(frequency, sampleRate * 0.45)) / sampleRate;
  return { cos: Math.cos(w), alpha: Math.sin(w) / (2 * q) };
}

/**
 * A first-order shelf: unity gain at 0 Hz, turning at `zeroHz` and settling
 * at `poleHz` to a gain of poleHz / zeroHz. Swapping the two frequencies
 * gives its exact inverse, which is how an amplifier model emphasises the
 * treble before its distortion and takes the emphasis off again after it.
 */
export class Shelf {
  private b0 = 1;
  private b1 = 0;
  private a1 = 0;
  private z = 0;

  set(zeroHz: number, poleHz: number, sampleRate: number): this {
    const cz = 1 / Math.tan((Math.PI * zeroHz) / sampleRate);
    const cp = 1 / Math.tan((Math.PI * poleHz) / sampleRate);
    this.b0 = (1 + cz) / (1 + cp);
    this.b1 = (1 - cz) / (1 + cp);
    this.a1 = (1 - cp) / (1 + cp);
    return this;
  }

  process(x: number): number {
    const y = this.b0 * x + this.z;
    this.z = this.b1 * x - this.a1 * y;
    return y;
  }

  reset(): void {
    this.z = 0;
  }

  state(): number {
    return this.z;
  }
}
