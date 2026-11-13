# P2: the jam loop

**Package:** P2 in `docs/ROADMAP.md` (Progressions: the improvising workshop).
**Status:** spec written 2026-11-12. Built and merged into `vibrato-next` 2026-11-12. The tests listed under "Tests" were added 2026-11-13. Open: the owner's play-along.
**Builds on:** P1 (the library) and L (the Play control), both merged.
**Unlocks:** P3 (targets on the neck, lenses) and P4 (prompts). This spec says what P2 must expose for them.

## Why

The owner wants to "solo over chord progressions and become a stronger improviser" (see "The owner as a player" in the roadmap). The library tells them what to aim for; the jam loop is the band that lets them try it. It turns any library entry into a backing track that loops until they stop it, at their tempo, in their key, while the screen follows the harmony.

Keep it a practice tool, not a production: clear time, clear harmony, nothing that competes with the player's own guitar.

## What the player does

1. In Progressions, choose an entry in the library (side panel) or in the deck's picker.
2. Press Play, or Space. One bar of count-in plays (four clicks, shown as 1 2 3 4).
3. The progression loops: one step is one bar of 4/4.
4. While it plays:
   - the deck's chord stepper shows the current chord;
   - four beat dots and "bar 3 / 12" follow the music;
   - the current chord is marked in the side panel's chord diagrams;
   - the fretboard shows the current chord in the current position, as stepping through a progression does today.
5. Press Stop, or Space. The loop stops at once, and the neck returns to the chord that was selected before Play.

Choosing another entry, changing key, or leaving Progressions stops the loop. The player presses Play again. That is simpler and more predictable than switching mid-bar.

## What the backing plays

Every bar has three layers. All of them go through the existing volume, room and limiter chain.

**1. Bass.**
- One note on beats 1 and 3: the chord's root, or the step's `bass` when it has one. The Lydian float's II/I plays the key note under the D triad, which fixes P1's "plain II triad" limitation.
- Register: the octave of that pitch class that falls in MIDI 40–52 (E2–E3).
- Use the guitar sampler's low strings. A separate bass instrument is not needed yet.

**2. Chords, chosen in the Play menu under "Backing":**
- **Strum** (default): the guitar strums the voicing shown in the side panel for that chord, so it follows the position bar like the diagrams do. It uses the engine's existing directional strum.
  - *Straight feel:* down-strums on beats 1, 2, 3 and 4. Beat 1 is accented (velocity about 1.0), the others softer (about 0.7).
  - *Swing feel:* the same down-strums, plus a light up-strum (about 0.45) on the swung "and" of each beat, two thirds of the way through it.
- **Pad:** a new sustained voice holding the chord for the whole bar.
  - Notes: the chord tones (triad, or all four for a seventh chord) in MIDI 52–67.
  - Voice-leading: each chord takes the inversion with the smallest total movement from the previous one.
  - Sound: a soft saw or triangle, attack about 0.3 s, release about 0.8 s, low-pass around 1.2 kHz, light chorus, sitting below the guitar's level.
  - Put the pad in `src/lib/audio/` as a reusable voice. Package M's Scales drone uses it next.

**3. Click** (Play menu, off by default): the engine's existing click. High on beat 1, low on 2–4. The count-in always clicks, even with Click off.

**Feel.** Add `feel?: 'straight' | 'swing'` to library entries, defaulting to straight. Set swing on:
- the 12-bar blues and the minor blues;
- ii–V–I and the turnaround;
- Backdoor and Tritone sub.

The Play menu's Feel choice starts at the entry's feel and can override it.

**Loop** (Play menu, on by default here): with Loop off, the progression plays once and stops.

## The Progressions Play menu

Four groups, in this order: **Backing** (Strum, Pad), **Feel** (Straight, Swing), **Click** (Off, On), **Loop** (Off, On).

- Remove "Strum or Arpeggio" from Progressions. Arpeggiating a progression isn't useful for jamming, and Chords mode keeps it.
- Keep the existing "Move along the neck" (`ladder`) working inside the loop exactly as it behaves today. P3's Climb lens will replace it.
- Each group gets a one-line hint where the menu shows hints.

## Timing

- Use Tone's Transport, as `playPattern` does. Schedule one bar at a time (for example with `scheduleRepeat` per bar), so a change of backing, feel or click applies from the next bar.
  - `playPattern` plays a fixed-length pattern, so write a looping jam scheduler beside it rather than bending it.
