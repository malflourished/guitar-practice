import type { TheoryTopic } from '../../types/music';

export const THEORY_SECTIONS = [
  'Fundamentals',
  'The Map',
  'Keys & Scales',
  'Diatonic Harmony',
  'Intervallic Function',
] as const;

export type TheorySection = (typeof THEORY_SECTIONS)[number];

export const THEORY_TOPICS: TheoryTopic[] = [
  {
    id: 'intervals',
    section: 'Fundamentals',
    title: 'Intervals',
    fretboardDemo: { scaleQuality: 'major', singleString: true },
    practiceLink: { mode: 'intervals' },
    theory: {
      title: 'Intervals',
      summary:
        'The distance between two notes — the atoms that every scale and chord is built from.',
      body: [
        'An interval is the gap between two pitches, measured in semitones (one fret on guitar). Name the size (2nd, 3rd, 5th...) and the quality (major, minor, perfect) and you have named the building block of all harmony.',
        'Perfect intervals — the unison, 4th, 5th, and octave — sound stable and open. Major and minor 3rds and 6ths sound warm and consonant. 2nds, 7ths, and the tritone are dissonant: they create the tension that music resolves.',
      ],
      sections: [
        {
          heading: 'Intervals from C',
          body: [
            'Every interval measured up from C, with its size in semitones and its character. Enable "Show on fretboard" to count these distances along a single string.',
          ],
          table: {
            columns: ['Interval', 'Semitones', 'From C', 'Character'],
            rows: [
              ['Unison (P1)', '0', 'C', 'Identical'],
              ['Minor 2nd', '1', 'C–D♭', 'Sharp dissonance'],
              ['Major 2nd', '2', 'C–D', 'Mild tension'],
              ['Minor 3rd', '3', 'C–E♭', 'Warm, minor'],
              ['Major 3rd', '4', 'C–E', 'Bright, major'],
              ['Perfect 4th', '5', 'C–F', 'Open, stable'],
              ['Tritone', '6', 'C–F♯', 'Maximum tension'],
              ['Perfect 5th', '7', 'C–G', 'Hollow, strong'],
              ['Minor 6th', '8', 'C–A♭', 'Bittersweet'],
              ['Major 6th', '9', 'C–A', 'Sweet, open'],
              ['Minor 7th', '10', 'C–B♭', 'Bluesy pull'],
              ['Major 7th', '11', 'C–B', 'Lush dissonance'],
              ['Octave (P8)', '12', 'C', 'Same note, higher'],
            ],
          },
        },
        {
          heading: 'Hear it, see it, find it',
          body: [
            'Guitarist Jack Gardiner (drawing on Tom Quayle and Paul Gilbert) argues that the fastest way to truly own the fretboard is to stop thinking in shapes and start thinking in intervals: hear what each interval sounds like, know its job relative to a root, and see where it lives on every string set.',
            'Use the practice link to open the Intervals trainer — hear an interval, then find it on the neck — and build the ear-to-hand connection that scale boxes alone never teach.',
          ],
        },
      ],
    },
  },
  {
    id: 'chord-construction',
    section: 'Fundamentals',
    title: 'Chord Construction',
    practiceLink: { mode: 'chords' },
    theory: {
      title: 'Chord Construction',
      summary:
        'Stack thirds on a root to build triads, then keep stacking for seventh chords.',
      body: [
        'A chord is built by stacking intervals of a third. Start on a root, skip a scale degree to add the third, skip again for the fifth — that three-note stack is a triad. The quality of the third (major or minor) and the fifth determine whether the triad is major, minor, diminished, or augmented.',
        'Add one more third on top of a triad and you get a seventh chord — the richer, more colorful sound of jazz and soul. The same stacking logic keeps going: ninths, elevenths, and thirteenths are just more thirds piled on.',
      ],
      sections: [
        {
          heading: 'Triad recipes',
          body: [
            'Each triad is the root plus a third and a fifth. R = root, M3/m3 = major/minor third, P5 = perfect fifth, d5 = diminished fifth, A5 = augmented fifth.',
          ],
          table: {
            columns: ['Triad', 'Formula', 'In C'],
            rows: [
              ['Major', 'R + M3 + P5', 'C – E – G'],
              ['Minor', 'R + m3 + P5', 'C – E♭ – G'],
              ['Diminished', 'R + m3 + d5', 'C – E♭ – G♭'],
              ['Augmented', 'R + M3 + A5', 'C – E – G♯'],
            ],
          },
        },
        {
          heading: 'Reading chord symbols',
          body: [
            'A bare letter means a major triad (C). A small "m" means minor (Cm). A "7" adds a minor seventh (C7); "maj7" adds a major seventh (Cmaj7). Symbols like dim and aug name the triad quality directly.',
          ],
        },
      ],
    },
  },
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
      sections: [
        {
          heading: 'Built from intervals',
          body: [
            'Each scale degree sits a specific interval above the root: a major 2nd to degree 2, a major 3rd to degree 3, a perfect 5th to degree 5, and so on. The major scale is the yardstick those interval names are measured against — see the Intervals topic for the full ruler.',
          ],
        },
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
      sections: [
        {
          heading: 'How they pull on each other',
          body: [
            'These seven chords are not equals — each has a job. The tonic chords feel like rest, the predominants create motion, and the dominants build tension that resolves home. See the Harmonic Function topic for the full tension-and-release story.',
          ],
        },
      ],
      functions: [
        { numeral: 'I', role: 'Tonic — home, stable' },
        { numeral: 'ii', role: 'Predominant — sets up the dominant' },
        { numeral: 'iii', role: 'Tonic family — mediant color, bridges I and vi' },
        { numeral: 'IV', role: 'Predominant (subdominant) — lifts away from home' },
        { numeral: 'V', role: 'Dominant — tension toward I' },
        { numeral: 'vi', role: 'Tonic family — relative minor, a softer home' },
        { numeral: 'vii°', role: 'Dominant — leading-tone pull to I' },
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
  {
    id: 'harmonic-function',
    section: 'Diatonic Harmony',
    title: 'Harmonic Function',
    diagram: 'chord-wheel',
    practiceLink: { mode: 'progressions' },
    theory: {
      title: 'Harmonic Function',
      summary:
        'Why progressions feel like they move — every chord plays a role of rest, motion, or tension.',
      body: [
        'Harmony tells a story in three acts: rest, departure, and return. The tonic feels like home. The predominant pulls you away from it. The dominant builds tension that wants to fall back to the tonic. Most progressions are just trips around this tonic → predominant → dominant → tonic arc.',
        'Each of the seven diatonic chords belongs to one of these families, so chords within a family can often substitute for each other. That is why iii and vi can stand in for the tonic, or ii for the subdominant — they share the same function.',
      ],
      sections: [
        {
          heading: 'The three functions',
          body: [
            'Group the diatonic chords by the job they do. Chords in the same family are interchangeable enough to swap without breaking the flow.',
          ],
          table: {
            columns: ['Function', 'Chords', 'Feeling'],
            rows: [
              ['Tonic', 'I, iii, vi', 'Rest, home, resolution'],
              ['Predominant', 'ii, IV', 'Motion, sets up the dominant'],
              ['Dominant', 'V, vii°', 'Tension, pulls back to I'],
            ],
          },
        },
        {
          heading: 'Scale-degree names',
          body: [
            'Each degree of the scale has a traditional name. The tonic, subdominant, and dominant — degrees 1, 4, and 5 — are the pillars of the key.',
          ],
          table: {
            columns: ['Degree', 'Name'],
            rows: [
              ['1', 'Tonic'],
              ['2', 'Supertonic'],
              ['3', 'Mediant'],
              ['4', 'Subdominant'],
              ['5', 'Dominant'],
              ['6', 'Submediant'],
              ['7', 'Leading tone'],
            ],
          },
        },
        {
          heading: 'Cadences',
          body: [
            'A cadence is the chord move that ends a phrase. Authentic (V–I) is the strongest resolution. Plagal (IV–I) is the gentle "amen" ending. A half cadence pauses on V, leaving the phrase open. A deceptive cadence (V–vi) sets up the tonic, then sidesteps to vi for a surprise.',
          ],
        },
      ],
    },
  },
  {
    id: 'intervallic-function',
    section: 'Intervallic Function',
    title: 'Thinking in Intervals',
    practiceLink: { mode: 'intervals' },
    theory: {
      title: 'Thinking in Intervals',
      summary:
        'Shapes tell you where notes are; intervals tell you what they do. Learn to hear function against a root.',
      body: [
        'CAGED and three-notes-per-string are powerful maps, but they teach geometry, not meaning — you can rip through a box without knowing what any note is doing. Intervallic thinking flips that: every note is heard and seen as a function above a root (a 3rd, a ♭7, a 5th), so the same idea transfers to any key, any position, even any instrument.',
        'The goal is three senses working together: an ear that recognises the sound of each interval, a voice that can sing it, and eyes that see its shape on every string set. Keep your shapes — then layer interval knowledge on top to finally understand them.',
      ],
      sections: [
        {
          heading: 'The two senses to train',
          body: [
            'Hearing and seeing are separate skills. Drill both: identify intervals by ear, and find them on the neck from a known root. The Intervals trainer alternates between the two.',
          ],
        },
      ],
    },
  },
  {
    id: 'shell-voicings',
    section: 'Intervallic Function',
    title: 'Shell Voicings',
    practiceLink: { mode: 'intervals' },
    theory: {
      title: 'Shell Voicings',
      summary:
        'Root, 3rd, and 7th — the three notes that define a seventh chord. Drop the 5th.',
      body: [
        'A shell voicing keeps only the root, the 3rd, and the 7th. The 5th adds almost no harmonic information (Gardiner calls it the "potato"), so leaving it out gives you a lean, mobile chord that still states the quality clearly.',
        'From one root, three shells cover the core seventh chords: flatten the 7 and a major 7 becomes a dominant 7; flatten the 3 as well and it becomes a minor 7. Hearing those two notes move is hearing the chord change.',
      ],
      sections: [
        {
          heading: 'The three core shells',
          body: [
            'Build each from the same root and listen to how only the 3rd and 7th change.',
          ],
          table: {
            columns: ['Chord', 'Shell', 'From C'],
            rows: [
              ['Major 7', 'R + 3 + 7', 'C – E – B'],
              ['Dominant 7', 'R + 3 + ♭7', 'C – E – B♭'],
              ['Minor 7', 'R + ♭3 + ♭7', 'C – E♭ – B♭'],
            ],
          },
        },
      ],
    },
  },
  {
    id: 'color-tones',
    section: 'Intervallic Function',
    title: '3rds & 7ths',
    practiceLink: { mode: 'intervals' },
    theory: {
      title: '3rds & 7ths',
      summary:
        'The 3rd and 7th are the two notes that carry the sound of the changes — target them.',
      body: [
        'When chords move, the roots and 5ths mostly just relocate; it is the 3rds and 7ths that actually voice-lead, often by a single semitone. The 3rd of one chord frequently becomes the 7th of the next, and they sit close together on the neck.',
        'Outline a progression with only its 3rds and 7ths and a listener still hears the harmony, even with no chords underneath. That is why these two tones are the heart of jazz and blues comping — and a brilliant constraint for melodic soloing.',
      ],
    },
  },
  {
    id: 'gb-shift',
    section: 'Intervallic Function',
    title: 'The G→B Shift',
    practiceLink: { mode: 'intervals' },
    theory: {
      title: 'The G→B Shift',
      summary:
        'Standard tuning is all fourths — except between the G and B strings, which jump a major 3rd.',
      body: [
        'Five of the six strings are tuned a perfect 4th apart. The exception is G to B, a major 3rd. That single gap is why an interval shape that works on the lower strings suddenly "breaks" when it crosses onto the B or high E strings.',
        'There is no trick to memorise away — just be aware of it. When a two-note shape spans the G and B strings, shift the upper note one fret higher than the lower-string version. The Intervals trainer flags this seam whenever a drill crosses it.',
      ],
    },
  },
];

export const DEFAULT_THEORY_TOPIC_ID = 'circle-of-fifths';

export function getTheoryTopicById(id: string): TheoryTopic | undefined {
  return THEORY_TOPICS.find((topic) => topic.id === id);
}

export function getTheoryTopicsBySection(section: TheorySection): TheoryTopic[] {
  return THEORY_TOPICS.filter((topic) => topic.section === section);
}
