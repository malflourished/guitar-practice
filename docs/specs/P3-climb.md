# P3 (first slice): Move along the neck, as the Climb lens

**Package:** P3 in `docs/ROADMAP.md` (Progressions: the improvising workshop), its "Climb" lens. First slice only.
**Status:** built 2026-11-13 on branch `claude/quirky-euler-c269a0` (cut from `vibrato-next`). Not merged. Open: the owner plays it.
**Replaces:** P2's "Move along the neck", which put step *i* of the form in the chord's position *i*. That code (`progressionLadder.ts`) and its tests are removed.
**Not in this slice:** the rest of P3 (targets on the neck, the Whole neck, Region and One string lenses) and P4's prompts.

## Why

The owner (2026-11-13), playing the 12-bar blues in D with Up the neck: "the finger positions show up on the fretboard but … the chord sounds … sound exactly the same regardless of where they're played … the first four bars are D7 and that works its way up the neck and then we just kind of stop at the top of the neck so it's unclear to me what's actually happening when we play ascend or descend."

The diagnosis (S2 session, `move-along-the-neck-diagnosis.md`) found three faults. The option put bar *i* in the chord's position *i* and clamped at the last, so the blues climbed a position a bar, ran out at bar 5 and sat at frets 17 to 24 for the other seven. It reached frets 22 to 24, which many guitars do not have. And a four-chord loop jumped 7 or 8 frets between neighbouring chords. It sounded the same because it was the same notes: the same chord a position up the neck is the same pitches on other strings.

The roadmap's own answer is a lens in which the form is played in one window and the window moves. That is the skill the owner is after: finding I7, IV7 and V7 without moving the hand, and then doing it somewhere else on the neck.

## What the player does and sees

Play menu, "Move along the neck": **In place** (unchanged), **Up the neck**, **Down the neck**. Press Play.

- A whole pass of the form is played in one **region** of the neck. The neck, the chord diagrams in the side panel and the guitar's strum all show the same shapes for the same bar.
- Between passes the region moves one up (Up the neck), to the highest region, turns round, comes back down to the lowest, turns round again, and so on. Down the neck is the mirror image. It never stops at an end.
- Under the form strip, one line says where the pass is and what comes next, in the deck's small label style: `frets 3–7 · up next pass`, `frets 10–14 · down next pass`, and on a short form `frets 0–3 · up in 2 passes`. With Loop off it names only the frets. It is there from the count-in on. The beat row's spoken label (`aria-label`) carries the same words.
- The menu says what the option does. The backing guitar strums the shape shown, so the sound hardly changes from one region to the next: the same chord higher up is nearly the same notes. The point is where the hand goes. (Voicings whose top note really climbs are package C.)
- The position bar is disabled while a climb plays, as it was, and still shows the position chosen before Play.

## The rule

**Regions.** Take the first chord's shapes from `buildChordPositions` and keep those whose highest fret is at most 15 (`CLIMB_TOP_FRET`). Each is a region, low to high. D7 has five shapes (open 0–2, A shape 5–7, E shape 10–12, A shape 17–19, E shape 22–24), so three regions. Every library entry in every key has two or three regions: a major, dominant or maj7 first chord has three in C, D, E, F, G, A and A♯ and two in C♯, D♯, F♯, G♯ and B; a minor or m7 first chord has three in D, E, F, A and A♯ and two in the rest. (143 of the 276 entry-and-key pairs have three, 133 have two.)

**The shapes in a region.** The first chord takes the region's shape. Every other chord takes one of its own shapes that ends at or below fret 15, the same shape for the whole pass, chosen so that the whole pass fits in the **fewest frets** (lowest to highest fret any shape uses). Where several choices tie, the shapes nearest the first chord's middle fret win, then the lower ones. The search (`fitPass` in `src/lib/music/progressionClimb.ts`) is exact, and a test checks it against brute force over the whole library. A chord with no shape that low takes its lowest shape.

**Moving.** The climb starts at the region nearest the shape the player had selected for the first chord (nearest by middle fret, a tie to the lower). Up the neck then goes up a region each pass to the highest, turns round, goes down to the lowest, turns round, and so on: with three regions, 0 1 2 1 0 1 2 1 0. Each end is visited once per turn, so it never sits still. Down the neck is Up seen in a mirror: from a middle region it goes down first; from the lowest it can only go up. Starting at the top, Up goes down first.

