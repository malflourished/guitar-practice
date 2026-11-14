# P3 and P4: where to land, and one prompt per pass

**Package:** P3 (targets on the neck) and P4 (one prompt per pass) in `docs/ROADMAP.md`, Progressions: the improvising workshop. It also takes one of M's follow-ups: the Progressions Play menu.
**Status:** spec written and built 2026-11-14 on branch `claude/progressions-p3-p4-1faf6f` (cut from `vibrato-next`). Not merged. Open: the owner plays it.
**Builds on:** P2 and P2.2 (the jam loop, the form strip, the next change), and the Climb lens ([P3-climb.md](P3-climb.md)).
**Not in this slice:** the neck showing every tone of the current chord, and the Whole neck, Region and One string lenses as things the player switches. See [Lenses](#lenses-climb-and-the-three-not-built-yet).

## Why

The roadmap's reason for this mode: "Patterns without intent come from not knowing which notes matter on each chord, and from never being made to leave a position." Climb makes the hand move. This slice answers the other half: at each change, which note do I aim for, and where is it from here?

A solo sounds like it follows the chords when its strong notes are the notes that tell one chord from the next. Those are the 3rd and the 7th. The root and 5th are in the bass and the strum already. So while the loop plays, the neck rings the next chord's 3rd and 7th near the hand, early enough to play towards them. And each time round, one line of text gives the player a single thing to try.

## What the player sees and hears

Pick the 12-bar blues in C, tempo 90, press Play.

1. **Count-in.** The neck shows C7's shape, as before. Rings appear on C7's own 3rd and ♭7 (E and B♭): where to start. Above the form strip, one line: *Land on the 3rd of each chord on beat 1*. Because that is the prompt, only the 3rds are ringed this pass.
2. **Bars 1 to 3.** C7 sounds. No rings: bar 2 is C7 again, so there is nothing to aim for yet.
3. **Bar 4.** The deck already says `→ F7 next bar`. On beat 1 of the bar, rings fade in on F7's targets near the hand: A (its 3rd) on the G string at fret 2. Each ring has the note's job in the next chord written in it: `3`.
4. **Beat 4 of bar 4.** The rings go to full strength, at the moment the deck's `F7 next bar` brightens. That is the beat to play into them.
5. **Bar 5.** F7 sounds, the neck shows F7's shape, the rings are gone. In bar 6 new rings show the way back to C7.
6. **Bar 12.** G7. The rings show C7's targets for the top of the next pass. The prompt line changes to the next prompt in a quieter tone: *Next: Two beats of silence after every phrase*.
7. **Pass 2.** The cymbal, the new prompt at full strength, and the rings now show both guide tones, the 3rd and the ♭7.

Nothing new is heard: the targets and the prompts are things to see. Stop, Space, another entry or another key end them with the loop.

## P3: the rules

### 1. Which notes are targets

For the chord that is coming, with the chord sounding now:

- **The guide tones: its 3rd and its 7th.** A triad has only a 3rd, so that is its one target.
- Each target is either **new** (the chord sounding now does not have that note) or **held** (it does: the note stays and only changes its job). Dm7 to G7: B, G7's 3rd, is new; F, its ♭7, is held, because it was Dm7's 3rd.
- **When no guide tone is new, the notes that change are added.** C to A minor: A minor's 3rd is C, which the C chord already has. Landing on it is fine, but nobody would hear a change. The note that makes the change is A, so A is ringed too, with `R` in it. This is what "what to show when a change moves neither" comes to. In the library, in all 12 keys, 156 of 996 changes are of this kind. They are the moves where the root goes up or down a third: I to vi, vi to IV, the major-3rd cycle, the villain shift.
- A chord that is the same as the one before it (same root, quality and bass) is not a change. Nothing is ringed until the next different chord is near. This is `nextChange`, as the deck's "F7 in 3 bars" already uses it.
- A slash chord's bass note is not a target. It belongs to the bass.

`changesTargeting.ts` is not what finds them, though the roadmap says it does. Its `planGuideTones` puts one 3rd and one 7th on the D and G strings and searches the whole progression for the smoothest line. That is right for the Intervals drill, where the player plays that one line. Here the player is improvising, on any string, in a region that moves. They need every 3rd and 7th within reach, not one pair. So the picking is new (`landingTargets.ts`); the idea of guide tones is the same.

### 2. Where: inside the hand's reach

- The targets are shown **where the hand will be when the next chord sounds**: the frets of the shape the next chord is shown in, and one fret more each side. That is four or five frets (205 and 791 of the 996 changes).
- Inside that window, **every place** the note sits is ringed, on the **four melody strings** (e, B, G, D). Not the one nearest place: the app cannot know which string the player's line is on, and in four or five frets each note sits on one or two of those strings.
- Four frets on those four strings hold every note at least once, so "or anywhere" is never needed for a shape. The code still has the fallback: a note with no place in a window takes the nearest place outside it, the lower fret on a tie.
- How many rings: 1 on 183 changes, 2 on 289, 3 on 275, 4 on 194, and 5 to 8 on 55 (the changes where the notes that change are added to a seventh chord).

Worked examples, in place, from the default shapes:

| Change | Window | Rings |
|---|---|---|
| C7 → F7 (blues in C, bar 4) | frets 0–4 | E♭ `♭7` on B 4 and D 1; A `3` on G 2 |
| F7 → C7 | 0–4 | E `3` on open e and D 2; B♭ `♭7` on G 3 |
| Dm7 → G7 (ii–V–I in C) | 0–4 | B `3` on open B and G 4; F `♭7`, held, on e 1 and D 3 |
| G7 → Cmaj7 | 0–4 | E `3` on open e and D 2; B `7`, held, on open B and G 4 |
| C → Am (50s progression) | 0–3 | C `♭3`, held, on B 1; A `R` on G 2 |

### 3. How they look

- A target is a **ring**: an outline the size of a note dot, no fill, with its job in the next chord inside it in the thin label type (`3`, `♭3`, `♭7`, `7`, and `R` or `5` for an added note). Filled dots are the chord now. Outlines are the chord next. That is the app's own language: outlined panels on the lava.
- **New** targets have a solid line. **Held** ones have a dashed line, the same dash the neck already uses for a note two boxes share. A held target that falls on a dot of the current shape is drawn as a dashed halo round that dot, with no second label.
- The label is always the job, even when Labels is set to note names, because the job is why it is a target. The dots keep the Labels setting.
- Rings use the neck's own ring colour. No new colours.
- They fade in over 150 ms and are at 0.62 strength while the change is coming, full strength on the last beat. With reduced motion they do not fade.
- Rings are not buttons. A screen reader gets them in the neck's label: "Next: F7. Land on A, the 3rd, or E♭, the ♭7."

### 4. When they appear

The roadmap says "on the last beat before a change". That is too late to use, and this is the one place where its rule is musically wrong. At 120 BPM a beat is half a second. A player has to see the ring, choose a string and play a phrase that ends on it. A phrase that lands on beat 1 starts a bar earlier. A teacher says "look ahead", not "look now".

- The targets appear **a whole bar before the change**, on its first beat.
- At fast tempos a bar is short, so they appear earlier: **at least two seconds** before the change, counted in beats, and never more than two bars. 120 BPM and slower: 4 beats. 150: 5. 180: 6. 200: 7. 240 and faster: 8.
- They cannot appear before the chord now has begun. When every bar is a new chord, there are always rings on the neck for the chord after this one. That is correct: on such a tune you are always playing towards the next chord.
- **The last beat is the accent, not the first sight**: the rings go to full strength with the deck's "next bar" text.
- During the count-in the first chord's targets show for the whole bar.
- With Loop off, the last bar has no rings: the music stops there.

### 5. Repeated chords and turnarounds

- **Repeats.** The blues holds I7 for four bars. Rings appear only in the fourth (or from beat 2 of the third at 200 BPM). During the first three the neck is quiet, which is the point: stay on the chord you have.
- **The turnaround** (the last bar into the first) is a change like any other. Its rings are worked out for the pass they will be played in: that pass's window, and that pass's prompt.
- **A one-chord loop** has no change and no rings.
- **Two chords a bar** do not exist yet (one step is one bar). When they do, the lead becomes "the change before this one, or two seconds, whichever is shorter".

### Lenses: Climb, and the three not built yet

A lens answers one question for the targets: which stretch of neck, on which strings. `landingTargets` takes that as a window and a list of strings, so a lens only has to supply them.

- **In place** (built). The window follows each chord's own selected shape.
- **Climb** (built: "Move along the neck"). The window follows the shape the next chord has in the pass it is played in. So at the end of a pass that moves, the rings appear **in the next region**, while the hand is still in the old one. The blues in D, up the neck, bar 12 of pass 1: the caption says `frets 0–3 · up next pass` and the rings for D7 are at frets 4 to 8 (F♯ on B 7 and D 4, C on e 8 and G 5). The rings show where to shift to.
- **One string** (built as two prompts, not yet as a lens the player picks). The window is one string from the open string to fret 15.
- **Region** (not built). A window of four or five frets the player places, the same for every chord.
- **Whole neck** (not built). Every melody string to fret 15 would ring about ten places a change, which is clutter. When it is built it should ring one place a string, the nearest to the last shape.

**The roadmap's first line of P3 is not built: "The neck shows the current chord's tones everywhere, with the 3rd and 7th emphasized."** The neck still shows the shape the backing guitar strums. Two reasons to stop here and ask:

1. Climb was built on a promise that the neck, the side panel and the strum show the same shape for the same bar. Replacing the shape with every chord tone breaks that, and it is a change to what the neck looks like in this mode, which the owner should see as a mock-up first.
2. "Everywhere" is about 32 dots for a seventh chord up to fret 15, plus rings. A window of five frets is about 10. Whether that reads as a map or as noise is a thing to look at, not to argue.

The recommendation is a next slice, P3.2: a "Neck shows" choice of Shape (today), Region and One string, where Region and One string draw the current chord's arpeggio in the lens with the 3rd and 7th solid, and the targets keep working as they do here.

## P4: one prompt per pass

### The prompts

Ten, in the order of a lesson: where to aim, then how to phrase, by turns, with the test at the end. Each also says what the rings show, so the neck and the sentence agree.

| # | Prompt | The rings show | Left out when |
|---|---|---|---|
| 1 | Land on the 3rd of each chord on beat 1 | 3rds only | |
| 2 | Two beats of silence after every phrase | 3rds and 7ths | |
| 3 | Play only the notes that change | every note of the next chord that this one lacks | |
| 4 | One string only: the B string | 3rds and 7ths along the B string, to fret 15 | Move along the neck is on |
| 5 | Land on the 7th of each chord on beat 1 | 7ths only | any chord is a triad |
| 6 | One short idea. Repeat it, change one note | 3rds and 7ths | |
| 7 | One string only: the G string | 3rds and 7ths along the G string | Move along the neck is on |
| 8 | Start every phrase after beat 1 | 3rds and 7ths | |
| 9 | No note shorter than a half note | 3rds and 7ths | |
| 10 | Eyes off the neck: find the 3rds by ear | nothing | |

Four are the roadmap's own. The rest come from Discover's sparks ("No note shorter than a half note", "Repeat one bar four times. Change exactly one note each time", "Start every phrase on the 'and' of 2") and from its One string lens. The last one takes the help away, which is how a teacher checks that it worked.

One-string prompts are left out while the form climbs, because Climb already says where the hand is, and the two would disagree. "Land on the 7th" is left out of forms with triads, where half the chords have no 7th.

### How they rotate

- In order, round and round. Not shuffled: the order is the lesson.
- **A prompt lasts at least eight bars.** The roadmap says the prompt changes each pass. That is right for the blues and wrong for a two-bar vamp, where a pass is four seconds at 120 BPM: nobody can read a sentence, try it and hear the result in four seconds. So a prompt lasts ⌈8 ÷ bars⌉ passes: one pass for 8 bars or more, two for 4 or 5, three for 3, four for 2. A prompt always changes at the top of the form, never in the middle.
- **In the last bar before it changes**, the line shows the next prompt in the quiet tone with "Next:" in front, for the same reason the rings come early. The rings for the top of the next pass already follow the next prompt.
- **Play starts where you stopped.** The prompt on screen when the loop stops is the one the next Play starts with (saved as `vibrato:play-prompt`). Otherwise a player at 60 BPM would only ever meet the first two.
- **Click the line for the next prompt**, playing or stopped.
- Play menu, Prompts: **Rotate** (default), **Hold** (keep the one shown; clicking still moves on) or **Off**.
- With Loop off there is one pass and one prompt.

### Where it shows

One line **above the form strip**, hung in the free space over it the way the Climb caption hangs under it. A lead sheet has its performance note in the same place, over the first line.

- It crowds nothing: it is outside the strip's box and moves no cell. The deck's free space above the strip is the same as the space below it, where the caption already fits with 10 px to spare under twelve bars at 960×640.
- Stopped, it shows the prompt Play will start with, in the quiet tone, so the plan is visible before Start (package O's rule). Playing, it is in the text colour.
- It is one line and never wraps. Every prompt is 42 characters or fewer, which fits the strip's narrowest width (326 px at 960 wide). The full text is also its tooltip.
- The beat row beside the dots was the other candidate. It has 140 px free at 960 wide, which is not enough, and the Climb label already failed to fit there.

## The Play menu

M's follow-up: "Progressions' Play menu has four groups, and 'Move along the neck' needs a one-line explanation." It had five by now, and this slice adds two. So:

- **Click and Loop share a row**, and so do **Targets and Prompts**. Seven groups in five rows: the menu is no taller than it was.
- Order: Guitar, Feel, Click and Loop, Move along the neck, Targets and Prompts.
- **Move along the neck** has a line of small text under its title: "Each pass is played in one stretch of the neck, then the stretch moves." The longer explanation stays as its tooltip.
- **Targets** (On, Off): "Rings on the neck show where to land on the next chord."
- **Prompts** (Off, Rotate, Hold): "One thing to try each time round the form."
- Both are saved with the other Play options (`vibrato:play-targets`, `vibrato:play-prompts`) and both can be changed while the loop plays.

## Edge cases

- **Mute.** Play is disabled, so nothing shows.
- **Stop mid-bar.** Rings go at once with the loop. The prompt line goes back to the quiet tone.
- **Changing key or entry** stops the loop, as before. The saved prompt carries over. If it does not suit the new entry (a 7th prompt on a triad form), the next one in order that does is used.
- **Turning Targets off mid-loop** removes the rings at the next render. Prompts that say "by ear" and Targets off look the same.
- **Position bar while playing in place.** Moving it changes the shape of the chord sounding now. The window for the next rings follows the next chord's own shape, so it does not jump.
- **Open strings.** A target on an open string is ringed in the open-string lane, like an open note.
- **Tones and Labels.** The current chord's dots follow them as before. Rings do not change.
- **A chord with no shape** (none in the library): no window, no rings.

## Tests

`src/lib/music/landingTargets.test.ts` and `src/modes/progressions/jamPrompts.test.ts`, pure functions, in the style of `progressionClimb.test.ts`.

- **Which notes, in all 12 keys.** The blues: I7's targets from V7, IV7's from I7 and V7's from I7 are each chord's 3rd and ♭7, all new, and from I7 to IV7 each is a half step from one of I7's guide tones. ii–V–I: V7's 3rd is new and its ♭7 is held; Imaj7's 3rd is new and its 7th is held. I to vi: the 3rd is held and the root is added. A triad has one guide tone.
- **Every library entry in all 12 keys, in place and in every Climb region:** each target is a note of the next chord; each sits on a melody string inside the window; every targeted note is somewhere; a held target is a note of the current chord and a new one is not; at least one target is new unless the next chord's notes are all in this one; no more than eight rings.
- **Focus:** thirds, sevenths (and a triad's fallback), changes, one string (all on that string, frets 0 to 15), none.
- **Windows:** a shape's frets and one each side, clipped at the nut, at least four frets wide; the fallback outside a window.
- **When:** the lead in beats at 60, 120, 150, 180, 200, 240 and 300 BPM; hidden, coming and arriving by beat.
- **The cue from the loop's clock:** the count-in aims at the first chord; bars 1 to 3 of the blues have no cue at 90 BPM and bar 3 has one from beat 2 at 200; the last bar aims at the next pass, with that pass's window and focus; Loop off has no cue in the last bar; a one-chord loop has none.
- **Prompts:** the order; ⌈8 ÷ bars⌉ for 1, 2, 3, 4, 5, 8 and 12 bars; which are left out with triads and with Climb; resuming from a saved id, and from one that no longer suits; Hold; the "Next:" preview only in the last bar before a change; every text is 42 characters or fewer.
- **Play options:** Targets and Prompts default to On and Rotate, are saved, and are in the Progressions menu only.

## Done when

- [x] Pick an entry, press Play, and while the loop runs the neck shows where to land on the next chord.
- [x] The prompt shows above the form strip, changes at the top of the form after at least eight bars, and can be held, skipped or turned off.
- [x] The rings follow the prompt, and follow the Climb into the next region.
- [x] The Play menu explains "Move along the neck" in one line and is no taller than before.
- [x] Tests cover the target picking in all 12 keys. Lint and `tsc` pass.
- [x] No page scrolls at 1440×900, 1280×720 or 960×640. Screenshots at all three, playing.
- [ ] The owner plays the blues and a ii–V–I with the rings on and says they knew where to go.

## Decisions to check

1. **Targets come a bar early, not on the last beat** (section 4). The last beat is kept as the moment they brighten. To go back, set the lead to one beat in `targetLeadBeats`.
2. **Every place in reach, on the top four strings**, not the single nearest place, and nothing on the low E and A strings. Two constants: `MELODY_STRINGS` and `TARGET_REACH`.
3. **Rings carry the job (3, ♭7), never the note name**, whatever Labels says.
4. **Held targets are dashed.** If that is one distinction too many on the neck, drawing them all solid is one CSS rule.
5. **The count-in rings the first chord's targets.** It tells the player where to start. It also means rings are the first thing seen after pressing Play.
6. **The neck still shows the strummed shape, not every chord tone.** See the lenses section: this is the larger question, and the recommendation is a mock-up and a P3.2.
7. **A prompt lasts at least eight bars**, so on a four-bar loop it changes every second pass, not every pass as the roadmap's "Done when" says. `PROMPT_MIN_BARS`.
8. **The prompt changes what the rings show.** "Land on the 3rd" hides the 7ths for that pass. The other way is to keep the rings the same and let the sentence stand alone.
9. **The ten prompts and their order.** Text is in `jamPrompts.ts`, one line each.
10. **The prompt shows before Play**, quietly. It could show only while the loop runs.
11. **Prompts and Targets are in the Play menu**, not on the deck beside Tones. The deck's left column has no room for two more pills at 960 wide.
12. **The menu's one-line explanation** for Move along the neck: the wording.

## Files

| Piece | Where |
|---|---|
| Which notes, where, when, and the cue from the loop's clock | `src/lib/music/landingTargets.ts`, tests beside it |
| The prompts, their order and rotation | `src/modes/progressions/jamPrompts.ts`, tests beside it |
| The cue and the prompt for this beat | `src/modes/progressions/useJamCoach.ts` |
| A window for each step of a pass | `windowsForPass` in `useProgressionViews.ts` |
| The rings | `targets` in `src/components/Fretboard.tsx` and its CSS (shared: one prop, one block) |
| The prompt line | `prompt` in `FormStrip.tsx` and its CSS; `ProgressionsDeck.tsx` |
| Targets and Prompts options | `playOptions.ts`, `usePlayOptions.ts`, `PlayControl.tsx` (shared: two groups, paired rows, one hint line) |
| Wiring | `App.tsx` (shared: one hook call, two props) |