- Tempo comes from Settings (`src/lib/audio/tempo.ts`). A tempo change while playing applies right away, with no glitch and no restart.
- Update the screen with `Tone.Draw` at the scheduled audio time, so the beat dots and chord marks land with the sound and don't drift.
- If the guitar samples aren't loaded, Play waits for them, as elsewhere. While muted, Play stays disabled with its tooltip, as today.

## What P3 and P4 need from P2

Expose the loop's state from one hook (for example `useJamLoop` in `src/modes/progressions/`) and read it everywhere:

| Field | Meaning |
|---|---|
| `playing` | the loop is running (count-in included) |
| `countIn` | true during the count-in bar |
| `stepIndex` | the step (bar) sounding now |
| `nextStepIndex` | the step after it, wrapping to 0 at the end of a pass |
| `beat` | 0–3 within the bar |
| `changeComing` | true on the bar before a change of chord (root, quality or bass differ). In the 12-bar blues, bars 1 to 3 are all I7, so it is false until bar 4. |
| `pass` | how many times round the loop, from 0. P4 changes its prompt when this changes. |

P3 shows the next chord's target notes on the last beat of a bar where `changeComing` is true.

## Suggested code shape

| Piece | Where | Role |
|---|---|---|
| `buildJamBar(step, options)` | `src/lib/audio/jamSchedule.ts` | Pure function: the events of one bar (bass, strums, pad, click) with their beat times. Easy to test. |
| `PadVoice` | `src/lib/audio/padVoice.ts` | The sustained voice and its voice-leading. |
| `useJamLoop` | `src/modes/progressions/useJamLoop.ts` | Starts and stops the Transport, schedules bars, exposes the state above. |
| Beat dots, bar counter, current-chord mark | Progressions deck and panel | Read `useJamLoop`. |

## Tests

- `buildJamBar` for both feels:
  - straight: four strums on beats 0–3, with beat 0 accented;
  - swing: an up-strum at beat + 2/3 after each down-strum;
  - bass on beats 0 and 2, inside MIDI 40–52;
  - a step with `bass` plays that bass, not the root.
- Pad voice-leading: in the turnaround and the 12-bar blues, every pad chord stays in MIDI 52–67, and no voice moves more than a 4th between chords.
- `changeComing` and `nextStepIndex` over a 12-bar blues and a four-bar loop, including the wrap from the last bar to the first.
- Library: every entry's `feel` is valid, and the six entries listed above default to swing.

## Done when

- [x] Any library entry plays with one bar of count-in, then loops until stopped, at the Settings tempo.
- [x] The current chord shows in the deck and the side panel, and the beat dots and bar counter follow the sound. In a hidden Electron run at 240 BPM, the step index after 16 bars matches the Transport position.
- [x] Strum and Pad both work. The bass plays the root, or the slash bass. Swing entries swing by default, and the menu can override the feel.
- [x] Stop, Space, choosing another entry, changing key and leaving the mode all stop the loop cleanly. The neck returns to the chord selected before Play.
- [x] A tempo change while playing takes effect without a glitch.
- [x] Tests, lint and `tsc` pass, and no page scrolls at 1440×900, 1280×720 or 960×640.
- [ ] The owner has played along with at least the 12-bar blues and the Andalusian cadence and says it feels like a band, not a metronome.

## After the first play-along (P2.1)

**What the owner heard (2026-11-13):** the progressions sound nice and the guitar is clear, but no bass and no pad can be heard. Strumming the same chord on every beat sounds like an echo. The owner wants to choose how long a chord is held: the whole bar, or split.

**Why the bass vanished.** This spec put the bass on the guitar sampler in MIDI 40–52. That is the register of the strummed shape's own lowest notes, in the same sound: under C7 (x32310) the bass C3 is the very note the A string plays. It doubled the guitar instead of sitting under it. The fix is a separate voice, an octave lower.

**1. A bass voice.**
- `BassVoice` in `src/lib/audio/bassVoice.ts`, beside `PadVoice`, into the same chain.
- Register: the octave of the pitch class in MIDI 28–39 (E1–D♯2), always below the guitar's low E.
- Sound: a round synth bass that laptop speakers still carry, so its harmonics matter more than its lowest partial. A sawtooth with a triangle at the same pitch, low-pass about 700 Hz with a short filter envelope. Attack about 5 ms, decay 0.25 s, sustain 0.5, release 0.15 s. One note at a time.
- Notes: the root on beat 1 and the chord's own 5th on beat 3 (a diminished chord's ♭5), both in MIDI 28–39. A slash chord plays its bass on both beats, so the Lydian float keeps its pedal.
- With Swing, a light pickup (velocity about 0.6) on the swung "and" of beat 4, a half step below the next bar's bass note. It may dip to MIDI 27.
- Each note holds until the next one starts.