**Short forms.** A form shorter than four bars stays in a region for as many passes as it takes to last at least four bars, ⌈4 ÷ bars⌉ passes. A two- or three-bar form moves every second pass, a one-bar loop every fourth.

**Same chord, same shape.** Within a pass a chord is played the same way each time it comes round (the blues' D7 is one shape in bars 1 to 4, 7, 8 and 11). As the region goes up, no chord's shape goes down.

### Why "fewest frets", not "nearest the middle"

The brief suggested: each chord takes, among its own shapes ending at or below fret 15, the one whose middle is nearest the region's middle. That was measured first, in a scratch script, against the rule built here. Over the 23 library entries in 12 keys (276 progressions, 695 regions) the rule built here is better on every count that is not a tie:

| | Nearest the region's middle | Fewest frets (built) |
|---|---|---|
| Regions where neighbouring chords' middles are more than 5 frets apart | 8 | 4 |
| … more than 4 frets apart | 117 | 62 |
| Regions that use more than 7 frets (highest − lowest > 6) | 138 | 78 |
| Average frets used, highest − lowest | 4.83 | 4.66 |
| Average widest hop between neighbouring chords | 2.65 | 2.48 |
| Widest region, highest − lowest | 8 | 8 |

The difference is chords whose two nearest shapes lie either side of the region. In I–V–vi–IV in D, round the 5th fret, nearest-the-middle puts Bm at 7–9 (D 5–7, A 5–7, Bm 7–9, G 3–5: the pass uses frets 3 to 9, and the hops between neighbours are 0, 2 and 4); fewest frets puts Bm at 2–4 (frets 2 to 7, hops 0, 3 and 1). Both rules are monotone: as the region goes up, no chord's shape goes down (tested). Going back to the brief's rule means changing one function (`fitPass`).

## What reads what

`useProgressionsState` keeps what Play chose (`climb`: a direction and the shape the first chord started from, null for In place) and the pass the screen is on (`climbPass`). `useProgressionViews` builds **one plan** from the steps and that choice (`buildClimbPlan`) and reads it two ways:

- the neck and the panel show `buildClimbChordViews(plan, climbPass)`;
- the jam is handed `positionsForPass(pass)`.

The jam schedules each bar about 100 ms before the screen catches up (`Tone.Draw`), so when bar 1 of a new pass is scheduled `climbPass` still holds the old pass. `getBar(bar)` in `useJamLoop.ts` therefore asks for the shapes of `jamPosition(bar, chords).pass`, worked out from the bar number and nothing else. The shapes for bar *b* depend only on *b*, the steps and the starting choice. `onBeat` sets `climbPass` together with the step, so the neck, the panel and the caption change in one render.

The plan carries its own steps, so a view and a strum can never be built from different ones. Playback ids are `jam` (In place), `jam-up` and `jam-down`; a view is the climb's while a `jam-` id plays.

## Checked

**Tests (pure functions).** `src/lib/music/progressionClimb.test.ts`, 30 tests, in the style of `jamSchedule.test.ts`:

- 12-bar blues in D, Up: every pass sits in one stretch of at most six frets (they are 4, 5 and 5); the regions are exactly frets 0–3, 3–7 and 10–14, with each bar's shape named; pass 2 is the next region up and every bar's shape is higher; after the top region it comes back down and never repeats a region in a row; no shape or dot above fret 15; the start follows the selected shape (five shapes for D7, two above the limit); Down is Up in a mirror.
- Every library entry in all 12 keys, both directions, from every starting shape, 8 passes each (25,456 passes): no shape or dot above fret 15; every chord is one of its own shapes and the same one all pass; at least two regions; chord 1 is each region's first shape; no chord moves down as the region goes up; neighbouring chords' middles within 5 frets, except four pinned pairs; a pass inside 7 frets (highest − lowest), except three pinned entries; and the brute-force check of the "fewest frets" rule.
- A two-bar vamp changes region every second pass, a three-bar form every second, a one-bar loop every fourth, a form of four or more every pass; "in 2 passes" then "next pass".
- The shapes for bar *b* depend only on *b*: 96 bars asked in scrambled order from a plan built again give the same shapes; bar 13 (the first of pass 2) is in the second region while the screen still holds the first; neck, panel and strum agree for 48 bars.
- The label's wording, with Loop off, on a short form, for a single fret; an empty form; a chord with one shape in reach (one region, nothing to move to).
- The suite: 429 tests pass (408 before this work, less the 9 ladder tests removed, plus these 30). `npx tsc -b` and `npm run lint` are clean.

**Bounds, library × 12 keys (695 regions).**

| Frets used (highest − lowest) | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| Regions | 33 | 78 | 246 | 154 | 106 | 74 | 4 |
| Counted both ends | 3 | 4 | 5 | 6 | 7 | 8 | 9 |

Half the regions (357) fit in five frets counted both ends, three quarters (511) in six, 99% (691) in eight. The four widest, nine frets, are all region 0 of three entries: third-cycle in G (Gmaj7 open, Bmaj7 2–4, E♭maj7 only at 6–8), tritone-sub in D and in D♯ and city-pop in B.

The widest hop between neighbouring chords' middles is 6 frets. More than 5 occurs only in four pairs, which the test pins by name: **third-cycle in G (5.5), tritone-sub in D and in D♯ (6), city-pop in B (6)**. In each, one chord on a black-key root (E♭maj7, E♭7 or D♯7) has no shape below fret 6, because the app's chord shapes are the open chords and the E and A barre shapes, and it sits beside an open chord. The bound that holds everywhere is 6; 5 holds everywhere else.

The 12-bar blues' regions, as frets used (the first pass is the lowest):

| Key | Regions | Key | Regions |
|---|---|---|---|
| C | 0–3, 1–5, 8–12 | F♯ | 2–6, 7–11 |
| C♯ | 2–6, 9–13 | G | 0–3, 3–7, 8–12 |
| D | 0–3, 3–7, 10–14 | G♯ | 4–8, 9–13 |
| D♯ | 4–8, 11–15 | A | 0–2, 5–9, 10–14 |
| E | 0–4, 5–9, 7–14 | A♯ | 1–8, 6–10, 11–15 |
| F | 0–3, 6–10, 8–15 | B | 0–4, 7–11 |

**In the running app** (dev server, Browser pane at 1280×720, 240 and 200 BPM, the 12-bar blues in D, Up the neck from the open shape): 180 samples over four passes (45 distinct bars) read the neck's dots from the SVG, the active chord diagram in the side panel, the caption and the beat row's spoken label. All agreed with the plan, bar by bar, with no mismatch; the count-in already showed the first region. Intercepting the engine's `getBar` over 31 bars, every strum equalled the plan's shape for its bar; the first bar of pass 2 was scheduled while the screen still read "Bar 12 of 12 … frets 0–3 · up next pass", and its strum was already the frets 5–7 shape. A two-bar vamp with Down the neck moved every second pass and turned round at both ends (`frets 0–3 · up in 2 passes`, `· up next pass`, then 5–7, then 10–14 `· down in 2 passes`, …).

**Layout** (`scripts/check-layout.cjs` for Progressions at rest, with its Settings and Play menu states, 1440×900, 1280×720 and 960×640, Vibrato dark, Vibrato light and Scholar; and a hidden window playing the blues in D with Up the neck at bar 3 of passes 1, 2 and 3 at all three sizes). At rest: page height equals window height in all 27 states, the neck's top is 74, 64 and 64 as before, the deck 232, 216 and 216; nothing is cut off. (The open Play menu spills out of the deck on purpose: 16 elements, as the checker's header says.) Playing: page height equals window height and width equals window width at every pass; no element spills; the strip's top and the three left-column controls do not move between passes or from rest; the caption fits on one line (its box is 326, 340 and 394 px wide at 960, 1280 and 1440; its longest text needs 210) and ends 10.7, 10.7 and 19.5 px above the deck's bottom edge. Screenshots of passes 1 to 3 at 1440×900, 1280×720 and 960×640 are with the hand-over note (`climb-shots/`), and the Scholar theme was looked at once at 960×640.

