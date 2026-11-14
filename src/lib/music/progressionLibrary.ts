import type {
  ChordQuality,
  KeyMode,
  ProgressionDef,
  ProgressionStepDef,
  TheoryContent,
} from '../../types/music';

/**
 * The Progressions library: progressions sorted by what each one teaches.
 *
 * Every entry is also a `ProgressionDef` (see `entryToProgressionDef`), so the
 * deck's picker, the saved selection and the panel all read one list. Numerals
 * are relative to the key; one step is one bar. Roots the key's scale holds use
 * `degree`; the others (♭VII in a major key) use `offset` in semitones.
 *
 * Musical claims here were checked by spelling the chords out. When a claim is
 * not certain it is left out: `heard` in particular only names a recording
 * whose chords are known.
 */

export const PROGRESSION_LIBRARY_GROUPS = [
  'Hear the changes',
  'One scale, changing colour',
  'Borrowed colour',
  'Minor drama',
  'Further out',
] as const;

export type ProgressionLibraryGroup =
  (typeof PROGRESSION_LIBRARY_GROUPS)[number];

export type ProgressionFeel = 'straight' | 'swing';

/**
 * What the jam loop's drummer plays under an entry (the same names as
 * `DrumGroove` in `src/lib/audio/drumGrooves.ts`): straight eighths, a blues
 * shuffle, jazz swing on the ride, or sixteenths.
 */
export type ProgressionGroove = 'rock8' | 'shuffle' | 'swing' | 'pop16';

export interface ProgressionLibraryEntry {
  id: string;
  /** What it is called. */
  title: string;
  /** Its Roman numerals. */
  name: string;
  group: ProgressionLibraryGroup;
  keyMode: KeyMode;
  steps: ProgressionStepDef[];
  /** Why it is interesting. */
  why: string;
  /** What to aim for when soloing: which notes to land on, which note changes. */
  aim: string;
  /** The scale or mode that fits, when one does. */
  sound?: string;
  /** A well-known song or recording that uses it. */
  heard?: string;
  /** How the jam loop strums it by default; straight when left out. */
  feel?: ProgressionFeel;
  /**
   * The drum groove that suits it, in its own feel. Left out, it is the plain
   * groove of the feel: straight eighths, or a shuffle when swung.
   */
  groove?: ProgressionGroove;
  /** Longer reading, for entries that had it before the library existed. */
  theory?: TheoryContent;
}

const step = (
  numeral: string,
  degree: number,
  quality: ChordQuality,
  extra: { offset?: number; bass?: number } = {},
): ProgressionStepDef => ({ numeral, degree, quality, ...extra });

const I7 = step('I⁷', 1, 'dom7');
const IV7 = step('IV⁷', 4, 'dom7');
const V7 = step('V⁷', 5, 'dom7');
const i7 = step('i⁷', 1, 'min7');
const iv7 = step('iv⁷', 4, 'min7');
const Imaj7 = step('I maj7', 1, 'maj7');

