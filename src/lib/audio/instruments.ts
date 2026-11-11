import manifest from './sampleMap.json';

export const GUITAR_INSTRUMENTS = [
  { name: 'acoustic_guitar_steel', label: 'Steel acoustic' },
  { name: 'acoustic_guitar_nylon', label: 'Nylon acoustic' },
  { name: 'electric_guitar_clean', label: 'Warm electric' },
] as const;
export type GuitarInstrumentName = (typeof GUITAR_INSTRUMENTS)[number]['name'];
export const DEFAULT_INSTRUMENT: GuitarInstrumentName = 'acoustic_guitar_steel';
export interface GuitarSample {
  midi: number;
  string?: number;
  layer: string;
  file: string;
}
export const INSTRUMENT_SAMPLES: Record<GuitarInstrumentName, { samples: GuitarSample[]; cutoff: number; release: number; gain: number }> = {
  acoustic_guitar_steel: { samples: manifest.filter(s => s.bank === 'steel'), cutoff: 9500, release: 0.16, gain: 1 },
  // Match the first-second RMS of the acoustic reference, preserving dynamics within each bank.
  acoustic_guitar_nylon: { samples: manifest.filter(s => s.bank === 'nylon'), cutoff: 7000, release: 0.22, gain: 0.44 },
  electric_guitar_clean: { samples: manifest.filter(s => s.bank === 'clean'), cutoff: 5200, release: 0.13, gain: 0.44 },
};

/** Prefer the played string when a nearby recording exists; never transpose far just to match it. */
export function chooseSample(samples: GuitarSample[], midi: number, string: number | undefined, velocity: number, take: number): GuitarSample {
  const layer = velocity < 0.6 && samples.some(s => s.layer === 'soft') ? 'soft' : 'normal';
  const pool = samples.filter(s => s.layer === layer);
  const distance = (sample: GuitarSample) => Math.abs(sample.midi - midi)
    + (string !== undefined && sample.string !== undefined && string !== sample.string ? 2 : 0);
  const best = Math.min(...pool.map(distance));
  const candidates = pool.filter(s => distance(s) === best);
  return candidates[take % candidates.length];
}
