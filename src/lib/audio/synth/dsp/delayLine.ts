/**
 * A circular delay line with fractional reads: the memory that stands for a
 * wave travelling along a string (or through a chorus, or round a rotating
 * speaker). `read(k)` returns what was written k writes ago, so `read(1)` is
 * the newest sample.
 *
 * Fractional delays use third-order Lagrange interpolation (Laakso et al.,
 * "Splitting the unit delay", 1996): four neighbouring samples, exact for
 * anything up to a cubic, and safe to sweep while sound is running.
 */
export class DelayLine {
  readonly buffer: Float64Array;
  readonly mask: number;
  /** Where the next write goes. */
  index = 0;

  /** Holds delays up to `maxDelay` samples. */
  constructor(maxDelay: number) {
    let size = 8;
    while (size < maxDelay + 4) size *= 2;
    this.buffer = new Float64Array(size);
    this.mask = size - 1;
  }

  write(value: number): void {
    this.buffer[this.index] = value;
    this.index = (this.index + 1) & this.mask;
  }

  /** The sample written `delay` writes ago, for a whole number of samples (1 is the newest). */
  read(delay: number): number {
    return this.buffer[(this.index - delay) & this.mask];
  }

  /** Linear interpolation between the two nearest samples. `delay` is at least 1. */
  readLinear(delay: number): number {
    const whole = Math.floor(delay);
    const fraction = delay - whole;
    const a = this.buffer[(this.index - whole) & this.mask];
    const b = this.buffer[(this.index - whole - 1) & this.mask];
    return a + fraction * (b - a);
  }

  /** Third-order Lagrange interpolation. `delay` is at least 2. */
  readLagrange(delay: number): number {
    const whole = Math.floor(delay);
    const d = delay - whole;
    const { buffer, mask } = this;
    const base = this.index - whole;
    return (
      lagrangeBefore(d) * buffer[(base + 1) & mask] +
      lagrangeAt(d) * buffer[base & mask] +
      lagrangeNext(d) * buffer[(base - 1) & mask] +
      lagrangeAfter(d) * buffer[(base - 2) & mask]
    );
  }

  clear(): void {
    this.buffer.fill(0);
    this.index = 0;
  }
}

/*
 * The four weights of third-order Lagrange interpolation for a point a
 * fraction `d` (0 to 1) of the way from one sample to the next: the sample
 * before the pair, the pair itself, and the sample after.
 */
export function lagrangeBefore(d: number): number {
  return (-d * (d - 1) * (d - 2)) / 6;
}
export function lagrangeAt(d: number): number {
  return ((d + 1) * (d - 1) * (d - 2)) / 2;
}
export function lagrangeNext(d: number): number {
  return (-(d + 1) * d * (d - 2)) / 2;
}
export function lagrangeAfter(d: number): number {
  return ((d + 1) * d * (d - 1)) / 6;
}
