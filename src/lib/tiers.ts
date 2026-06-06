import type { ChordQuality, ScaleQuality, StudyMode, Tier } from '../types/music';
import { CHORD_QUALITIES, SCALE_QUALITIES } from './music';

interface TierConfig {
  label: string;
  studyModes: StudyMode[];
  chordQualities: ChordQuality[];
  /** Scale types unlocked at this tier. */
  scaleQualities: ScaleQuality[];
}

export const TIER_ORDER: Tier[] = ['basic', 'intermediate', 'advanced'];

const INTERMEDIATE_CHORDS: ChordQuality[] = [
  'major',
  'minor',
  'sus2',
  'sus4',
  'dim',
  'aug',
  'maj6',
  'min6',
  'maj7',
  'dom7',
  'min7',
  'm7b5',
  'dim7',
];

const PENTATONIC_SCALES: ScaleQuality[] = ['majorPentatonic', 'minorPentatonic'];
const INTERMEDIATE_SCALES: ScaleQuality[] = [...PENTATONIC_SCALES, 'major', 'minor'];

export const TIERS: Record<Tier, TierConfig> = {
  basic: {
    label: 'Basic',
    studyModes: ['notes', 'chords', 'scales'],
    chordQualities: ['major', 'minor'],
    scaleQualities: PENTATONIC_SCALES,
  },
  intermediate: {
    label: 'Intermediate',
    studyModes: ['notes', 'chords', 'scales', 'arpeggios'],
    chordQualities: INTERMEDIATE_CHORDS,
    scaleQualities: INTERMEDIATE_SCALES,
  },
  advanced: {
    label: 'Advanced',
    studyModes: ['notes', 'chords', 'scales', 'arpeggios'],
    chordQualities: CHORD_QUALITIES,
    scaleQualities: SCALE_QUALITIES,
  },
};

export function isValidTier(value: unknown): value is Tier {
  return value === 'basic' || value === 'intermediate' || value === 'advanced';
}
