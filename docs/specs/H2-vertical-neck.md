# H2: a vertical neck in the key dial's place

**Package:** H2 in `docs/ROADMAP.md`, a follow-up to H (the key dial).
**Status:** spec written 2026-11-13. The owner approved the mock-up ("build the vertical neck for Theory").
**Mock-up:** [design/theory-neck/mock-neck.jpg](../design/theory-neck/mock-neck.jpg), drawn into the running app by `mock-neck.js` in the same folder.

## Why

The owner (2026-11-13) finds the dial "really pretty". But in Theory, clicking **Neck** "just takes you to the neck, and everything kind of disappears". Clicking **Dial** brings it all back. Their suggestion: "maybe the neck shows vertically in that space. That way we can keep the information displayed in the same way."

So Neck stops being a different page. It becomes the same chords drawn a second way, in the same place, while the words, the view pills and the side panel stay still. It also teaches something the dial cannot: where the key's chords live on the guitar, everywhere at once.

## What the player sees

In Theory, with the Dial | Neck switch on **Neck**:
- **The figure.** In the dial's square, a vertical fretboard oriented like a chord chart:
  - low E on the left and high e on the right;
  - the nut at the top, with string names above it and open-string markers between the names and the nut;
  - frets 0 to 12 going down, with fret numbers on the left and inlays at 3, 5, 7, 9 and a double one at 12.
- **The markers.** Every note of the view's chords sits at each place it falls on frets 0–12, wearing its chord's numeral (see "What the markers show").
- **Around it.** The left column (title, words, view pills, the switch, "Practice this across the neck →") and the side panel stay exactly where they are. The frame keeps `noDeck` in both Dial and Neck; the horizontal neck no longer appears in Theory.
- **Tooltips.** Each marker's title gives the note, numeral and chord, for example "F · IV · F major".
- **The legend.** A single line under the neck shows the marker styles in use: home, major, minor and diminished, plus borrowed or dominant in those views.

## What the markers show

Read everything from `describeKeyDial(state)` in `src/lib/music/keyDial.ts`, so the dial and the neck can never disagree. A cell's label gives the chord's root, and its ring gives the quality.

| View | Markers |
|---|---|
| In key | The key's seven chords (`main`) by root. Home (I, or i in minor): a solid light disc with dark text. Major: filled with the dial's accent and ringed. Minor: ringed only. Diminished: dashed and muted. |
| Borrowed | The `extra` cells in a second style, clearly brighter, for example the accent with a heavier ring. The `main` chords stay, dimmed to about 40%. Where an extra chord shares a root with a main one (iv and IV on F in C major), the marker shows the extra's numeral: the view is about the extras. |
| Dominants | As Borrowed, with the secondary dominants (V/ii, V/iii, …) as the extras. Labels up to five characters must fit, at a smaller size. |

Major and minor keys both work, in every key, with the numerals the dial uses.

## The words

The caption in the left column follows the view while Neck is on. Use these lines; the dial keeps its own captions.

- **In key:** "The same seven chords, by root, across the whole neck. Find any I: IV and V are always one string away." In minor, the second sentence uses i, iv and v.
- **Borrowed, major key:** "Borrowed from {the parallel minor, e.g. C minor}: ♭VII sits two frets below any I on the same string, ♭III three frets above it, ♭VI four below."
- **Borrowed, minor key:** "Borrowed from {the parallel major}: IV and V sit on the same roots as iv and v. Only their 3rds move, a fret up."
- **Dominants:** "Each secondary dominant sits a 5th above the chord it leads to. Find the target's root: its V7 is one string lower at the same fret, or a fret lower when the target is on the B string."

I checked each claim on the neck in standard tuning. If you change a line, check it again.

## Size

The figure must fit the dial's square at every window size, with frets 0–12 always shown.
- **Spacing:** the frets follow a real neck, each fret space about 0.944 (2^(−1/12)) of the one before.
- **Minimum:** no fret space may be less than 1.15 × the marker's diameter.
- **Where space runs short:**
  1. shrink the markers from 27 px towards 20 px;
  2. then blend the spacing towards even, until it fits.
- At 1440×900 it should look like the mock-up. At 960×640 the stage is about 480 px tall, and the rule must still hold there.
- Put this in a pure helper, for example `verticalNeckLayout(height, width)`, returning the string x positions, the fret y positions and the marker radius. It is easy to test.

## Motion between Dial and Neck

Nothing else on the page moves.

**Dial to Neck:**
1. Over about 180 ms (ease-in), the dial turns about −10° and scales to about 0.92 as it fades.
2. From about 120 ms after the start, the neck fades in and rises about 14 px into place, over about 220 ms (ease-out).

They overlap only briefly, and are never both at full strength.

**Neck to Dial** is the reverse: the neck sinks and fades, then the dial turns back in.

**Reduced motion** (`prefers-reduced-motion`): a 120 ms crossfade with no movement, as the dial already does for its turns.

## Look

- Use the dial's tokens and accent so the two figures share colours. The strings and frets are hairlines in the text colours: the strings a little stronger, the low strings slightly thicker.
- It must work in both themes, Vibrato (dark) and Scholar (light), and under the analog texture.
- The SVG has `role="img"` and an `aria-label`, for example "C major's seven chords by root, frets 0 to 12".

## Tests

- **The map** (a pure helper, for example `neckChordMap(info)`, returning `{ string, fret, numeral, kind }`):
  - In key, in all 12 keys and both modes: every marker's pitch class is one of the seven roots, and every place a root falls on frets 0–12 is marked.
  - C major has the mock-up's markers, including the open strings: E iii, A vi, D ii, G V, B vii°, e iii.
  - Borrowed and Dominants: the extras are marked with the extra kind, and a shared root shows the extra's numeral.
- **The layout:** at the stage sizes of 1440×900, 1280×720 and 960×640, every fret space is at least 1.15 × the marker diameter, everything fits, and the spacing is graduated where there is room.

## Done when

- [ ] Neck draws the vertical neck in the dial's place in all three views, for major and minor keys, and follows key changes.
- [ ] The words follow the view, and the left column and side panel do not move.
- [ ] The motion runs both ways as described, and reduced motion gives a plain crossfade.
- [ ] No page scrolls at 1440×900, 1280×720 or 960×640. Screenshots at all three sizes, in both themes, of each view, plus one frame mid-motion.
- [ ] Tests, lint and `tsc` pass.
- [ ] The owner switches between Dial and Neck and finds it elegant.

## Out of scope here

- Clicking a marker to play its chord. This is shared with the dial's open item, "Clicking a chord plays it".
- A switch between note names and numerals.
- More frets than 0–12.
