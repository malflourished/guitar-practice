# S2: drums for the jam loop

**Package:** S2 (sounds we synthesize ourselves), after S1 (the modelled bass).
**Status:** built 2026-11-13 on `claude/sound-s2-drums-e3cf00`, not merged. The Drums fader starts at off, so the drums change nothing until the owner has listened in the sound lab and turned it up. One thing does change for everyone at merge: the whole jam is 3 dB quieter, to give the mix the headroom it had lost (see "Levels").
**Research behind it:** [docs/sound/drums.md](../sound/drums.md).

## Why

The jam loop has a guitar, a bass and a pad, and no time feel: P2's last open box is that it should "feel like a band, not a metronome". The owner asked early on for "drum kits". Drums carry the feel, so swing has to swing, and they mark the form, which the owner lost track of at slow tempos (P2.2).

Same rules as S1: our own DSP, no third-party synthesis code, no sample packs. Tone.js still does the scheduling and routing.

## How to hear it

1. Run the app and press **\\** (backslash). The sound lab opens on the left, on its **Drums** page. (**Bass** is S1's page, unchanged.)
2. Press a groove: **Straight 8ths**, **Shuffle**, **Swing** or **16ths**. It loops four bars, with a fill in bar 4 and the crash at the top. Tick **Bass and pad** to hear it under a 12-bar blues in A instead, with the jam loop's own bass and pad.
3. Flip between **A** (acoustic), **B** (machine) and **C** (brushes) with the three buttons, or step through them with **[** and **]**. All three kits play all the time and only the switch moves, so there is no gap and no restart.
4. The small pads under the grooves play one stroke each: kick, snare, ghost note, rim, the three hi-hat sounds, ride, crash, toms, a brush tap and a sweep.
5. For the real mix, open Progressions and raise the new **Drums** fader, beside Guitar, Bass and Pad. The kit chosen in the lab is the kit the jam plays, saved on this computer (`vibrato:drums`).

Keys while the Drums page is open:

| Key | Does |
|---|---|
| **\\** | opens and closes the lab |
| **[** and **]** | previous and next kit (A, B, C) |
| **1** to **4** | play Straight 8ths, Shuffle, Swing, 16ths |
| **0** | stop |

What to listen for:

- **Does it feel played?** Turn **Humanize** to 0 and back to 50. At 0 every stroke is exactly on the grid at its written strength.
- **The hi-hat's two hands.** In Straight 8ths the strokes on the beat are fuller and longer than the ones between, not only louder.
- **Ghost notes.** One leads into beat 3 of every other bar. On kit A it is nearly all wires. Compare the **Snare** and **Ghost** pads.
- **The swing.** With **Bass and pad** on, the shuffle's last hi-hat note and the bass's pickup land together. They use the same number.
- **The top of the form.** A fill, then the crash with the kick on beat 1. In Straight 8ths, bar 4 also opens the hi-hat on its last eighth and the next downbeat chokes it.
- **The kick on laptop speakers.** A is a thud with a click. B is a boom whose pitch falls. Both are built to be heard above 100 Hz.
- **The metal.** This is the part synthesis does worst. Does A's crash read as a cymbal or as hiss? Does the ride's wash build as it is played? B's cymbals are meant to sound like a drum machine.
- **The level.** In Progressions, is 0 dB on the Drums fader the right balance against the guitar and bass? Swing sits lower than the other grooves on purpose.

**Copy settings** puts the kit and its dials on the clipboard as one line of text, to paste back to a session.

## What was built

| Piece | Where | Role |
|---|---|---|
| Reusable DSP | `src/lib/audio/synth/dsp/modalBank.ts`, `room.ts`; additions to `biquad.ts`, `random.ts`, `analysis.ts` | A bank of resonant modes, a small stereo room, a band-pass, block noise, and two measurement helpers for tests |
| The voices | `src/lib/audio/synth/drums/membranes.ts`, `cymbals.ts`, `machine.ts` | The acoustic drums, the acoustic metal, and the machine kit. Pure TypeScript with no audio API |
| The kits | `.../drums/kits.ts`, `drumParams.ts` | Which voices a kit has, where each sits between the speakers, its send to the room, and the thirteen dials |
| The instrument | `.../drums/drumSynth.ts` | `DrumSynth`: strokes placed to the sample, the bus, the room. Renders in Node, in the lab's measurement and in the worklet |
| Parts | `.../drums/drumPattern.ts` | Renders a groove through a kit off-line, and measures it |
| Worklet and voice | `.../drums/drumProcessor.ts`, `drumMessages.ts`, `drumKitVoice.ts` | The audio-thread wrapper, and `DrumKitVoice` with `hit`, `stop`, `setKit`, `setParams`, `setTrim` and `dispose` |
| Settings | `.../drums/drumSettings.ts` | Which kit the jam plays, each kit's dials and level trim, and Humanize. One saved copy, read by the engine and changed by the lab |
| Grooves | `src/lib/audio/drumGrooves.ts` | Four grooves, fills, the crash, the phrase rule and the humanizing, as plain data like `buildJamBar` |
| The grid | `src/lib/audio/jamGrid.ts` | `BEATS_PER_BAR` and `SWING_OFFSET`, moved here so the score and the grooves can share them. `jamSchedule.ts` still exports both |
| Sound lab | `src/lab/DrumLab.tsx`, `drumLabAudio.ts`; `SoundLabPanel.tsx` is now a shell with a page per instrument, and S1's panel moved to `BassLab.tsx` unchanged | The hidden A/B/C panel |

Files that already existed and were changed:

- `src/lib/audio/engine.ts`: a fourth gain node (`jamDrums`, straight into the output), the kit loaded on demand, drum events played, and the plain cymbal left out while the kit plays. Also `JAM_HEADROOM`: 3 dB off every jam layer (see "Levels").
- `src/lib/audio/jamSchedule.ts`: a `drum` event, and `drums` in the bar's options.
- `src/lib/audio/jamMix.ts`: a `drums` layer. It is optional in a mix and in the gains, so every call written for three layers means what it meant.
- `src/lib/music/progressionLibrary.ts`: a `groove` on eight entries, and `progressionGroove(entry, feel)`.
- `src/hooks/usePlayOptions.ts`, `usePlayback.ts`, `src/modes/progressions/useJamLoop.ts`, `MixFaders.tsx`: the fourth fader, its saved level (`vibrato:play-drums-level`, off by default), and the groove for the feel now chosen.

All 408 existing tests still pass. Three expectations in `engine.jam.test.ts` were updated for the 3 dB of headroom (the layer gains it pins, and the cymbal's stroke). No other existing test was edited.

## The kits

One signal path for all three:

```
drums (kick, snare, toms, rim, brush) ─► soft clipper ─┐
metal (hi-hats, ride, crash) ──────────────────────────┼─► kit gain ─► 30 Hz high-pass ─► ceiling ─► out
every voice's send ─► room ────────────────────────────┘
```

- **Every piece is one object that keeps its state.** A stroke adds energy to a drum or cymbal that may still be ringing. There is no pool of voices to run out of.
- **Velocity changes the sound, not only the level.** Each piece below says how.
- **No two strokes are the same.** Strike point, hardness and level move by a few percent (Variation), and every noise source is fresh. Pitch and timing never vary inside the synth: timing belongs to the groove.
- **Stereo**, as the drummer sits: hi-hat to the left, ride to the right, toms from left to right as they get lower, kick and snare in the middle.

### A: acoustic

| Piece | How it is made |
|---|---|
| Kick | Five modes of one head: the three a centre stroke excites (1, 2.13 and 3.27 times Kick tune, 58 Hz) and two short "slap" modes above them that small speakers can carry. A hard stroke stretches the head, so the pitch starts up to 37% sharp and falls back in about 50 ms. A beater click of filtered noise, brighter for a harder stroke |
| Snare | Six head modes from Snare tune (192 Hz), dying in about a tenth of a second, and the wires: noise from 1.1 kHz up, switched on and off at the head's own frequency while it swings widely, which is the buzz in a snare. The head answers velocity steeply and the wires gently, so a ghost note is mostly wires. A harder stroke throws the wires for longer and makes them brighter |
| Toms | Four modes each at 186, 141 and 98 Hz, with the most audible pitch fall in the kit |
| Cross-stick | Five short modes of the stick and rim (215 Hz to 2.9 kHz) |
| Hi-hats | One pair of cymbals: 30 modes from 520 Hz to 11 kHz, noise above 7 kHz, and a foot. Closed, open and foot strokes all play the same metal. What differs is how hard the two cymbals are pressed together, so closing an open hat chokes it, as on a real pair |
| Ride | 38 modes and 7 short-lived "ping" partials. Each stroke is a ping, and the strokes build a wash, because the ride is one object that keeps ringing |
| Crash | 42 modes that ring briefly, so each is a band of noise more than a tone. The sound blooms 10 to 60 ms after the stroke, and its top fades first |
| Room | Eight delay lines mixed into each other, 0.42 s long, a different tail in each ear |

The cymbals are "tones plus noise" with three additions (see the research note for why):

- After a stroke, noise keeps exciting the modes under an envelope that can bloom. Each mode turns it into a narrow, fluttering band.
- That noise is low-passed, and the low-pass falls as the cymbal dies, so the top goes first.
- Plain noise fills the gaps between the few dozen partials, and the top of the spectrum above them.

### B: machine

A drum machine in the early-1980s analogue tradition. The tunings and envelopes are our own, not a copy of any one machine.

| Piece | How it is made |
|---|---|
| Kick | One tone at Kick tune (50 Hz) that starts more than an octave above and is swept down in the first few hundredths of a second, then sags a little as it dies. A short click. A soft clipper that an accent drives harder |
| Snare | Two swept tones at Snare tune (178 Hz) and 1.83 times it, and a burst of noise from 1.7 kHz up |
| Toms | A tone that falls most of an octave as it sounds, at 212, 152 and 104 Hz |
| Rim | Two very short tones at 1.73 kHz and 520 Hz |
| All metal | Six square waves at 211, 298, 367, 439, 547 and 811 Hz, heard through band-passes at 3.4 and 7.3 kHz. Hi-hat, ride and crash differ in their envelopes and high-pass. A new hi-hat stroke replaces the old one, so a closed hat chokes an open one |
| Gated burst | When the snare or a tom is struck, a dense burst of noise (420 Hz to 5 kHz, different in each ear) holds for about 130 ms and is then cut off. Soft strokes do not open it |

### C: brushes

The acoustic kit played with wire brushes.

- **A sweep** is a hiss whose loudness and brightness follow the speed of the hand: a band of noise moving between 1.7 and 4.6 kHz.
- **A tap** is the snare struck softly four times over six milliseconds, with no stick click, and wires that swell in.
- Toms lose their click. Metal is played lighter.
- In the grooves, taps take the sticks' rhythm on the snare, a backbeat becomes an accented tap, the cross-stick is dropped (that hand is sweeping), and a sweep on every beat keeps the hiss going, leaning on 2 and 4.

## The controls

Thirteen dials, the same for every kit, each kit with its own defaults. They apply from the next stroke; Room and Drive at once.

| Control | Range | A | B | C | What it does |
|---|---|---|---|---|---|
| Kick tune | 36 to 90 Hz | 58 | 50 | 62 | The kick's resting pitch |
| Kick decay | 0.1 to 2 s | 0.32 | 0.5 | 0.38 | Damped thud to open boom |
| Kick punch | 0 to 100 | 50 | 60 | 25 | The beater's click and how far the pitch drops |
| Snare tune | 130 to 280 Hz | 192 | 178 | 205 | The head's lowest pitch |
| Snares | 0 to 100 | 55 | 60 | 50 | How much of the sound is wires |
| Snare decay | 0.06 to 0.6 s | 0.24 | 0.2 | 0.2 | How long the wires rattle |
| Hat tone | 0 to 100 | 50 | 55 | 40 | Dark and heavy to thin and bright |
| Hat length | 0 to 100 | 50 | 40 | 50 | Tight to loose |
| Cymbal tone | 0 to 100 | 50 | 50 | 42 | Ride and crash brightness |
| Cymbal ring | 0.4 to 5 s | 2.2 | 1.4 | 2.6 | How long the crash rings; the ride follows it |
| Room | 0 to 100 | 35 | 50 | 45 | The room around the kit. On B it is mostly the gated burst |
| Drive | 0 to 100 | 30 | 50 | 15 | How hard the drums hit the bus's soft clipper |
| Variation | 0 to 100 | 60 | 25 | 70 | Difference from one stroke to the next |

One more dial belongs to the grooves, not to a kit: **Humanize** (0 to 100, default 50).

## Grooves and form

| Groove | For | Hi-hat or ride | Kick | Snare |
|---|---|---|---|---|
| Straight 8ths (`rock8`) | Rock and pop entries | Hi-hat on every eighth, strong on the beat and weak between. Every fourth bar opens it on the last eighth | 1 and 3, with a push that alternates between two bars | 2 and 4, and a ghost note into beat 3 of every other bar |
| Shuffle (`shuffle`) | The two blues entries | Hi-hat on every beat and its swung "and" | 1 and 3. Every other bar adds the last swung "and", with the bass's pickup | 2 and 4, and a ghost note after 2 in the other bars |
| Swing (`swing`) | ii–V–I, the turnaround, backdoor, tritone sub | Ride: 1, 2, the swung "and" of 2, 3, 4, the swung "and" of 4, leaning on 2 and 4. Hi-hat foot on 2 and 4 | Feathered on every beat: felt more than heard | Comping over four bars: a cross-stick on 4, a soft snare after 2, a cross-stick on 4, a snare on the last swung "and" |
| 16ths (`pop16`) | City pop, the Dorian vamp | Hi-hat on every sixteenth: strong on the beat, medium on the "and", soft between. Every other bar opens it on the last "and" | 1, the last sixteenth of 2, the "and" of 3 | 2 and 4, with ghost notes |

- **Swing timing.** Every swung note is at `SWING_OFFSET` (two thirds of the beat), the constant the bass and guitar use. A test checks that the bass's pickup, the guitar's up-strum and the drums' swung note are the same number to the last bit.
- **Each entry's groove.** `groove` in the library. Left out, it is the plain groove of the entry's feel: straight eighths, or a shuffle when swung.
- **The Feel menu still switches.** Swing on a straight entry gives it a shuffle. Straight on a swung entry gives it straight eighths.
- **Fills.** The last bar of a phrase ends with a fill of one or two beats: sixteenths on the snare and runs down the toms for the straight grooves, the same shapes in triplets for the shuffle. In Swing a fill is comping turned up, and the ride and the foot keep time under it. Four fills rotate (three in Swing), so no two passes in a row end alike. A form of eight bars or more starts with the two-beat fill.
- **The crash.** On beat 1 of bar 1 from the second phrase, with the kick, in place of that beat's hi-hat or ride. While the kit plays it replaces P2.2's noise cymbal. With the Drums fader at off, or if the kit cannot load, the noise cymbal plays as before.
- **Short forms.** A form of four bars or more is marked on every pass. A two- or three-bar vamp is marked every second pass, and a one-bar loop every fourth, so a fill and a crash never come more often than every four bars. (See "Decisions to check".)
- **A loop about to stop** (Loop off) gets no fill: a fill leads somewhere.

### Humanizing

Each stroke's time is its place on the grid plus an offset computed from where it is in the piece. Nothing is added up from bar to bar, so the drums cannot drift from the Transport, the beat dots or the other layers, however long the loop runs. At Humanize 100 (the default is 50, so half of each):

| Part | Size | Why |
|---|---|---|
| A slow wander shared by the whole kit | up to 3.6 ms either way | Human timing drifts; it does not jitter (see the research) |
| The backbeat, behind the beat | 4.5 ms | Where drummers put it |
| The hi-hat's and ride's off-beats, behind | 1.5 ms | The weak hand |
| Chance, per stroke | up to 1.2 ms | No two strokes alike |
| The kick | half of the above. Beat 1's kick, and the crash, are exactly on the grid | The band needs one fixed point, and the bass lands there too |
| A hard limit | 9 ms either way | A test checks it out to bar 40,000 |

Velocities breathe by up to 10% slowly and 7% by chance.

## In the jam

- **A fourth fader, Drums**, beside Guitar, Bass and Pad, with its own gain node (`jamDrums`) straight into the output. Off, then −24 to +6 dB, as the others. It starts at **off**.
- **The kit loads the first time the fader is up while the jam plays**: at Play, so it is ready by the end of the count-in, or within a bar if the fader is raised mid-loop. Its code is a separate chunk that a player with the fader at off never downloads.
- **At off, nothing is scheduled**, as for the other layers.
- **It follows the lab while it plays**: the kit, its dials and its trim.
- **Stop** fades the kit out in 30 ms.
- Guitar, bass and pad play exactly what they played. Their level, with the drums' and the noise cymbal's, is 3 dB lower (see "Levels").

## Levels

### The kits against each other

Each kit's output gain (`KIT_OUTPUT_GAIN`) is set so that, with its default dials, it measures the same K-weighted loudness on the reference part: four bars of straight eighths at 100 BPM, with the crash at the top and a fill at the end.

| Kit | RMS | Peak | K-weighted loudness |
|---|---|---|---|
| A, acoustic | −24.9 dBFS | −5.6 dBFS | −23.4 LKFS |
| B, machine | −24.5 dBFS | −6.2 dBFS | −23.4 LKFS |
| C, brushes | −25.3 dBFS | −6.2 dBFS | −23.4 LKFS |

(48 kHz, before the master volume.) When a dial moves, the lab renders the reference part through that kit again, measures it, and trims the kit back to the acoustic kit's default loudness. The trim is saved, so the jam plays each kit at the level the lab found. It never lifts a kit's peaks past −1 dBFS. The lab can match by RMS instead.

Swing is about 4 LU quieter than the other grooves on the same kit (A: −27.6 against −23.3 LKFS). That is deliberate: it is a ride and a feathered kick.

### The bus holds the drums' own peaks

- The soft clipper trims the first millisecond of the kick and snare. Drive pushes them further in: at the same loudness, Drive 100 needs at least 1.5 dB less peak than Drive 0.
- The ceiling at the end does nothing to a groove. With every piece struck at full strength at once, at any Drive, the kit stays under −2 dBFS.

### In the app

The app on the dev server in a browser pane, with a worklet meter on its output after the limiter. 90 BPM, 12-bar blues in C, steel acoustic at the default volume (0.75), Quarter rhythm, Swing, the modelled bass (the default since S1), kit A unless said. Peak and RMS in dBFS over the first two bars after the count-in, unless said.

**What was found first.** Before any change to the older layers:

| Faders (guitar / bass / pad / drums) | Peak | RMS |
|---|---|---|
| 0 / off / off / off | −5.2 | −21.0 |
| off / 0 / off / off | −3.0 | −15.9 |
| off / off / 0 / off | −13.5 | −26.4 |
| off / off / off / 0 | −9.1 | −29.2 |
| **0 / 0 / 0 / off (the default mix, no drums)** | **−0.1 to +0.15** (four runs) | −14.7 |
| the same, the whole 12 bars | **+0.6** | −14.3 |
| **0 / 0 / 0 / 0** | **+0.3** | −14.6 |
| the same, the whole 12 bars | **+1.1** | −14.2 |
| 0 / 0 / 0 / +6 | +2.2 | −14.1 |

- **The mix was already past full scale before the drums.** P2.2 measured −1.7 with the synth bass. The modelled bass, which became the default afterwards, peaks 1.3 dB higher (−3.0 against −4.3), as S1's spec said it would.
- **The drums added 0.2 to 0.5 dB** to a mix that had no room.
- **The limiter does not help.** `Tone.Limiter(-2)` is a compressor with a 30 dB soft knee, which is close to a wire at these levels. Anything over full scale is clipped on the way to the speakers.

**What was done.** With the owner's approval (2026-11-13), the whole jam is 3 dB lower: `JAM_HEADROOM` in `engine.ts`, carried by each of the four layer gain nodes on top of its fader, and by the noise cymbal as a softer stroke. The balance between the layers is what it was. Notes and chords outside the jam, and the click, are untouched. 0 dB on a fader still means "the default level".

**Measured after it:**

| Faders (guitar / bass / pad / drums) | Peak | RMS |
|---|---|---|
| 0 / off / off / off | −8.2 | −24.0 |
| off / 0 / off / off | −6.0 | −18.9 |
| off / off / 0 / off | −16.8 | −29.4 |
| off / off / off / 0, kit A | −12.1 | −32.2 |
| 0 / 0 / 0 / off | −3.2 | −17.7 |
| the same, the whole 12 bars | −1.8 | −17.4 |
| **0 / 0 / 0 / 0** | **−2.6** | −17.6 |
| **the same, the whole 12 bars** | **−2.4 and −2.0** (two runs) | −17.2 |
| 0 / 0 / 0 / +3 | −2.4 | −17.5 |
| 0 / 0 / 0 / +6 | −1.5 | −17.2 |
| +3 / +3 / +3 / +3 | +0.1 | −14.4 |

From before the trim, and so 3 dB lower now: kit B alone peaked 1.8 dB under kit A and kit C 0.3 dB over it; the crash at the top of the second pass raised kit A's peak by 0.3 dB; ii–V–I's swing peaked 2 dB under the blues' shuffle, with an RMS 8 dB lower.

What the numbers say:

- **With all four faders at 0 dB the mix now stays under full scale, with about 2 dB to spare.** Over a whole pass its loudest hit lands at the limiter's −2 dB mark, give or take half a decibel from run to run (the bass and the guitar vary from note to note). Over most bars it is well under.
- **The drums at 0 dB peak about 4 dB under the guitar and 6 dB under the bass**, and their average level is far lower, because drums are all peak. They are set to support, not to lead. The fader has 6 dB above that: Drums at +6 with the rest at 0 still stays 1.5 dB under full scale.
- **The top of the faders can still clip.** All four at +3 reaches full scale. That is P2.2's second point, 3 dB better than it was.
- **The jam is 3 dB quieter than it was.** The system volume makes that up.

## Tests

`npm test` runs these with the rest: 528 tests in all, 120 of them new.

- **Every piece of every kit** (`drumSynth.test.ts`): a stroke starts on the exact sample asked for; every piece dies away to exact silence and the kit goes to sleep with only zeros in its memory; harder is louder, and a ghost note sits 15 to 32 dB under a backbeat; a harder stroke has more of its attack in the upper part of its spectrum; the kick and snare are in the middle, the hi-hat left, the ride right.
- **Each instrument:** the drumhead model rings where it is tuned, for as long as asked, and starts sharp when stretched; the kick rests at Kick tune within 3%; Kick decay, Kick punch, Snares, Hat tone, Hat length, Cymbal tone and Cymbal ring do what they say; a closed hat is a tick and an open one rings; closing the hats chokes the ring, with the stick or the foot; the foot alone is darker; the crash blooms after the stroke and starts brighter than it ends; ride strokes build a wash; no cymbal has a note; the machine's metal sits between 2 and 12 kHz; the gated burst holds, then shuts, and a ghost note does not open it; the room is different in each ear and gone within a second; a sweep swells and dies; a brush tap peaks later than a stick.
- **Playing:** the sound is identical however the caller slices its blocks, on every kit; the same seed repeats exactly, and two strokes differ; strokes add to a drum that is still ringing; Stop silences everything within 40 ms with no click and forgets what was to come; a change of kit fades the old one out and plays what follows on the new one.
- **No invalid or denormal numbers:** random strokes at every extreme of every dial, on every kit, at 44.1, 48 and 96 kHz, with the output and all internal memory checked each second, and exact zeros at rest.
- **Any sample rate:** levels within 1.5 dB, lengths and brightness within about 20%, from 44.1 to 96 kHz.
- **Levels:** the three kits within 0.5 LU on the reference part; every piece at once stays under full scale at any Drive.
- **Cost:** ten seconds of the busiest groove in under one second of one core, on every kit; nothing at rest.
- **Grooves** (`drumGrooves.test.ts`): the swung note is the bass's and the guitar's number exactly; swung grooves sit on thirds and straight ones on quarters; each groove's pattern, accents and ghost notes; every pass starts alike; fills take over the end of the bar only, change from pass to pass, and are short; the crash is on beat 1 with the kick in place of the hi-hat or ride; the phrase rule for 12-, 4-, 3-, 2- and 1-bar forms; humanizing is bounded, has not drifted by bar 40,000, leaves beat 1 on the grid, puts the backbeat behind, is correlated from stroke to stroke, and is repeatable; the brushes' mapping; each library entry's groove, and the Feel menu's switch.
- **The engine** (`engineJamDrums.test.ts`, and one test added to `engine.jam.test.ts` for the headroom): the fourth gain node; a mix with no drums in it has none; at off nothing is scheduled and the kit is never loaded; with the fader up each stroke plays at its grid time plus its own offset, and offsets do not add up over 50 bars; the kit's crash replaces the plain cymbal, which comes back when the fader goes off or the kit cannot load; following the lab; Stop.
- **Settings** (`drumSettings.test.ts`) and **the mix** (`jamMixDrums.test.ts`).

Checked in the running app, not by the test suite:

- The worklet loads and plays, in the lab and in the jam, in the Browser pane and in a hidden Electron window (which reports the page as audible). The console shows no errors: only the timing warning from the pad that S1 recorded.
- The lab plays all three kits, switches without a gap, and Stop is silent.
- No page scrolls with four faders at 1440×900, 1280×720 or 960×640, in Vibrato dark, Vibrato light and Scholar (`scripts/check-layout.cjs`: the page is exactly the window's height and nothing is clipped).

## Cost

Measured in Node 22 on the development machine (Apple M4 Max), at 48 kHz, eight bars at 110 BPM with a crash and a fill. A slower laptop might take four or five times as long.

| | Per sample | Share of one core |
|---|---|---|
| Kit A: straight eighths, shuffle | about 125 ns | 0.6% |
| Kit A: sixteenths | 160 ns | 0.8% |
| Kit A: swing (the ride never stops ringing) | 220 ns | 1.1% |
| Kit B, any groove | 80 to 120 ns | 0.4 to 0.6% |
| Kit C, any groove | 125 to 160 ns | 0.6 to 0.8% |
| One ringing cymbal on kit A | 100 to 135 ns | 0.5 to 0.65% |
| The room | about 20 ns | 0.1% |
| Nothing playing | under 1 ns | none |

For scale, one sounding string of the modelled bass is 40 ns. The cymbals are the cost: a bank of forty modes is two multiplications a mode for every sample. The lab runs all three kits at once, three times the above.

(Best of five runs each, on a machine that was busy with other work at the time. An idle machine may do a little better.)

The audio thread allocates nothing for each block it renders. A stroke costs a few small objects when it is scheduled and when it is played, as a note of the modelled bass does.

## Decisions to check

Each of these went beyond the brief, read it loosely, or could not be met. Say if any is wrong.

1. **The jam is 3 dB quieter, for everyone, at merge.** The brief said to keep the guitar, bass and pad exactly as they were, and that all layers together must stay under the limiter. Both could not hold: the three older layers alone already passed full scale. The owner approved the trim on 2026-11-13. It is one constant (`JAM_HEADROOM_DB` in `engine.ts`). What is left of the question: over a whole pass the loudest hit lands at about −2 dBFS, which is the limiter's mark and not under it. One more decibel of trim would put it clearly under, if that matters.
2. **Short forms.** The brief asks for a fill in the last bar of each pass and the crash from the second pass. On the four 2-bar and six 3-bar entries that is a fill and a crash every five to eight seconds. The drums mark those every second pass. P2.2's noise cymbal, with the drums off, still marks every pass as before.
3. **The swing ratio.** The drums swing at 2:1 because the bass and guitar do. Measured jazz drummers swing harder than that at practice tempos. A tempo-dependent ratio for the whole band is in the research note's "Decisions for the owner".
4. **A third kit.** The research said brushes can work, so kit C is built. It is the least certain of the three.
5. **The kit is one choice for the whole app**, made in the lab. A jazz entry does not switch to brushes by itself. A kit per entry, or a choice in Settings, is a small next step once the owner knows which kits are keepers.
6. **The lab opens on the Drums page.** S1's instructions (**[** is A, **]** is B) now apply on the Bass page. The page is remembered.
7. **Swing is quieter than the other grooves** by about 4 LU, with the same fader.
8. **`drums` is optional in the mix types**, so that no existing test or call had to change. A mix that does not mention the drums has none.
9. **Humanize is 50 by default** and lives in the lab only.
10. **Shared files touched:** `jamSchedule.ts`, `jamMix.ts`, `engine.ts`, `progressionLibrary.ts`, `usePlayOptions.ts`, `usePlayback.ts`, `useJamLoop.ts`, `MixFaders.tsx`, and the lab's panel.

## Not in S2

- Half-open hi-hats, the ride's bell, rimshots, flams, drags and rolls. Each needs the groove to ask for it.
- Choking a crash by hand.
- A count-in played on the sticks.
- Time signatures other than 4/4, and song form (P5).
- A choice of kit or groove in Settings or the Play menu.
- Recorded cymbals. If kit A's metal is the part that does not convince, a dozen one-shots of our own would close most of the gap (see the research note).

## Done when

- [x] `docs/sound/drums.md` covers how professional drum sounds are made, how each piece can be synthesized, what makes a part feel played, where recordings win, and its sources.
- [x] At least two kits, an acoustic one and a drum machine, A/B'd in the lab. A third, brushes.
- [x] Straight eighths, a shuffle, jazz swing with the foot on 2 and 4, and sixteenths. Swung notes at `SWING_OFFSET`.
- [x] A default groove for each library entry; the Feel menu still switches.
- [x] A fill at the end of a phrase and the kit's crash at the top of the next, replacing the noise cymbal while the drums are up.
- [x] Humanizing inside the grid that cannot drift.
- [x] A fourth fader with its own gain node, starting at off.
- [x] Levels measured and written here.
- [x] With the drums up, all layers together stay under full scale: all four at 0 dB peak between −2.6 and −2.0 dBFS. It took a 3 dB trim of the whole jam, which the owner approved. See "Decisions to check", item 1.
- [x] Guitar, bass and pad play what they played, 3 dB lower. Every existing test passes; three expectations were updated for the trim.
- [x] The lab plays each groove on each kit at matched loudness with the dials exposed, and its keys are documented.
- [x] `npm test`, `npx tsc -b` and `npm run lint` pass. No page scrolls at the three sizes. A CPU budget in tests.
- [ ] The owner has listened, in the lab and in the jam, on speakers and headphones, and has chosen.
