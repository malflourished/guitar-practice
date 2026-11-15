/**
 * A cymbal's partials, written out once as tables.
 *
 * A cymbal has a mode every dozen hertz: over a thousand in the hearing
 * range (docs/sound/drums.md). A bank of resonators that size costs far too
 * much to run for every sample, and thirty resonators sound like bells. So
 * the partials are added up once, when a kit is made, into a few seconds of
 * sound that loops without a seam: every partial sits on a whole number of
 * cycles of the table. The partials are split into bands by frequency, one
 * table a band, and the cymbal that plays them (`bandedMetal.ts`) only has to
 * set each band's level from moment to moment.
 *
 * The adding up is one inverse Fourier transform for every two bands, a few
 * milliseconds each. The tables are our own arithmetic: nothing is recorded.
 */
import { fft, powerOfTwoAtLeast } from '../dsp/fft';
import { Random } from '../dsp/random';

export interface MetalRecipe {
  /** Names the cymbal. Tables are built once for each name and sample rate. */
  name: string;
  /** Picks the partials: another seed is another cymbal of the same make. */
  seed: number;
  /** The edges of the bands, in hertz, low to high: one table between each two. */
  edges: readonly number[];
  /** The average distance from one partial to the next, in hertz. */
  spacingHz: number;
  /** The least the table may last, in seconds. It is rounded up to a power of two samples. */
  seconds: number;
}

export interface MetalTables {
  /** Samples in each table: a power of two. */
  size: number;
  /** One table for each band, each at an RMS level of 1. */
  bands: Float32Array[];
}

/** Each partial's power falls with frequency inside a band by this many decibels an octave. */
const TILT_DB_PER_OCTAVE = 3;
/** Near a band's edge a partial may fall on either side: the edge is this wide, as a share of its frequency. */
const EDGE_WIDTH = 0.08;
/** No partial above this share of the sample rate. */
const TOP = 0.45;

const cache = new Map<string, MetalTables>();

const cacheKey = (recipe: MetalRecipe, sampleRate: number) => `${recipe.name}:${recipe.seed}:${sampleRate}`;

/** The tables for a cymbal at a sample rate: built the first time, kept after. */
export function metalTables(recipe: MetalRecipe, sampleRate: number): MetalTables {
  const key = cacheKey(recipe, sampleRate);
  let tables = cache.get(key);
  if (!tables) {
    tables = buildMetalTables(recipe, sampleRate);
    cache.set(key, tables);
  }
  return tables;
}

/**
 * Hand over tables that were built somewhere else: the page builds them and
 * sends them to the audio thread, so the audio thread never stops to do it.
 * Tables of the wrong shape are ignored, and the thread builds its own.
 */
export function primeMetalTables(recipe: MetalRecipe, sampleRate: number, bands: readonly Float32Array[]): void {
  const size = bands[0]?.length ?? 0;
  const wanted = powerOfTwoAtLeast(Math.ceil(recipe.seconds * sampleRate));
  if (bands.length !== recipe.edges.length - 1 || size !== wanted || bands.some((band) => band.length !== size)) return;
  cache.set(cacheKey(recipe, sampleRate), { size, bands: [...bands] });
}

/** Add up a cymbal's partials into one looping table for each band. */
export function buildMetalTables(recipe: MetalRecipe, sampleRate: number): MetalTables {
  const size = powerOfTwoAtLeast(Math.ceil(recipe.seconds * sampleRate));
  const bandCount = recipe.edges.length - 1;
  const random = new Random(recipe.seed);
  const top = Math.min(recipe.edges[bandCount], sampleRate * TOP);

  // Choose the partials: where each is, which band it belongs to, how strong, and where in its cycle it starts.
  const bins: number[][] = Array.from({ length: bandCount }, () => []);
  const real: number[][] = Array.from({ length: bandCount }, () => []);
  const imaginary: number[][] = Array.from({ length: bandCount }, () => []);
  let hz = recipe.edges[0];
  for (;;) {
    hz += recipe.spacingHz * (0.3 + 1.4 * random.next());
    // every draw is made whether or not the partial is kept, so the cymbal is the same at any sample rate
    const side = random.next();
    const power = -Math.log(1 - random.next());
    const phase = 2 * Math.PI * random.next();
    if (hz >= recipe.edges[bandCount]) break;
    if (hz >= top) continue;
    let band = 0;
    while (band < bandCount - 1 && hz >= recipe.edges[band + 1]) band++;
    // A partial near an edge may go to the neighbouring band, so the bands cross over smoothly.
    const upper = recipe.edges[band + 1];
    const lower = recipe.edges[band];
    if (band < bandCount - 1 && hz > upper * (1 - EDGE_WIDTH) && side < (0.5 * (hz - upper * (1 - EDGE_WIDTH))) / (upper * EDGE_WIDTH)) band++;
    else if (band > 0 && hz < lower * (1 + EDGE_WIDTH) && side < 0.5 - (0.5 * (hz - lower)) / (lower * EDGE_WIDTH)) band--;
    const bin = Math.round((hz * size) / sampleRate);
    if (bin < 1 || bin >= size / 2) continue;
    // A few partials in any stretch are much stronger than the rest, as on real metal.
    const amplitude = Math.sqrt(power * 10 ** ((-TILT_DB_PER_OCTAVE * Math.log2(hz / lower)) / 10));
    bins[band].push(bin);
    real[band].push(amplitude * Math.cos(phase));
    imaginary[band].push(amplitude * Math.sin(phase));
  }

  // Two bands for each transform: one comes out as its real part and the other as its imaginary part.
  const bands: Float32Array[] = [];
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let first = 0; first < bandCount; first += 2) {
    re.fill(0);
    im.fill(0);
    for (let which = 0; which < 2 && first + which < bandCount; which++) {
      const band = first + which;
      for (let p = 0; p < bins[band].length; p++) {
        const bin = bins[band][p];
        const a = real[band][p];
        const b = imaginary[band][p];
        if (which === 0) {
          re[bin] += a;
          im[bin] += b;
          re[size - bin] += a;
          im[size - bin] -= b;
        } else {
          // the same partial, times the square root of minus one
          re[bin] -= b;
          im[bin] += a;
          re[size - bin] += b;
          im[size - bin] += a;
        }
      }
    }
    fft(re, im, true);
    bands.push(normalized(re));
    if (first + 1 < bandCount) bands.push(normalized(im));
  }
  return { size, bands };
}

/** A copy at an RMS level of 1 (or silence, for a band with no partials). */
function normalized(samples: Float64Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const scale = sum > 0 ? 1 / Math.sqrt(sum / samples.length) : 0;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
  return out;
}