**2. How long the guitar holds the chord.** Replace Backing (Strum, Pad) with two groups.
- **Guitar:** Off, Whole, Half, Quarter.
  - Whole: one down-strum on beat 1 that rings through the bar.
  - Half: down-strums on beats 1 and 3, each ringing two beats.
  - Quarter: down-strums on every beat (today's sound). With Swing, the swung up-strums too.
  - A new strum damps the one before it within about 60 ms, instead of letting it fade over the sample's release, so repeated strums stop smearing into an echo. Quarter strums last about 0.8 of a beat.
  - Accents: beat 1 at 1.0, beat 3 at 0.8 in Half, other beats 0.7, up-strums 0.45.
- **Pad:** Off, On. It sounds under the guitar, or alone when Guitar is Off.
- Defaults: Guitar Half, Pad On, Feel from the entry, Click Off, Loop On. A saved `backing` is dropped: `'pad'` becomes Guitar Off with Pad On, anything else takes the defaults.
- Menu order: Guitar, Pad, Feel, Click, Loop, then "Move along the neck". Feel's hint: "Swing adds a bass pickup into each bar, and swung up-strums on quarters."

**3. Levels: measure, then set.** In a hidden Electron run at 90 BPM, put a meter on the engine's output and play two bars of the 12-bar blues with each layer alone: guitar on Quarter, bass, pad. Set the levels so the bass peaks about 3 dB under the guitar and the pad about 6 dB under it (±2 dB), and all three together peak below the limiter's −2 dB. Write the measured numbers here.

**Measured levels (2026-11-13).** Hidden Electron, 90 BPM, steel acoustic at the default volume (0.75), the first four bars of a C blues (C7, C7, F7, F7), two bars measured after the count-in with an AudioWorklet meter on the engine's output (after the limiter). Each layer alone, then all three:

| Layer | Peak | RMS |
|---|---|---|
| Guitar, Quarter | −5.0 dBFS | −21.0 dBFS |
| Bass | −8.0 dBFS (3.0 under the guitar) | −18.4 dBFS |
| Pad | −10.8 dBFS (5.8 under the guitar) | −23.3 dBFS |
| All three | −2.6 dBFS | −15.7 dBFS |

To make room, the guitar's jam strums are scaled to 0.6 of their old gain (`JAM_GUITAR_LEVEL` in `engine.ts`, applied after the sample layer is chosen, so the timbre is unchanged). Before that the guitar alone peaked at −0.7 dBFS, above the limiter's −2 dB, so no bass or pad could have fit. The bass voice sits at −7.5 dB and the pad at −17 dB. The bass is louder than the guitar by RMS (it is sustained, the guitar decays), so if it is too forward by ear, lower `BassVoice`'s default volume.

**Tests (P2.1):**
- `buildJamBar` for each guitar rhythm: Whole is one strum at beat 0, Half is strums at 0 and 2, Quarter is 0–3 plus the swung up-strums with Swing. Guitar Off has no strums. Pad On adds one pad event, Pad Off none.
- Bass, in all 12 keys: every note inside MIDI 27–39; the root on beat 0 and the chord's 5th on beat 2; a slash chord's bass on both. Swing adds one pickup at 3 + 2/3, a half step below the next bar's bass; Straight has none.
- The pin test: `BASS_LOW` is 28.

**Done when (P2.1):**
- [ ] The bass and the pad can each be heard clearly in the mix, and the measured levels are written above.
- [ ] Whole, Half and Quarter sound as described, and Quarter no longer smears.
- [ ] Swing can be heard in every rhythm, through the bass pickup.
- [x] Tests, lint and `tsc` pass.
- [ ] The owner plays along again and hears the bass and the pad, and the rhythms feel right.

## Out of scope here

- Targets on the neck, lenses (whole neck, region, one string, climb) and prompts: P3 and P4.
- Drums, a real bass instrument, other time signatures, song form (P5).
- Recording the player.
