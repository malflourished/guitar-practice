import type {
  ChordQuality,
  KeyMode,
  NoteName,
  ProgressionDef,
  ProgressionStepDef,
  StudyMode,
} from '../../types/music';
import { getDiatonicRoot } from './diatonic';
import { formatNoteDisplay, type NotationPreference } from './notes';
import { getChordQualityLabel } from './chords';

const CHORD_SUFFIX: Partial<Record<ChordQuality, string>> = {
  major: '',
  minor: 'm',
  dim: 'dim',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  m7b5: 'm7♭5',
};

export interface ResolvedProgressionStep {
  root: NoteName;
  quality: ChordQuality;
  numeral: string;
  chordName: string;
  qualityLabel: string;
}

export const PROGRESSIONS: ProgressionDef[] = [
  {
    id: 'blues-145',
    label: 'I – IV – V',
    nickname: 'Blues / Rock',
    keyMode: 'major',
    category: 'Foundations',
    steps: [
      { degree: 1, quality: 'major', numeral: 'I' },
      { degree: 4, quality: 'major', numeral: 'IV' },
      { degree: 5, quality: 'major', numeral: 'V' },
    ],
    theory: {
      title: 'I – IV – V',
      summary:
        'The backbone of blues, rock, and folk — home, lift, tension, then resolve.',
      body: [
        'This is perhaps the most fundamental harmonic loop in Western music. The I chord is home — stable and resolved. IV lifts you away from home without creating urgent tension. V is the dominant: it craves resolution back to I.',
        'Because it uses only the three major chords of a key, it is easy to play in any key once you know the shapes. In C major: C – F – G. In G major: G – C – D.',
      ],
      examples: [
        { label: 'C major', chords: 'C – F – G' },
        { label: 'G major', chords: 'G – C – D' },
        { label: 'A major', chords: 'A – D – E' },
      ],
      functions: [
        { numeral: 'I', role: 'Tonic — home base, feels resolved' },
        { numeral: 'IV', role: 'Subdominant — lifts away from home' },
        { numeral: 'V', role: 'Dominant — tension that wants to resolve to I' },
      ],
    },
  },
  {
    id: 'doo-wop',
    label: 'I – vi – IV – V',
    nickname: '50s / Doo-Wop',
    keyMode: 'major',
    category: 'Foundations',
    steps: [
      { degree: 1, quality: 'major', numeral: 'I' },
      { degree: 6, quality: 'minor', numeral: 'vi' },
      { degree: 4, quality: 'major', numeral: 'IV' },
      { degree: 5, quality: 'major', numeral: 'V' },
    ],
    theory: {
      title: 'I – vi – IV – V',
      summary:
        'The classic "50s progression" — bright major chords with a touch of melancholy on vi.',
      body: [
        'Common in doo-wop, early rock, and countless ballads. The vi chord (relative minor) adds emotional color without leaving the major key.',
        'The V at the end creates a gentle pull back to I when the loop repeats. Think of it as: home, wistful, lift, tension.',
      ],
      examples: [
        { label: 'C major', chords: 'C – Am – F – G' },
        { label: 'G major', chords: 'G – Em – C – D' },
      ],
      functions: [
        { numeral: 'I', role: 'Tonic — stable opening' },
        { numeral: 'vi', role: 'Relative minor — emotional color' },
        { numeral: 'IV', role: 'Subdominant — forward motion' },
        { numeral: 'V', role: 'Dominant — leads back to I' },
      ],
    },
  },
  {
    id: 'pop-1564',
    label: 'I – V – vi – IV',
    nickname: 'Pop Progression',
    keyMode: 'major',
    category: 'Pop & Rock',
    steps: [
      { degree: 1, quality: 'major', numeral: 'I' },
      { degree: 5, quality: 'major', numeral: 'V' },
      { degree: 6, quality: 'minor', numeral: 'vi' },
      { degree: 4, quality: 'major', numeral: 'IV' },
    ],
    theory: {
      title: 'I – V – vi – IV',
      summary:
        'The modern pop loop — stable, yearning, and endlessly repeatable.',
      body: [
        'This progression appears in countless contemporary songs. It balances major stability (I, IV, V) with the emotional pull of vi.',
        'Roman numerals let you transpose instantly: learn the shape once, then apply it in any key. The loop feels both settled and searching.',
      ],
      examples: [
        { label: 'C major', chords: 'C – G – Am – F' },
        { label: 'G major', chords: 'G – D – Em – C' },
        { label: 'D major', chords: 'D – A – Bm – G' },
      ],
      functions: [
        { numeral: 'I', role: 'Tonic — home' },
        { numeral: 'V', role: 'Dominant — brief tension' },
        { numeral: 'vi', role: 'Relative minor — emotional depth' },
        { numeral: 'IV', role: 'Subdominant — open, lifting feel' },
      ],
    },
  },
  {
    id: 'axis',
    label: 'vi – IV – I – V',
    nickname: 'Axis Rotation',
    keyMode: 'major',
    category: 'Pop & Rock',
    steps: [
      { degree: 6, quality: 'minor', numeral: 'vi' },
      { degree: 4, quality: 'major', numeral: 'IV' },
      { degree: 1, quality: 'major', numeral: 'I' },
      { degree: 5, quality: 'major', numeral: 'V' },
    ],
    theory: {
      title: 'vi – IV – I – V',
      summary:
        'Same chords as the pop progression, rotated to start on vi — more introspective.',
      body: [
        'This is the I – V – vi – IV loop starting from a different point. Beginning on vi gives a more melancholic, reflective opening before arriving at the bright I chord.',
        'Useful when you want the emotional color of minor upfront while staying in a major key.',
      ],
      examples: [{ label: 'C major', chords: 'Am – F – C – G' }],
      functions: [
        { numeral: 'vi', role: 'Relative minor — introspective start' },
        { numeral: 'IV', role: 'Subdominant — opens up' },
        { numeral: 'I', role: 'Tonic — arrival, brightness' },
        { numeral: 'V', role: 'Dominant — pulls the loop forward' },
      ],
    },
  },
  {
    id: 'rock-1465',
    label: 'I – IV – vi – V',
    nickname: 'Driving Rock',
    keyMode: 'major',
    category: 'Pop & Rock',
    steps: [
      { degree: 1, quality: 'major', numeral: 'I' },
      { degree: 4, quality: 'major', numeral: 'IV' },
      { degree: 6, quality: 'minor', numeral: 'vi' },
      { degree: 5, quality: 'major', numeral: 'V' },
    ],
    theory: {
      title: 'I – IV – vi – V',
      summary:
        'A propulsive rock and pop loop — major lift, minor color, then dominant drive.',
      body: [
        'The shift from bright major chords (I, IV) into vi and then V creates momentum. The V chord at the end pushes strongly into the next I when looping.',
        'Common in anthemic rock and driving pop songs where you want energy without complex harmony.',
      ],
      examples: [{ label: 'C major', chords: 'C – F – Am – G' }],
      functions: [
        { numeral: 'I', role: 'Tonic — launch point' },
        { numeral: 'IV', role: 'Subdominant — lift' },
        { numeral: 'vi', role: 'Relative minor — contrast' },
        { numeral: 'V', role: 'Dominant — driving tension' },
      ],
    },
  },
  {
    id: 'jazz-251',
    label: 'ii – V – I',
    nickname: 'Jazz Cadence',
    keyMode: 'major',
    category: 'Jazz',
    steps: [
      { degree: 2, quality: 'min7', numeral: 'ii⁷' },
      { degree: 5, quality: 'dom7', numeral: 'V⁷' },
      { degree: 1, quality: 'maj7', numeral: 'I maj7' },
    ],
    theory: {
      title: 'ii – V – I',
      summary:
        'The essential jazz cadence — pre-dominant, dominant, then home.',
      body: [
        'ii – V – I is the harmonic engine of jazz standards. The ii chord (minor 7) sets up the V (dominant 7), which resolves to I (major 7).',
        'Seventh chords add color and voice-leading opportunities. Once you can play this in one key, transpose the same shapes to any other.',
      ],
      examples: [{ label: 'C major', chords: 'Dm7 – G7 – Cmaj7' }],
      functions: [
        { numeral: 'ii⁷', role: 'Pre-dominant — sets up the V' },
        { numeral: 'V⁷', role: 'Dominant — strong pull to I' },
        { numeral: 'I maj7', role: 'Tonic — resolved, colorful home' },
      ],
    },
  },
  {
    id: 'minor-145',
    label: 'i – iv – V',
    nickname: 'Minor Folk / Rock',
    keyMode: 'minor',
    category: 'Minor Key',
    steps: [
      { degree: 1, quality: 'minor', numeral: 'i' },
      { degree: 4, quality: 'minor', numeral: 'iv' },
      { degree: 5, quality: 'major', numeral: 'V' },
    ],
    theory: {
      title: 'i – iv – V',
      summary:
        'A classic minor-key loop — the V is major (from harmonic minor) for a stronger pull home.',
      body: [
        'In natural minor, the v chord is minor and feels softer. Raising it to a major V (the "harmonic minor" sound) creates a much stronger resolution back to i.',
        'This pattern is common in folk, rock, and flamenco-influenced music. Practice the i and iv as minor shapes, then the bright major V for contrast.',
      ],
      examples: [{ label: 'A minor', chords: 'Am – Dm – E' }],
      functions: [
        { numeral: 'i', role: 'Tonic — minor home' },
        { numeral: 'iv', role: 'Subdominant — dark lift' },
        { numeral: 'V', role: 'Major dominant — strong resolution to i' },
      ],
    },
  },
  {
    id: 'minor-6415',
    label: 'i – VI – IV – V',
    nickname: 'Epic Minor',
    keyMode: 'minor',
    category: 'Minor Key',
    steps: [
      { degree: 1, quality: 'minor', numeral: 'i' },
      { degree: 6, quality: 'major', numeral: 'VI' },
      { degree: 4, quality: 'minor', numeral: 'iv' },
      { degree: 5, quality: 'major', numeral: 'V' },
    ],
    theory: {
      title: 'i – VI – IV – V',
      summary:
        'An emotional minor-key arc — borrowed major brightness, then resolution.',
      body: [
        'The VI chord (major) in a minor key provides a dramatic lift — it is borrowed from the relative major scale. Combined with iv and the major V, this creates an epic, cinematic feel.',
        'Also related to the "Andalusian cadence" family of progressions heard in flamenco and rock ballads.',
      ],
      examples: [{ label: 'A minor', chords: 'Am – F – Dm – E' }],
      functions: [
        { numeral: 'i', role: 'Tonic — minor home' },
        { numeral: 'VI', role: 'Borrowed major — dramatic lift' },
        { numeral: 'IV', role: 'Subdominant minor — descent' },
        { numeral: 'V', role: 'Major dominant — resolution' },
      ],
    },
  },
];

