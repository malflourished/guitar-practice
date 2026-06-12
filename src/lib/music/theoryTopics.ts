import type { TheoryTopic } from '../../types/music';

export const THEORY_SECTIONS = [
  'The Map',
  'Keys & Scales',
  'Diatonic Harmony',
] as const;

export type TheorySection = (typeof THEORY_SECTIONS)[number];

export const THEORY_TOPICS: TheoryTopic[] = [
  {
    id: 'circle-of-fifths',
    section: 'The Map',
    title: 'Circle of Fifths',
    diagram: 'circle-of-fifths',
    fretboardDemo: { scaleQuality: 'major' },
    practiceLink: { mode: 'scales', scaleQuality: 'major' },
    theory: {
      title: 'Circle of Fifths',
      summary:
        'Every key arranged by perfect fifths — the map for signatures, relatives, and chord families.',
      body: [
        'Move clockwise and each key gains one sharp. Move counter-clockwise and each key gains one flat. C sits at the top with no accidentals.',
        'The inner ring shows each key\'s relative minor — same key signature, different tonal center. Click any key to set the app key and explore it on the fretboard.',
        'On guitar, knowing the circle helps you transpose quickly: the I–IV–V chords of any major key sit three neighbors apart on the outer ring.',
      ],
    },
  },
  {
    id: 'twelve-notes',
    section: 'The Map',
    title: 'The 12 Notes',
    diagram: 'circle-of-fifths',
    theory: {
      title: 'The 12 Notes',
      summary:
        'Western music repeats every 12 semitones — the chromatic scale that every fret on guitar advances through.',
      body: [
        'Each fret moves one semitone up the neck. After 12 frets you return to the same letter name (one octave higher). C and C♯ are adjacent; E and F have no sharp between them, same for B and C.',
        'Enharmonic spelling means one pitch, two names: F♯ and G♭ are the same fret. Use sharps in sharp keys and flats in flat keys — the circle of fifths tells you which.',
      ],
    },
  },
  {
    id: 'half-whole-steps',
    section: 'The Map',
    title: 'Half & Whole Steps',
    fretboardDemo: { scaleQuality: 'major', singleString: true },
    theory: {
      title: 'Half & Whole Steps',
      summary:
        'A half step is one fret; a whole step is two. Every scale is built from this simple pattern.',
      body: [
        'On guitar, a half step (semitone) is one fret. A whole step (tone) is two frets. The major scale formula — W–W–H–W–W–W–H — is just whole and half steps from the root.',
        'Enable "Show on fretboard" to walk the major scale up a single string: every two-fret gap is a whole step, every one-fret gap a half step. The formula stops being abstract when you can see it as distances.',
        'B to C and E to F are the only natural half steps with no sharp/flat between letter names. Every other adjacent natural note pair (C–D, D–E, etc.) is a whole step apart.',
      ],
    },
  },
  {
    id: 'caged-system',
    section: 'The Map',
    title: 'The CAGED System',
    fretboardDemo: { scaleQuality: 'major', neckView: 'full' },
    practiceLink: {
      mode: 'scales',
      scaleQuality: 'majorPentatonic',
      neckView: 'connected',
    },
    theory: {
      title: 'The CAGED System',
      summary:
        'Five overlapping chord shapes — C, A, G, E, D — tile the whole neck. Every scale box wraps around one of them.',
      body: [
        'The five open chords you learn first are also movable templates. Slide them up the neck and they repeat in a fixed order — C, A, G, E, D — until the pattern loops at the 12th fret. Together they cover the fretboard with no gaps.',
        'Each shape carries its own scale pattern and arpeggio. Know where the chord shape sits and you know where the scale notes live around it — that is why the position boxes in Scales mode are labeled with shape letters.',
        'Neighboring shapes overlap: the top of one box is the bottom of the next, and the shared notes (marked with dashed rings in the Linked view) are your pivot points for shifting positions mid-phrase.',
        'Enable "Show on fretboard" to see all five boxes onion-skinned across the neck, then use the practice link to work the connections with the pentatonic.',
      ],
    },
  },
  {
    id: 'major-scale',
    section: 'Keys & Scales',
    title: 'Major Scale',
    diagram: 'circle-of-fifths',
    fretboardDemo: { scaleQuality: 'major' },
    practiceLink: { mode: 'scales', scaleQuality: 'major' },
    theory: {
      title: 'Major Scale',
      summary:
        'W–W–H–W–W–W–H from the root — the reference sound for keys, chords, and modes.',
      body: [
        'The major scale is the baseline for naming everything else: intervals, chord qualities, and Roman numerals all refer back to it.',
        'Pick a key on the circle, then enable "Show on fretboard" to see the major scale in that key. The scale degrees 1 through 7 become the pool for building diatonic chords.',
      ],
    },
  },
  {
    id: 'key-signatures',
    section: 'Keys & Scales',
    title: 'Key Signatures',
    diagram: 'circle-of-fifths',
    theory: {
      title: 'Key Signatures',
      summary:
        'Sharps and flats at the start of a staff — or the accidentals implied by your chosen key on the circle.',
      body: [
        'Each major key has a fixed set of sharps or flats. G major has one sharp (F♯); F major has one flat (B♭). The circle shows the count at a glance.',
        'Order of sharps: F♯ C♯ G♯ D♯ A♯ E♯ B♯. Order of flats is the reverse: B♭ E♭ A♭ D♭ G♭ C♭ F♭. Guitarists often skip the staff, but the same accidentals apply to every scale and chord in the key.',
      ],
    },
  },
  {
    id: 'relative-minor',
    section: 'Keys & Scales',
    title: 'Relative Minor',
    diagram: 'circle-of-fifths',
    fretboardDemo: { scaleQuality: 'minor' },
    practiceLink: { mode: 'scales', scaleQuality: 'minor' },
    theory: {
      title: 'Relative Minor',
      summary:
        'Three semitones below the major root — same key signature, darker tonal center.',
      body: [
        'A minor is relative to C major; E minor is relative to G major. They share every note but emphasize a different root.',
        'Click an inner-ring minor key on the circle to switch tonal center. Natural minor uses the same notes as its relative major — the aeolian mode starting on degree 6.',
      ],
    },
  },
  {
    id: 'diatonic-chords',
    section: 'Diatonic Harmony',
    title: 'Diatonic Chords',
    diagram: 'chord-wheel',
    fretboardDemo: { scaleQuality: 'major' },
    practiceLink: { mode: 'progressions' },
    theory: {
      title: 'Diatonic Chords',
      summary:
        'Seven chords built from the scale degrees of a key — the palette for most progressions.',
      body: [
        'In major: I and IV and V are major, ii iii vi are minor, vii° is diminished. Stack thirds on each scale degree to get the chord quality.',
        'The chord wheel lights up all seven diatonic chords for any key you pick. I sits on the inner ring, vi on the middle, ii on the outer — IV and V are the neighbors on either side. Click a major or minor label to change key.',
        'Switch to Progressions mode to hear common formulas built from this same chord family.',
      ],
      functions: [
        { numeral: 'I', role: 'Tonic — home, stable' },
        { numeral: 'ii', role: 'Predominant — sets up movement' },
        { numeral: 'IV', role: 'Subdominant — lifts away from home' },
        { numeral: 'V', role: 'Dominant — tension toward I' },
        { numeral: 'vi', role: 'Relative minor color in a major key' },
        { numeral: 'vii°', role: 'Leading tone — strong pull to I' },
      ],
    },
  },
  {
    id: 'roman-numerals',
    section: 'Diatonic Harmony',
    title: 'Roman Numerals',
    diagram: 'chord-wheel',
    practiceLink: { mode: 'progressions' },
    theory: {
      title: 'Roman Numerals',
      summary:
        'Label chords by scale degree so progressions transpose to any key on the circle.',
      body: [
        'Uppercase numerals are major (I, IV, V); lowercase are minor (ii, iii, vi). A ° marks diminished (vii°).',
        'The chord wheel labels each highlighted segment with its Roman numeral so you can see I–IV–V as neighbors and ii–iii–vi on the outer rings. I–V–vi–IV means the same shape in C (C–G–Am–F) as in G (G–D–Em–C).',
      ],
      examples: [
        { label: 'C major', chords: 'C – G – Am – F (I – V – vi – IV)' },
        { label: 'G major', chords: 'G – D – Em – C (I – V – vi – IV)' },
        { label: 'A major', chords: 'A – E – F♯m – D (I – V – vi – IV)' },
      ],
    },
  },
];

export const DEFAULT_THEORY_TOPIC_ID = THEORY_TOPICS[0].id;

export function getTheoryTopicById(id: string): TheoryTopic | undefined {
  return THEORY_TOPICS.find((topic) => topic.id === id);
}

export function getTheoryTopicsBySection(section: TheorySection): TheoryTopic[] {
  return THEORY_TOPICS.filter((topic) => topic.section === section);
}
