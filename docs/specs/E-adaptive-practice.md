# E: Practice that adapts

**Package:** E in `docs/ROADMAP.md`.
**Status:** built 2026-11-14 on branch `claude/practice-e-63ba7d` (cut from `vibrato-next`). Not merged. Open: the owner plays it for a week and checks the decisions at the end of this file.
**Code:** `src/lib/practice/plan.ts` (the rules, no music library, no clock), `src/lib/practice/board.ts` (boxes and chord tones on the neck), `src/components/PracticeSession.tsx`.

## Why

The session was the same every day: A-or-whatever minor, the lowest pentatonic box, ♭3 / 5 / ♭7, i–iv–V. The ratings were saved and never read. A player who did it daily stopped learning from it within a week.

## What the evidence says

It is thin, and none of it tested ten-minute guitar sessions. What there is:

- **Mixing tasks inside a session.** Carter and Grahn (2016): ten advanced clarinettists practised some pieces in 12-minute blocks and others in interleaved 3-minute slots. Where the raters heard a difference, the interleaved pieces were rated better, but the raters did not agree with each other, and the players reported better focus and goal-setting when interleaving. Abushanab and Bishara (2013): 25 pianists played melodies faster during fixed-order practice and slower on a test two days later than melodies practised in random order, and wrongly predicted the opposite. In motor learning generally the effect is real in the lab and weak or disputed in applied practice (Czyż and colleagues, 2024: transfer favours random practice, SMD 0.55; retention benefit "almost negligible" in applied settings; Ammar and colleagues, 2023, dispute it for sport).
- **Ear.** Wong, Chen and Lim (2021): novices learned to name melodic intervals better when the intervals were interleaved than when each was drilled alone, unless they had reference songs to lean on. Most of them believed the blocked drill had worked better. Interleaving helps because it puts similar things side by side.
- **Spacing.** Simmons (2011): 29 musicians learned a 9-note keyboard sequence in three sessions 5 minutes, 6 hours or 24 hours apart. Only the 24-hour group gained accuracy between sessions. The study had no later retention test.
- **Difficulty.** Guadagnoli and Lee (2004), the challenge-point framework: a task teaches most when it is hard enough to produce errors the learner can use, and that point moves as the learner improves. Wilson and colleagues (2019) derive an optimal success rate near 85% for model learners; that it holds for people is not shown.
- **Self-judgment.** In both music studies above, how well practice felt was a poor guide to what was learned.

What I take from it:

1. The session already interleaves: four tasks in slots of 2 to 3 minutes is the interleaved arm of Carter and Grahn. Keep that shape. Do not merge blocks or lengthen them.
2. What was missing is change from day to day, with each thing coming back after a gap. A cycle does both.
3. "Marked hard comes back tomorrow" matches the one interval with evidence for accuracy (a day, with a night's sleep in it).
4. A rating alone should not promote anything. Where there is a score (the Ear block), the score decides. Where there is only a rating (the three blocks on the neck), "easy" lets the cycle carry on, and nothing is ever retired: every box returns five sessions later in a new key.
5. Ear sets should put neighbours together (♭3 with 3, ♭5 with 5), because telling neighbours apart is the skill.
6. The thresholds below are judgment, not findings.

## The rules

A **day** is a local calendar day. The plan is a pure function of the day and the saved history (`planFor(day, history)`): no randomness, and the same answer all day. Sessions done today do not change today's plan; they shape tomorrow's. It reads only the last day practised (see Saved data), so it does not matter that history keeps 100 sessions.

### 1. One box a day, for three blocks

Roots, Scale and Changes all happen in today's box: find the root and 5th there, run the scale there, play the chord tones there. The fourth block, Ear, has its own track (rule 5).

Boxes are numbered by shape, 1 to 5, the usual minor-pentatonic numbering: box 1 has the minor root under the first finger on the low E string (A minor: frets 5–8), box 2 starts on the ♭3, box 3 on the 4, box 4 on the 5, box 5 on the ♭7. Before this package Practice used "the lowest box on the neck", which is a different shape in every key.

### 2. The box moves on when it was finished and nothing was marked hard

- The box **moves on** (1 → 2 → … → 5 → 1) when a session that day was finished in full and none of Roots, Scale or Changes was rated "Revisit this". "Felt clean", "Getting there" and no rating all move on.
- It **comes back** at the next practice if one of those three blocks was rated "Revisit this", or if no session was finished that day. The plan names the block.
- **Three days is the limit.** After three finished days in a row on one box it moves on whatever the rating, and returns next lap. Grinding one shape for a week is how people stop practising.
- With two sessions in a day, the last finished one decides.
- The cycle counts **practice days, not calendar days**. A missed Tuesday does not skip a box.

### 3. A lap is five boxes in one key; each lap changes the key

- Lap 1: A minor. Lap 2: its relative major, C major: **the same five shapes at the same frets, heard from a new home note**. The fingers repeat last lap's work; the roots, the ear and the changes are new. Lap 3: up a fourth to D minor. Lap 4: F major. And so on round the circle of fourths: 24 laps, 24 keys.
- In a major key the boxes keep their minor numbers, so C major's box 1 is A minor's box 1.
- The key changes about once a week, not every day. Inside a lap each new box shares a row of notes with the last one, in the same key, and that link is the point of learning the boxes in order. Changing key and box together would hide it.
- Since 2026-11-21 the app has one key, and Practice plays in it: the plan's key is a suggestion. When the app is in another key, the plan's line offers "Use the plan's key", and the key menu in the headline keeps "Today's plan". Changing the key in Practice changes it for every mode. A different key still counts for the box.
- In a major key the Changes block is I–IV–V. The hint about the V chord's 3rd holds in both: neither pentatonic has it.
- Keys are named the way they are written: the sixth lap is B♭ major, not A# major, and its chords are B♭, E♭ and F.

### 4. A week away rewinds one step

If the last practice was 7 or more days ago, today repeats the last box and the last ear set, whatever the ratings said, and carries on from there.

### 5. Ear: a ladder, three intervals a day, the score decides

- **The ladder** (the order intervals join): ♭3, 5, ♭7 → 3 → ♭5 (tritone) → 4 → 6 → 2 → 7. That is every note of both pentatonics, the blue note and the major 7th. ♭2 and ♭6 are left out.
- **Today's set is three neighbours** from the unlocked intervals, in pitch order, wrapping round. A new interval arrives with its two neighbours: 3 comes as ♭3 / 3 / 5, the tritone as 3 / ♭5 / 5, the 6th as 5 / 6 / ♭7.
- After a day's Ear block (first answers only, all sessions that day):
  - fewer than 6 answers: the same set next time;
  - rated "Revisit this", or under 70% right: the same set next time;
  - 90% or better and not rated "Revisit this": the next interval on the ladder joins; once the ladder is complete, the set rotates;
  - in between: the set rotates to the next three neighbours, and nothing new joins.
- So "Felt clean" with 6 of 10 does not move on, and "Revisit this" with 12 of 12 stays. The rating can hold a set back; only the score brings in something new.
- The ear track has no three-day limit: there the difficulty is measured, not felt.
- Fixed here: the drill never asked the same interval twice running, so after the first question the answer was one of two. It now draws freely, with at most two of the same in a row.

**Changed on 2026-11-21, after the owner's first sessions.** Three things about the Ear block, and one about every block:

- **A round, not a clock.** The block is ten first answers (`EAR_ROUND`), then it ends. The owner: two minutes "felt way too long", and a tally that keeps climbing "just fills the time up". Each answer is still marked at once, because the correction is what teaches; the score is shown at the end. Ten is the fewest where the rules above mean something: fewer than six answers do not count, and 9 in 10 is the score that brings in an interval.
- **The round asks every unlocked interval.** "Today's set is three neighbours" stays, but as the three asked twice as often, not the only three. The owner found three choices "awfully repetitive". Neighbours still meet, since the newest interval and its neighbours are the favoured three.
- **The ladder can start higher.** The player may open 5, 7 or all 9 intervals on the plan. The setting only raises the stage, and the session saves it, so the score rules carry on from there. A returning player should not need nine good days to be asked a major sixth.
- **Lengths.** The three blocks on the clock can be 1, 2, 3 or 5 minutes, and a minute can be added while playing. A session is full when each block ran the length it was given and the round was answered. The box rule (rule 2) is unchanged: it moves on after a full session.

### 6. Changes: one window

The neck shows today's box, dimmed, and on top of it the current chord's tones (root, 3rd, 5th) inside the box's frets. The window does not move when the chord changes. Before, each chord jumped to its own lowest shape. The backing guitar strums each chord's full shape nearest the window, so it sounds like a chord and stays in the same part of the neck.

### 7. The plan says why

Under the headline, one line: why this box, why these intervals. Each plan card names today's material (the box and its frets, the three intervals). The finished screen gives next time's line, so the player sees what a rating did. Examples:

- `Box 1 opens a lap of the five boxes in A minor. Ear: ♭3, 5 and ♭7, the minor 7th chord.`
- `Box 3: you finished box 2 last time. Ear: the major 3rd joins, after 11 of 12.`
- `Box 2 again: you marked Changes “Revisit this”. Ear: the same three, after 6 of 10; 9 in 10 moves on.`
- `New lap: C major is the same five shapes as A minor, heard from C. Box 1. Ear: 3, ♭5 and 5, next in the rotation.`
- `9 days away: box 2 again to warm back in. Ear: the last set again.`

## Saved data

A session now stores what it practised and where the two cycles stood that day: `plan: { box, quality, ear, track: { lap, box, streak, stage, offset } }`, beside the root it already had. Tomorrow's plan is the last practised day's `track` plus how that day went, so nothing has to be replayed and nothing is lost when old sessions drop off the end of the history. A plan whose parts disagree with each other is rejected on load, like any other malformed session.

The field is optional, so sessions saved before this package still load. They count as "♭3, 5, ♭7 in minor, box unknown, at the start of both cycles": their ear score can unlock the major 3rd, and they do not move the box. Ear attempts may now hold any interval from 1 to 11 semitones.

## Tests

`src/lib/practice/plan.test.ts` simulates days: a clean lap, hard ratings, the three-day limit, unfinished sessions, skipped days, a week away, the ear ladder from the first day to the last interval, old sessions, a history cut down to one session, and a 120-day mixed run that checks every plan is valid and every hard box comes back. `src/lib/practice/board.test.ts` checks the box numbering and the Changes window in every key. `scripts/check-layout.cjs` gained five Practice states with a plan (the longest plan line, and a late-ladder session in B♭ major).

## Decisions to check

1. **Practice days, not calendar days.** The brief said "deterministic by date". The plan is deterministic given the date and the history, but the cycle steps per practice day, so nothing is skipped by a missed day.
2. **A key lasts a lap (about a week), then relative major, then up a fourth.** The alternative is a new key every day. I chose the lap because the boxes link to each other inside one key, and because the relative major gives a second pass over the same frets with new ears. Say if you would rather have parallel major (A minor then A major): same home note, new shapes.
3. **Practice follows the plan's key, not the key set elsewhere in the app.** The menu overrides it for today only. *Reversed by the owner on 2026-11-21:* the app has one key, Practice plays in it, and the plan's key is a suggestion ("Use the plan's key" on the plan page). The cost is that the weekly change of key now happens only when the player takes the suggestion.
4. **"Getting there" moves on**, like "Felt clean". Only "Revisit this" brings a box back.
5. **Three days on one box, then on.**
6. **Ear thresholds:** 90% to bring in a new interval, under 70% to repeat, at least 6 answers to count. And the rating cannot promote.
7. **Ear ladder order**, and stopping at nine intervals.
8. **Always three choices.** A harder review day with four or five could come later.
9. **Tempo does not adapt.** A box that comes back is a natural place to suggest a slower tempo; not built.
10. **The Changes backing** is still a strummed guitar and still i–iv–V. Using the jam loop's band here belongs with P.