export const PROGRESSION_GROUPS = [
  ...new Set(PROGRESSIONS.map((p) => p.category)),
].map((category) => ({
  label: category,
  progressions: PROGRESSIONS.filter((p) => p.category === category),
}));

export function getProgressionById(id: string): ProgressionDef | undefined {
  return PROGRESSIONS.find((p) => p.id === id);
}

/** Position-slider scope for one chord within a progression. */
export function getProgressionStepPositionScope(
  progressionId: string,
  stepIndex: number,
  quality: ChordQuality,
): string {
  const qualityKey = `${progressionId}-${stepIndex}-${quality}`;
  const studyMode: StudyMode = 'progressions';
  return `${studyMode}-${qualityKey}-fixed`;
}

export function formatChordName(
  root: NoteName,
  quality: ChordQuality,
  notation: NotationPreference,
): string {
  const rootLabel = formatNoteDisplay(root, notation);
  const suffix = CHORD_SUFFIX[quality];
  if (suffix !== undefined) {
    return `${rootLabel}${suffix}`;
  }
  return `${rootLabel} (${getChordQualityLabel(quality)})`;
}

export function resolveProgressionStep(
  keyRoot: NoteName,
  keyMode: KeyMode,
  step: ProgressionStepDef,
  notation: NotationPreference,
): ResolvedProgressionStep {
  const root = getDiatonicRoot(keyRoot, keyMode, step.degree);
  const chordName = formatChordName(root, step.quality, notation);
  return {
    root,
    quality: step.quality,
    numeral: step.numeral,
    chordName,
    qualityLabel: getChordQualityLabel(step.quality),
  };
}

export function resolveProgression(
  keyRoot: NoteName,
  progression: ProgressionDef,
  notation: NotationPreference,
): ResolvedProgressionStep[] {
  return progression.steps.map((step) =>
    resolveProgressionStep(keyRoot, progression.keyMode, step, notation),
  );
}

export function formatProgressionChords(
  resolved: ResolvedProgressionStep[],
): string {
  return resolved.map((step) => step.chordName).join(' – ');
}