export const PROGRESSION_LIBRARY: ProgressionLibraryEntry[] = [
  // ---- Hear the changes -------------------------------------------------
  {
    id: 'blues-12',
    feel: 'swing',
    groove: 'shuffle',
    title: '12-bar blues',
    name: 'I7 – IV7 – V7',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
    why: 'The form under a huge share of blues and early rock: twelve bars, three chords, all dominant 7ths. Every chord carries its own 3rd and ♭7, and those two notes are what tell the changes apart.',
    aim: 'Land on the 3rd of each chord. I7’s 3rd falls a half step to IV7’s ♭7 (in E: G♯ to G), and I7’s ♭7 falls a half step to IV7’s 3rd (D to C♯).',
    sound:
      'Minor and major pentatonic from the key note; Mixolydian on each chord when you want the changes to show.',
    heard: 'Stevie Ray Vaughan, “Pride and Joy”',
  },
  {
    id: 'blues-minor',
    feel: 'swing',
    groove: 'shuffle',
    title: 'Minor blues',
    name: 'i7 – iv7 – ♭VI7 – V7',
    group: 'Hear the changes',
    keyMode: 'minor',
    steps: [
      i7, i7, i7, i7,
      iv7, iv7, i7, i7,
      step('♭VI⁷', 6, 'dom7'), V7, i7, V7,
    ],
    why: 'The same twelve bars with minor i and iv. In the last four bars ♭VI7 slides down a half step to V7, and V7 pulls hard back to i.',
    aim: 'Over i7 and iv7 stay in the key’s minor pentatonic and lean on the ♭3. Over V7 play the leading tone (in A minor: G♯ over E7) and resolve it up to the tonic.',
    sound:
      'Minor pentatonic and the blues scale from the key note; harmonic minor’s raised 7th on V7.',
    heard: 'John Coltrane, “Mr. P.C.”',
  },
  {
    id: 'jazz-251',
    feel: 'swing',
    groove: 'swing',
    title: 'ii–V–I',
    name: 'ii7 – V7 – Imaj7',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [step('ii⁷', 2, 'min7'), V7, Imaj7, Imaj7],
    why: 'The basic move of jazz harmony: the chord on the 2nd degree, the dominant, then home. Jazz standards are largely chains of them.',
    aim: 'Follow the 3rds and 7ths. In C: the 3rd of Dm7 (F) stays as the 7th of G7; the 7th of Dm7 (C) falls a half step to the 3rd of G7 (B); B stays as the 7th of Cmaj7; and the 7th of G7 (F) falls a half step to the 3rd of Cmaj7 (E).',
    sound:
      'One major scale fits all three chords (in C: the white notes). From ii it is Dorian, from V Mixolydian, from I Ionian.',
    heard: '“Autumn Leaves” (chains of ii–V–I)',
    theory: {
      title: 'ii – V – I',
      summary:
        'The essential jazz cadence — predominant, dominant, then home.',
      body: [
        'ii – V – I is the harmonic engine of jazz standards. The ii chord (minor 7) sets up the V (dominant 7), which resolves to I (major 7).',
        'Seventh chords add color and voice-leading opportunities. Once you can play this in one key, transpose the same shapes to any other.',
      ],
      examples: [{ label: 'C major', chords: 'Dm7 – G7 – Cmaj7' }],
      functions: [
        { numeral: 'ii⁷', role: 'Predominant — sets up the V' },
        { numeral: 'V⁷', role: 'Dominant — strong pull to I' },
        { numeral: 'I maj7', role: 'Tonic — resolved, colorful home' },
      ],
    },
  },
  {
    id: 'turnaround-1625',
    feel: 'swing',
    groove: 'swing',
    title: 'The turnaround',
    name: 'Imaj7 – vi7 – ii7 – V7',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [Imaj7, step('vi⁷', 6, 'min7'), step('ii⁷', 2, 'min7'), V7],
    why: 'A four-bar loop that leaves home and comes back. After I the roots fall by fifths (in C: A, D, G, then C), and V7 pulls straight back to I.',
    aim: 'Follow one line through the 3rds and 7ths. In C: B (7th of Cmaj7) steps up to C (3rd of Am7), C holds as the 7th of Dm7, then falls to B (3rd of G7).',
    sound:
      'One major scale fits all four chords (in C: the white notes).',
  },
  {
    id: 'blues-145',
    title: 'Three chords',
    name: 'I – IV – V',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [
      step('I', 1, 'major'),
      step('IV', 4, 'major'),
      step('V', 5, 'major'),
    ],
    why: 'Home, lift, tension. The three major chords of a key between them hold all seven notes of its scale (in C: C E G, F A C, G B D).',
    aim: 'Land on the 3rd of each chord as it arrives (in C: E, A, B). From I to IV the 3rd rises a half step into the new root (E to F).',
    sound:
      'The major scale; the major pentatonic is the safe subset.',
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
    title: '50s progression',
    name: 'I – vi – IV – V',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [
      step('I', 1, 'major'),
      step('vi', 6, 'minor'),
      step('IV', 4, 'major'),
      step('V', 5, 'major'),
    ],
    why: 'Bright major chords with a touch of melancholy on vi. The V at the end pulls the loop back to I.',
    aim: 'I and vi share two notes (in C: C and E), so a phrase on those two ties the first two bars together. Then land on the 3rd of IV (A) and the 3rd of V (B).',
    sound: 'The major scale from the key note.',
    heard: 'Ben E. King, “Stand by Me”',
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
    title: 'Pop loop',
    name: 'I – V – vi – IV',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [
      step('I', 1, 'major'),
      step('V', 5, 'major'),
      step('vi', 6, 'minor'),
      step('IV', 4, 'major'),
    ],
    why: 'Three of its four chords hold the key note (in C: C, Am and F), so it keeps returning to the same sound. Only the V does not.',
    aim: 'Anchor on the key note through I, vi and IV. When V arrives step to its 3rd (in C: B), a half step under the key note, so it pulls back up.',
    sound: 'The major scale from the key note.',
    heard: 'The Beatles, “Let It Be”',
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
    title: 'Axis rotation',
    name: 'vi – IV – I – V',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [
      step('vi', 6, 'minor'),
      step('IV', 4, 'major'),
      step('I', 1, 'major'),
      step('V', 5, 'major'),
    ],
    why: 'The pop loop started from vi. The same four chords, but the minor one comes first.',
    aim: 'Play it from the relative minor: A minor pentatonic is the same five notes as C major pentatonic (in C: A C D E G). Land on each chord’s root as it arrives to hear the changes.',
    sound:
      'The major scale, felt from vi (in C: A minor).',
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
    title: 'Driving rock',
    name: 'I – IV – vi – V',
    group: 'Hear the changes',
    keyMode: 'major',
    steps: [
      step('I', 1, 'major'),
      step('IV', 4, 'major'),
      step('vi', 6, 'minor'),
      step('V', 5, 'major'),
    ],
    why: 'Major lift, then minor colour, then the dominant. The V at the end pushes into the next I when the loop returns.',
    aim: 'The key note is in the first three chords (in C: the root of I, the 5th of IV, the 3rd of vi). Hold it, then on V move to the 3rd (B) so it pulls back up to C.',
    sound: 'The major scale from the key note.',
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

  // ---- One scale, changing colour ---------------------------------------
  {
    id: 'vamp-mixolydian',
    title: 'Mixolydian vamp',
    name: 'I7 – IV',
    group: 'One scale, changing colour',
    keyMode: 'major',
    steps: [I7, step('IV', 4, 'major')],
    why: 'Two chords, one scale. Both A7 and D sit inside A Mixolydian, so the scale never changes; only the notes you land on do.',
    aim: 'I7’s 3rd rises a half step to IV’s root (in A: C♯ to D), and its ♭7 falls a half step to IV’s 3rd (G to F♯).',
    sound: 'Mixolydian from the key note (in A: A B C♯ D E F♯ G).',
  },
  {
    id: 'vamp-dorian',
    groove: 'pop16',
    title: 'Dorian vamp',
    name: 'i7 – IV7',
    group: 'One scale, changing colour',
    keyMode: 'minor',
    steps: [i7, IV7],
    why: 'The IV chord is major, so the key’s 6th is natural, not flat. That one note is the whole Dorian sound.',
    aim: 'Minor pentatonic plus the natural 6, which is also the 3rd of the IV chord (in A: F♯). Aim for it in bar two. The ♭3 (C) stays: it is the 3rd of Am7 and the ♭7 of D7.',
    sound: 'Dorian from the key note (in A: A B C D E F♯ G).',
    heard: 'Santana, “Oye Como Va”',
  },
  {
    id: 'lydian-float',
    title: 'Lydian float',
    name: 'Imaj7 – II/I',
    group: 'One scale, changing colour',
    keyMode: 'major',
    steps: [Imaj7, step('II/I', 2, 'major', { bass: 0 })],
    why: 'A major triad a whole step up, over the same bass note, puts the ♯4 on top (in C: D/C holds C, D, F♯, A). The jam loop keeps the bass on the key note under the II triad.',
    aim: 'Hang on the ♯4 (in C: F♯) and do not let it fall to the 4.',
    sound: 'Lydian from the key note (in C: C D E F♯ G A B).',
  },

  // ---- Borrowed colour --------------------------------------------------
  {
    id: 'borrowed-bvii',
    title: 'Mixolydian rock',
    name: 'I – ♭VII – IV',
    group: 'Borrowed colour',
    keyMode: 'major',
    steps: [
      step('I', 1, 'major'),
      step('♭VII', 7, 'major', { offset: 10 }),
      step('IV', 4, 'major'),
    ],
    why: 'All three chords come from the Mixolydian mode, the major scale with its 7th lowered. The ♭VII sits a whole step below home.',
    aim: 'Listen for the note that separates Mixolydian from major: the ♭7 (in D: C), which is the root of the ♭VII chord. Over I use the major 3rd (F♯); it rises a half step to G, the 5th of C.',
    sound: 'Mixolydian from the key note (in D: D E F♯ G A B C).',
    heard: 'Lynyrd Skynyrd, “Sweet Home Alabama”',
  },
  {
    id: 'creep-lift',
    title: 'Creep lift',
    name: 'I – III – IV – iv',
    group: 'Borrowed colour',
    keyMode: 'major',
    steps: [
      step('I', 1, 'major'),
      step('III', 3, 'major'),
      step('IV', 4, 'major'),
      step('iv', 4, 'minor'),
    ],
    why: 'III is major where the key expects minor, and the last chord is IV turned minor, borrowed from the parallel key.',
    aim: 'Trace one inner line on a single string: 5, ♯5, 6, ♭6, back to 5. It is the 5th of I, the 3rd of III, the 3rd of IV, the 3rd of iv. In G: D, D♯, E, E♭.',
    heard: 'Radiohead, “Creep”',
  },
  {
    id: 'mario-cadence',
    title: 'Mario cadence',
    name: '♭VI – ♭VII – I',
    group: 'Borrowed colour',
    keyMode: 'major',
    steps: [
      step('♭VI', 6, 'major', { offset: 8 }),
      step('♭VII', 7, 'major', { offset: 10 }),
      step('I', 1, 'major'),
    ],
    why: 'Two major chords borrowed from the parallel minor climb by whole steps into a major home.',
    aim: 'Minor pentatonic over the first two chords (in C: C E♭ F G B♭), then slide the ♭3 up a half step to the major 3rd (E♭ to E) as I arrives.',
    sound:
      'Minor pentatonic from the key note, then major pentatonic when I arrives.',
  },

  // ---- Minor drama ------------------------------------------------------
  {
    id: 'andalusian',
    title: 'Andalusian cadence',
    name: 'i – ♭VII – ♭VI – V',
    group: 'Minor drama',
    keyMode: 'minor',
    steps: [
      step('i', 1, 'minor'),
      step('♭VII', 7, 'major'),
      step('♭VI', 6, 'major'),
      step('V', 5, 'major'),
    ],
    why: 'The roots walk down the scale from the key note to the 5th (in A minor: A, G, F, E). The major V then snaps you back to the top.',
    aim: 'Natural minor all the way down. On the V chord raise the ♭7 to the 7th (in A: G to G♯): that one note is harmonic minor.',
    sound:
      'Natural minor; over the V chord, Phrygian dominant (harmonic minor started from its 5th).',
    heard: 'Ray Charles, “Hit the Road Jack”',
  },
  {
    id: 'villain-shift',
    title: 'Villain shift',
    name: 'i – ♭vi',
    group: 'Minor drama',
    keyMode: 'minor',
    steps: [step('i', 1, 'minor'), step('♭vi', 6, 'minor')],
    why: 'Two minor triads a major third apart share exactly one note (in C: E♭). The other two notes each slide a half step.',
    aim: 'Hold the shared note (the ♭3 of the key) and arpeggiate around it, so the other two voices do the changing.',
    sound:
      'Harmonic minor from the key note holds both triads (in C: C D E♭ F G A♭ B).',
  },
  {
    id: 'minor-145',
    title: 'Minor folk',
    name: 'i – iv – V',
    group: 'Minor drama',
    keyMode: 'minor',
    steps: [
      step('i', 1, 'minor'),
      step('iv', 4, 'minor'),
      step('V', 5, 'major'),
    ],
    why: 'The V is major, borrowed from harmonic minor, so it pulls home much harder than the natural minor’s v would.',
    aim: 'Over V play the raised 7th (in A minor: G♯), the 3rd of the V chord. It sits a half step under the tonic and pulls into the next i.',
    sound:
      'Natural minor on i and iv; the raised 7th (harmonic minor) on V.',
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
    title: 'Epic minor',
    name: 'i – VI – iv – V',
    group: 'Minor drama',
    keyMode: 'minor',
    steps: [
      step('i', 1, 'minor'),
      step('VI', 6, 'major'),
      step('iv', 4, 'minor'),
      step('V', 5, 'major'),
    ],
    why: 'A major VI lifts the minor key, then iv drops back before the major V sets up the return.',
    aim: 'Natural minor through the first three chords. On V raise the ♭7 to the 7th (in A minor: G to G♯) and resolve it to the tonic.',
    sound:
      'Natural minor; the raised 7th (harmonic minor) on V.',
    theory: {
      title: 'i – VI – iv – V',
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
        { numeral: 'iv', role: 'Subdominant minor — descent' },
        { numeral: 'V', role: 'Major dominant — resolution' },
      ],
    },
  },

  // ---- Further out ------------------------------------------------------
  {
    id: 'third-cycle',
    title: 'Major-third cycle',
    name: 'Imaj7 – ♭VImaj7 – IIImaj7',
    group: 'Further out',
    keyMode: 'major',
    steps: [
      Imaj7,
      step('♭VI maj7', 6, 'maj7', { offset: 8 }),
      step('III maj7', 3, 'maj7', { offset: 4 }),
    ],
    why: 'The roots fall by major thirds until they land back home, so three keys split the octave evenly.',
    aim: 'Take one small idea and move it down four frets with each chord.',
    sound: 'Each chord’s own major scale (in C: C, A♭ and E).',
    heard: 'John Coltrane, “Giant Steps” (its three key centres)',
  },
  {
    id: 'backdoor',
    feel: 'swing',
    groove: 'swing',
    title: 'Backdoor',
    name: 'Imaj7 – iv7 – ♭VII7 – Imaj7',
    group: 'Further out',
    keyMode: 'major',
    steps: [
      Imaj7,
      iv7,
      step('♭VII⁷', 7, 'dom7', { offset: 10 }),
      Imaj7,
    ],
    why: 'iv7 – ♭VII7 is a ii–V borrowed from the key a minor third up. It resolves up a whole step instead of down a fifth.',
    aim: 'Over the middle two bars play the major scale a minor third above the key (in C: E♭ major), where Fm7 and B♭7 are its ii and V. Then land on the major 3rd of Imaj7 (E).',
    sound:
      'The major scale on Imaj7; a minor third up (in C: E♭ major) over iv7 and ♭VII7.',
  },
  {
    id: 'tritone-sub',
    feel: 'swing',
    groove: 'swing',
    title: 'Tritone sub',
    name: 'ii7 – ♭II7 – Imaj7',
    group: 'Further out',
    keyMode: 'major',
    steps: [
      step('ii⁷', 2, 'min7'),
      step('♭II⁷', 2, 'dom7', { offset: 1 }),
      Imaj7,
    ],
    why: '♭II7 shares its 3rd and 7th with V7, so it carries the same tension. The bass slides down by half steps instead.',
    aim: 'Follow the bass: 2, ♭2, 1. Over ♭II7 try Lydian dominant from its root.',
    sound:
      'The major scale on ii7 and Imaj7; Lydian dominant from the root of ♭II7 (in C: D♭ E♭ F G A♭ B♭ C♭).',
    heard: 'Antônio Carlos Jobim, “The Girl from Ipanema”',
  },
  {
    id: 'city-pop',
    groove: 'pop16',
    title: 'City pop',
    name: 'IVmaj7 – III7 – vi7 – v7 – I7',
    group: 'Further out',
    keyMode: 'major',
    steps: [
      step('IV maj7', 4, 'maj7'),
      step('III⁷', 3, 'dom7'),
      step('vi⁷', 6, 'min7'),
      step('v⁷', 5, 'min7'),
      step('I⁷', 1, 'dom7'),
    ],
    why: 'III7 is the V of vi. The last two chords are a ii–V that drops you back onto IV (they usually share one bar; here each gets one).',
    aim: 'Major scale. Raise the 5 to ♯5 over III7 (in C: G to G♯), and lower the 7 to ♭7 over the last two chords (B to B♭).',
    heard: 'Grover Washington Jr. with Bill Withers, “Just the Two of Us”',
  },
];

