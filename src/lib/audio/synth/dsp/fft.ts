/**
 * A fast Fourier transform: a sound as the levels of its frequencies, and
 * back. Used off the audio path only: to build a cymbal's table of partials
 * when a kit is made (`drums/metalTable.ts`), and to measure rendered sounds.
 */

/**
 * Transform `re` and `im` in place. Their length must be a power of two.
 * `inverse` goes from frequencies back to samples, without dividing by the
 * length: the caller scales.
 */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n < 2 || (n & (n - 1)) !== 0 || im.length !== n) throw new Error('fft: the length must be a power of two');
  // Put the samples in bit-reversed order.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i];
      re[i] = re[j];
      re[j] = r;
      const m = im[i];
      im[i] = im[j];
      im[j] = m;
    }
  }
  // Combine pairs, then fours, then eights...
  for (let size = 2; size <= n; size *= 2) {
    const half = size >> 1;
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const stepRe = Math.cos(angle);
    const stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let turnRe = 1;
      let turnIm = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const br = re[b] * turnRe - im[b] * turnIm;
        const bi = re[b] * turnIm + im[b] * turnRe;
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
        const next = turnRe * stepRe - turnIm * stepIm;
        turnIm = turnRe * stepIm + turnIm * stepRe;
        turnRe = next;
      }
    }
  }
}

/** The smallest power of two that is at least `length`. */
export function powerOfTwoAtLeast(length: number): number {
  let size = 1;
  while (size < length) size *= 2;
  return size;
}

/**
 * The power in each frequency bin of `samples[from..to)`, with a raised-cosine
 * window when `windowed`. Bin `k` is at `k * sampleRate / size` hertz, and
 * the result has `size / 2` bins.
 */
export function powerSpectrum(samples: ArrayLike<number>, from: number, to: number, windowed = true): Float64Array {
  const length = Math.max(0, Math.min(samples.length, to) - from);
  const size = powerOfTwoAtLeast(Math.max(2, length));
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < length; i++) {
    const window = windowed ? 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / length) : 1;
    re[i] = samples[from + i] * window;
  }
  fft(re, im);
  const power = new Float64Array(size >> 1);
  for (let k = 0; k < power.length; k++) power[k] = re[k] * re[k] + im[k] * im[k];
  return power;
}