**With S2 (drums).** A trial merge of `claude/sound-s2-drums-e3cf00` (`9a988d2`) into this branch has no conflicts: `usePlayback.ts`, `useJamLoop.ts` and `lib/music/index.ts` merge by themselves, because the two branches' edits to `useJamLoop.ts` are in different hunks (S2's `drums` request and fourth fader level; this branch's `chordPositionsAt`, `setPass` and one `strum:` line). On the merge, `npx tsc -b`, eslint and all 549 tests pass. The merged app was not run.

## Decisions to check

1. **The rule is "fewest frets", not the brief's "nearest the middle".** See the table above. Reverting is one function.
2. **Where the label sits.** The brief asked for it beside "pass 2" in the beat row. It does not fit there: the row is 362, 300 and 284 px wide at 1440, 1280 and 960 (the dots take 98 of that), and the deck's tracked 12 px text needs about 210 px for "frets 10–14 · down next pass" and 47 for "pass 3". Wrapped, it made the row two lines and moved the whole deck column. The caption hangs under the form strip instead, which has 326 px or more and room below it even for twelve bars. If the owner would rather have it in the beat row, the wording has to shrink to about "frets 10–14 · down next" and "pass N" has to go.
3. **Two regions in 133 of 276 pairs.** With the first chord's shapes at or below fret 15, five keys give a major or dominant first chord only two regions (C♯, D♯, F♯, G♯, B): the blues in F♯ climbs 2–6, 7–11 and back. It is the 15 limit that costs the third. A limit of 16 would add one in F♯ and B (F♯7's E shape is 14–16), 18 in C♯ and G♯ as well, and D♯ needs 20. The owner's call.
4. **The caption names every fret the pass uses.** It can read wider than the four or five frets the brief pictured: at the top of the blues in E it reads `frets 7–14`, because E7 and A7 sit at 12–14 but B7's next shape up is 14–16, over the limit, so B7 stays at 7–9. The alternative is to name only the first chord's shape, which would leave other chords outside the stated frets.
5. **The first pass starts where the player's own selection for the first chord is,** which, if the position bar was never touched, is the open position: the blues in D starts at frets 0–3.
6. **While a climb plays, the position bar still shows the position selected before Play** ("1 / 5 · Open") while the neck is at frets 10–12. It was so before. It could show the climb's region in its counter instead.
7. **Changing "Move along the neck" while the loop plays does nothing until the next Play** (as before): the choice is read at Play.
8. **Names.** The option stays `ladder` in the code and `vibrato:play-ladder` in storage; the playback ids changed from `jam-ascending` and `jam-descending` to `jam-up` and `jam-down`. Nothing saved depended on them.
9. **After S2 merges** (the fourth fader in `MixFaders`), the deck's middle column will be about 25 px narrower; the caption has 116 px to spare at 960 (326 against 210). Look at it then.

