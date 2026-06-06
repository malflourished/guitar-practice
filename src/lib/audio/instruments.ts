/**
 * Curated CC0 guitar sample packs (Tier 2).
 *
 * Sources:
 * - Steel acoustic: Discord SFZ GM Bank (Jeff Learman / Martin samples)
 * - Nylon classical: FreePats Spanish Classical Guitar
 * - Electric variants: FreePats FSBS Fender samples (clean, jazz, dist)
 *
 * Samples are loaded from jsDelivr GitHub CDN — no assets bundled in the repo.
 */

export const GUITAR_INSTRUMENTS = [
  { name: 'acoustic_guitar_steel', label: 'Acoustic (Steel)' },
  { name: 'acoustic_guitar_nylon', label: 'Acoustic (Nylon)' },
  { name: 'electric_guitar_clean', label: 'Electric (Clean)' },
  { name: 'electric_guitar_jazz', label: 'Electric (Jazz)' },
  { name: 'electric_guitar_muted', label: 'Electric (Muted)' },
  { name: 'overdriven_guitar', label: 'Overdriven' },
  { name: 'distortion_guitar', label: 'Distortion' },
] as const;

export type GuitarInstrumentName = (typeof GUITAR_INSTRUMENTS)[number]['name'];

export const DEFAULT_INSTRUMENT: GuitarInstrumentName = 'acoustic_guitar_steel';

export interface InstrumentSampleConfig {
  baseUrl: string;
  /** Note name → sample filename (Tone.Sampler repitches between mapped notes). */
  urls: Record<string, string>;
  release: number;
  reverbWet: number;
}

const JSDELIVR = 'https://cdn.jsdelivr.net/gh';

const DISCORD_STEEL_BASE =
  `${JSDELIVR}/sfzinstruments/Discord-SFZ-GM-Bank@master/` +
  'Discord%20GM/Melodic/026-Acoustic%20Guitar%20(steel)/';

/** Discord SFZ GM steel — minor-third sampling, E2–B5. */
const STEEL_URLS: Record<string, string> = {
  E2: 'MartinGM2_040__E2_1.wav',
  G2: 'MartinGM2_043__G2_1.wav',
  'A#2': 'MartinGM2_046_Bb2_1.wav',
  'C#3': 'MartinGM2_049_Db3_1.wav',
  E3: 'MartinGM2_052__E3_1.wav',
  G3: 'MartinGM2_055__G3_1.wav',
  'A#3': 'MartinGM2_058_Bb3_1.wav',
  'C#4': 'MartinGM2_061_Db4_1.wav',
  E4: 'MartinGM2_064__E4_1.wav',
  'G#4': 'MartinGM2_068_Ab4_1.wav',
  B4: 'MartinGM2_071__B4_1.wav',
  D5: 'MartinGM2_074__D5_1.wav',
  F5: 'MartinGM2_077__F5_1.wav',
  'G#5': 'MartinGM2_080_Ab5_1.wav',
  B5: 'MartinGM2_083__B5_1.wav',
};

const NYLON_BASE = `${JSDELIVR}/freepats/spanish-classical-guitar@main/samples/`;

/** FreePats nylon — sparse whole-step/minor-third coverage across the neck. */
const NYLON_URLS: Record<string, string> = {
  E2: 'E2.flac',
  G2: 'G2.flac',
  B2: 'B2.flac',
  D3: 'D3.flac',
  E3: 'E3.flac',
  G3: 'G3.flac',
  B3: 'B3.flac',
  D4: 'D4.flac',
  E4: 'E4.flac',
  G4: 'G4.flac',
  B4: 'B4.flac',
  D5: 'D5.flac',
  E5: 'E5.flac',
  G5: 'G5.flac',
  A5: 'A5.flac',
};

function freepatsElectric(
  repo: string,
  files: Record<string, string>,
): InstrumentSampleConfig {
  return {
    baseUrl: `${JSDELIVR}/freepats/${repo}@main/samples/`,
    urls: files,
    release: 1.4,
    reverbWet: 0.2,
  };
}

function electricUrls(ext: 'flac' | 'wav'): Record<string, string> {
  return {
    E2: `E2_s1_01.${ext}`,
    F2: `F2_s1_01.${ext}`,
    A2: `A2_s2_01.${ext}`,
    C2: `C2_s1_01.${ext}`,
    C3: `C3_s2_01.${ext}`,
    D3: `D3_s3_01.${ext}`,
    E3: `E3_s3_01.${ext}`,
    G3: `G3_s4_01.${ext}`,
    B3: `B3_s5_01.${ext}`,
    'C#4': `C#4_s5_01.${ext}`,
    E4: `E4_s6_01.${ext}`,
    G4: `G4_s6_01.${ext}`,
    B4: `B4_s6_01.${ext}`,
    'A#5': `A#5_s6_01.${ext}`,
    C5: `C5_s6_01.${ext}`,
    D5: `D5_s6_01.${ext}`,
    F5: `F5_s6_01.${ext}`,
    'G#5': `G#5_s6_01.${ext}`,
    'C#6': `C#6_s6_01.${ext}`,
  };
}

/** Softer velocity layer — used for the muted preset. */
const MUTED_URLS: Record<string, string> = {
  E2: 'E2_s1_soft_01.flac',
  F2: 'F2_s1_soft_01.flac',
  A2: 'A2_s2_soft_01.flac',
  C2: 'C2_s1_soft_01.flac',
  C3: 'C3_s2_soft_01.flac',
  D3: 'D3_s3_soft_01.flac',
  E3: 'E3_s3_soft_01.flac',
  G3: 'G3_s4_soft_01.flac',
  B3: 'B3_s5_soft_01.flac',
  'C#4': 'C#4_s5_soft_01.flac',
  E4: 'E4_s6_soft_01.flac',
  C5: 'C5_s6_soft_01.flac',
  D5: 'D5_s6_soft_01.flac',
};

export const INSTRUMENT_SAMPLES: Record<GuitarInstrumentName, InstrumentSampleConfig> = {
  acoustic_guitar_steel: {
    baseUrl: DISCORD_STEEL_BASE,
    urls: STEEL_URLS,
    release: 1.6,
    reverbWet: 0.22,
  },
  acoustic_guitar_nylon: {
    baseUrl: NYLON_BASE,
    urls: NYLON_URLS,
    release: 1.8,
    reverbWet: 0.25,
  },
  electric_guitar_clean: freepatsElectric('e-guitar-FSBS-clean', electricUrls('flac')),
  electric_guitar_jazz: freepatsElectric('e-guitar-FSBS-jazz', electricUrls('wav')),
  electric_guitar_muted: {
    baseUrl: `${JSDELIVR}/freepats/e-guitar-FSBS-clean@main/samples/`,
    urls: MUTED_URLS,
    release: 0.35,
    reverbWet: 0.12,
  },
  overdriven_guitar: freepatsElectric('e-guitar-FSBS-dist1', electricUrls('flac')),
  distortion_guitar: freepatsElectric('e-guitar-FSBS-dist2', electricUrls('flac')),
};