/** How an entry swings: straight unless it says otherwise. */
export function progressionFeel(entry: ProgressionLibraryEntry | undefined): ProgressionFeel {
  return entry?.feel ?? 'straight';
}

/**
 * The drum groove for an entry played in `feel`: the entry's own groove when
 * it has that feel, and otherwise the plain groove of the feel, so the Feel
 * menu can swing a rock entry (a shuffle) or straighten a blues (eighths).
 */
export function progressionGroove(
  entry: ProgressionLibraryEntry | undefined,
  feel: ProgressionFeel = progressionFeel(entry),
): ProgressionGroove {
  const own = entry?.groove ?? (progressionFeel(entry) === 'swing' ? 'shuffle' : 'rock8');
  const ownIsSwung = own === 'shuffle' || own === 'swing';
  if (ownIsSwung === (feel === 'swing')) return own;
  return feel === 'swing' ? 'shuffle' : 'rock8';
}

export function getProgressionLibraryEntry(
  id: string,
): ProgressionLibraryEntry | undefined {
  return PROGRESSION_LIBRARY.find((entry) => entry.id === id);
}

export function getProgressionLibraryGroups(): {
  group: ProgressionLibraryGroup;
  entries: ProgressionLibraryEntry[];
}[] {
  return PROGRESSION_LIBRARY_GROUPS.map((group) => ({
    group,
    entries: PROGRESSION_LIBRARY.filter((entry) => entry.group === group),
  }));
}

/** The playable form of an entry: what the deck's picker and the chords use. */
export function entryToProgressionDef(
  entry: ProgressionLibraryEntry,
): ProgressionDef {
  return {
    id: entry.id,
    label: entry.name,
    nickname: entry.title,
    keyMode: entry.keyMode,
    category: entry.group,
    steps: entry.steps,
    theory: entry.theory ?? {
      title: entry.title,
      summary: entry.why,
      body: [],
    },
  };
}