## What in the brief turned out to be musically wrong

- "No two neighbouring chords more than five frets apart" cannot hold for four pairs (above). The chord shapes the app knows are the open chords and the E and A barre shapes only; a chord like E♭7 has nothing between the open position and fret 6, so beside an open chord it is 6 frets away whatever the rule. The bound that holds is 6.
- "A region is a stretch of four or five frets" holds for about half the regions (357 of 695 fit in five frets). Chord shapes of different chords are 5 to 7 frets apart on the same neck, so a pass that has to play three or four chords in one place often needs six to eight frets.
- "Take the first chord's shapes, each defines a region" gives two regions, not three, in five of twelve keys for a major or dominant first chord (and in seven for a minor one), so there, climbing is a two-step shuffle.
- "Beside the form strip's 'pass 2' text": "pass 2" is in the deck's beat row, not the form strip, and there is no room beside it (decision 2).
- Down the neck, from the lowest region, can only go up first: it is Up in a mirror. This follows from "it never gets stuck", not from the brief's words.

## Files

| Piece | Where |
|---|---|
| The plan: regions, shapes, moving, label | `src/lib/music/progressionClimb.ts`, tests `progressionClimb.test.ts` |
| A chord's view from a chosen shape | `buildChordViewFromShape` in `src/lib/music/progressionChordViews.ts` |
| What Play chose, the pass the screen is on | `src/modes/progressions/useProgressionsState.ts` |
| One plan, read by the screen and the jam | `src/modes/progressions/useProgressionViews.ts` |
| The strum from the bar number | `chordPositionsAt` and `setPass` in `src/modes/progressions/useJamLoop.ts` (small, local edits; S2 also touches this file and `src/hooks/usePlayback.ts`) |
| Play chooses; ids | `playProgression` in `src/hooks/usePlayback.ts` |
| The caption under the strip | `caption` in `FormStrip.tsx` and its CSS; `ProgressionsDeck.tsx` |
| The menu's words | `LADDER_HINT` and `LADDERS` in `src/components/PlayControl.tsx` |
| Removed | `progressionLadder.ts` and its test; `ladderAnchor`, `ladderActive`, `ladderPositionRegion` |
