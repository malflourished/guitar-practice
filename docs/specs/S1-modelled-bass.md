# S1: a modelled electric bass

**Package:** S1 (sounds we synthesize ourselves), beside P2.2.
**Status:** built and merged 2026-11-13. The owner listened in the lab ("the attack does sound like fingers on string", "the four presets sound great", "model bass sounds great"), so it is now the jam loop's default. The synth bass stays as the lab's A and as the fall-back when the worklet cannot load.
**Research behind it:** [docs/sound/research.md](../sound/research.md).

## Why

After the first play-alongs the owner said the bass "sounded a little cheap" and asked for "higher end music sounds", synthesized by us "without having to rely on an external library". The research found the cause: `BassVoice` is a sawtooth through a filter, and nothing in its sound moves the way a string's does. S1 replaces the method, not the settings. It models the string, the pluck, the pickup and the amplifier in our own code, with no synthesis library and no samples. Tone.js still does the scheduling and routing.

## How to hear it

1. Run the app and press **\\** (backslash). The sound lab opens on the left. The same key closes it.
2. Press **Line** (a two-bar bass line) or **12-bar blues** (the jam loop's own bass part, with a pad under it if **Pad** is ticked).
3. Flip between **A** (the synth bass) and **B** (the modelled bass) with the two buttons, or with **[** and **]**. Both basses play all the time and only the switch moves, so there is no gap and no restart.
4. For the real mix, start the 12-bar blues in Progressions and flip A and B in the lab while it plays. **The switch also sets which bass the jam loop uses,** and the choice is saved on this computer (`vibrato:bass` in localStorage). A fresh install starts on A.
5. Try the presets and the dials. **Copy settings** puts the current settings on the clipboard as one line of text, to paste back to a session.

What to listen for:

- **The start of a note.** B has a pluck. A fades in over 5 ms.
- **The first second.** B starts bright and mellows. A is the same from start to end.
- **The low E.** B growls a little, because its upper partials drift against each other. A buzzes evenly.
- **Repeated notes.** B's are never quite the same, and there is a small gap as the finger comes back to the string. A's are identical.
- **Note endings.** B stops like a damped string. A fades out.
- **Loud and soft.** In the Line, the soft note before the last two is darker on B, not only quieter.
- **Small speakers.** Listen on the laptop's speakers as well as headphones. A bass that only works on headphones is no use here.

The two are matched in level, so neither wins by being louder. See "Levels" below for what that match can and cannot do.

## What was built

| Piece | Where | Role |
|---|---|---|
| Reusable DSP | `src/lib/audio/synth/dsp/` | Delay line with fractional reads, biquad and shelf filters, the design of loss and stiffness filters, a seeded random source, level meters (peak, RMS, K-weighted), and measurement helpers for tests |
| The bass model | `src/lib/audio/synth/bass/bassParams.ts`, `bassNote.ts`, `bassString.ts`, `bassSynth.ts` | Pure TypeScript with no audio API. Renders in Node, in the lab's loudness measurement and in the worklet |
| Reference lines | `.../bass/bassLine.ts` | The two-bar line, the jam's blues bass part, and `renderBassLine` |
| Worklet | `.../bass/bassProcessor.ts`, `bassMessages.ts` | The audio-thread wrapper: 60 lines around `BassSynth` |
| Voice | `.../bass/modelledBassVoice.ts` | `ModelledBassVoice`: the same `play(midi, time, duration, velocity)`, `stop()` and `dispose()` as `BassVoice`. Made with `ModelledBassVoice.create(destination)`, which loads the worklet first |
| Settings | `.../bass/bassSettings.ts` | Which bass the jam plays, the model's controls and its level trim. One saved copy, read by the engine and changed by the lab |
| Sound lab | `src/lab/SoundLab.tsx`, `SoundLabPanel.tsx`, `soundLabAudio.ts`, `SoundLab.css` | The hidden A/B panel |
| Worklet bundling | `vite.worklet.ts` | `import code from './x.ts?worklet'` gives one self-contained script as a string |

Files that already existed and were changed, all in small ways:

- `src/lib/audio/engine.ts`: the jam's bass events go through `jamBass()`, which returns the modelled bass when the setting asks for it and it has loaded, and the synth bass otherwise. `stopAll` stops both.
- `src/main.tsx`: mounts `<SoundLab />` beside `<AnalogLab />`.
- `vite.config.ts` and `tsconfig.node.json`: the `?worklet` plugin.

The folder is `synth/`, not `instruments/` as the brief suggested, because `src/lib/audio/instruments.ts` (the guitar sample banks) already has that name.

## The model

One note is one string voice. The path, with the numbers that matter:

```
pluck pulses → [ delay line → 6 stiffness all-passes → loss filter ] (the string, a loop)
             → pickup comb → integrate → pickup nonlinearity
all strings  → pickup low-pass (Tone) → amp (soft clip) → cabinet (35 Hz to 4 kHz) → out
```

**Where a note is played.** A 34-inch four-string bass. `fingerBass` frets each note at frets 1 to 5 where there is a choice, so a root and its 5th sit one string apart in one hand position. Only the low E is an open string. Notes above the D string's 5th fret go up the G string. The jam's lowest pickup note (D♯1) plays as the E string tuned down.

**The string.** A delay loop one period long. The delay line is read with third-order Lagrange interpolation, so the pitch is exact and can move smoothly.

**Loss.** A one-pole low-pass in the loop, designed per note from two targets: the fundamental's T60 (Sustain: 9 s on the open A, a little longer below it and shorter above), and the T60 at 1 kHz (String age: 1.6 s). Measured: the fundamental lasts 5.2 to 10.0 s across E1 to G3, and the partial near 1 kHz 1.25 to 1.81 s.

**Stiffness.** Six first-order all-pass filters with one shared coefficient, solved per note by bisection so that the partial nearest 1 kHz sits where the stiff-string formula puts it, while the fundamental stays exactly in tune. The inharmonicity coefficient is estimated from each string's core wire: 1.4 × 10⁻⁴ (E), 5.9 × 10⁻⁵ (A), 3.6 × 10⁻⁵ (D), 2.3 × 10⁻⁵ (G), growing as the string is fretted shorter. On the low E that puts the 24th partial 67 cents sharp of 24 times the fundamental. The partials below the reference are within about 8 cents of the formula. Above it the filters flatten out, where the pickup has removed most of the sound anyway. These coefficients are estimates, not measurements, and Stiffness scales them.

**The pluck.** A raised-cosine pulse, and its inverted reflection one string-trip later, fed into the loop. Together they produce the velocity wave of an ideal pluck at that point, exactly. The pulse is about 2.4 ms wide for a soft fingertip and 0.25 ms for a pick, wider for soft notes and narrower for hard ones. The pluck point is a distance from the bridge in centimetres. A short burst of low-passed noise stands for skin on the windings.

**The pickup.** A second comb for its position, also in centimetres from the bridge, so the pattern of missing partials changes with every fretted note as it does on a real bass. The signal is integrated once, because a pickup senses velocity. The pickup's sensitivity follows the string's position slightly, which adds even harmonics as notes get louder. Its width blurs the pluck a little, most on the heavy strings. Its circuit is a resonant low-pass (Tone).

**The amp.** A lift of the upper partials, an asymmetric soft clipper, and the opposite cut. Played softly the three cancel out. Driven, it rounds the attack and adds a little grit. It is deliberately light: on a signal this rich in low partials, Drive mostly evens out the peaks.

**Pitch bloom.** The delay shortens in proportion to the string's energy, so a full-strength pluck starts 6 cents sharp and settles as the note fades. At the jam's usual velocity (0.9) that is about 4 cents over the first quarter second and under 1.5 cents after half a second.

**How it is played.**
- A new note on a string that is still ringing: a finger lands 25 ms before the pluck and stops the string.
- A new note on another string: the old one is muted as the new one starts, and overlaps it briefly.
- The end of a note: the string is damped in about 80 ms (Release). It cannot stop faster than a wave takes to cross the string, which is one period.
- Each pluck varies a little in position, hardness and level, and two "fingers" alternate (Variation). Pitch and timing never vary.
- Four voices. A voice that has stopped is zeroed and costs nothing.

## The controls

All twelve are in the lab. Tone and Drive apply at once; the rest apply from the next note.

| Control | Range | Default | What it does |
|---|---|---|---|
| Pluck | 0 to 100 | 35 | Soft fingertip to pick |
| Pluck at | 4 to 30 cm | 16 | Distance from the bridge: near is thin and nasal, far is round |
| Pickup at | 4 to 24 cm | 14 | 14 is about where a P-style pickup sits, 6 a J-style bridge pickup |
| Tone | 300 Hz to 6 kHz | 2200 | The tone knob |
| String age | 0.15 to 4 s | 1.6 | How long the brightness rings: new roundwounds high, dead strings low |
| Sustain | 1 to 20 s | 9 | How long a held note lasts |
| Stiffness | 0 to 2× | 1 | 0 is a perfectly harmonic string |
| Drive | 0 to 100 | 25 | Amplifier saturation |
| Pitch bloom | 0 to 30 cents | 6 | How sharp a hard pluck starts |
| Release | 0.02 to 0.4 s | 0.08 | How fast a damped note stops |
| Variation | 0 to 100 | 50 | Difference from one pluck to the next |
| Finger noise | 0 to 100 | 50 | Skin on the windings |

Presets: **round** (the default: fingers, P-style pickup), **motown** (soft pluck, dead strings, tone rolled off), **bright** (bridge pickup, new strings), **pick**.

## Levels

- **Matched to the synth bass.** `BASS_OUTPUT_GAIN` (1.31) was set from the lab's measurement so that, with the default controls, the model has the same RMS as `BassVoice` at its default −4.5 dB on the reference line (four bars of the jam's swing bass over A7, D7, E7, A7 at 100 BPM). The jam's measured mix (P2.1) and the P2.2 faders then mean the same thing for either bass.
- **Measured (2026-11-13, 48 kHz, before the master volume):**

  | | RMS | Peak | K-weighted loudness |
  |---|---|---|---|
  | A, synth bass | −12.9 dBFS | −1.8 dBFS | −16.7 LKFS |
  | B, modelled, default controls | −12.9 dBFS | −0.4 dBFS | −15.0 LKFS |

- **What equal RMS hides.** At the same RMS, B's peaks are 1.4 dB higher (a pluck has a sharper start than a synth envelope) and it is 1.7 dB louder by the K-weighted measure (more of its energy is in harmonics the ear hears well). In the full mix its attacks will reach the limiter a little sooner than A's. If B seems too forward, the lab's **Loudness** match trims it 1.7 dB, which also brings its peaks level with A's. That may be the fairer comparison, and the owner can try both.
- **When the controls change.** The lab renders the reference line through the model itself on every change, measures it, and trims B to match A. The trim is saved with the settings, so the jam plays B at the level the lab found.
- **The trim has a ceiling.** It never lifts B's peaks past full scale, because the limiter would squash them and spoil the comparison. A thumpy sound such as the motown preset cannot reach A's RMS without that, and the lab says how far short it is.

## Loading the worklet

Two things were learned the hard way and are worth knowing before the next instrument:

- **Tone's audio layer rewrites worklet source.** It does not pass a worklet URL to the browser. It fetches the text, splits off the leading imports with a regular expression, wraps the rest in a function and loads that. A dev-server module with a comment before its imports does not survive, and Vite's own `?worker&url` gives exactly that in development. So `vite.worklet.ts` bundles the processor and everything it imports into one script with no imports, and `modelledBassVoice.ts` loads it from a Blob. It is the same path in development, in a production build and from the packaged app's `file://` pages.
- **`Tone.Offline` is not safe while the app is running.** It swaps Tone's global context and waits in the middle of the swap. Two overlapping calls left the whole app on a finished off-line context. `measureSynthBass` in the lab swaps the context by hand and swaps it back before anything else can run.

`ModelledBassVoice` also calls the context's own `audioWorklet.addModule`, because Tone's `addAudioWorkletModule` remembers only the first module it is given.

## In the engine

- `jamBass()` chooses the voice for each bass note from `getBassSettings().jamBass`.
- The modelled bass loads the first time it is wanted: at Play, if it is already chosen, so it is ready by the end of the count-in. Its code is a separate 16 kB chunk that a player on the synth bass never downloads.
- If it cannot load, the jam stays on the synth bass and the console says so once.
- While the loop plays, the engine follows the lab: a flip silences the bass left behind, and the dials and the trim reach the model.

**For whoever merges this with P2.2.** P2.2 gives the bass its own gain node. Both basses must play into it: `BassVoice` in `jamBass()` and `ModelledBassVoice.create(...)` in `loadModelledBass()` each take the destination, and both currently use the engine's output.

## Tests

`npm test` runs these with the rest (340 tests in all).

- **Tuning** (`bassSynth.test.ts`): every note from E1 to G3 within 2 cents at 44.1 and 48 kHz, with spot checks at 96 kHz, on every preset and at the ends of the range. Measured worst case: 0.13 cents, on the low E. These run with Pitch bloom at 0. A separate test checks that the bloom starts a hard pluck a few cents sharp and settles within 1 cent.
- **Stiffness:** the partial near 1 kHz within 2 cents of the stiff-string target, and exact harmonics with Stiffness at 0.
- **Decay:** a held note lasts 4 to 15 s; the partial near 1 kHz lasts within 30% of String age; a damped note is 40 dB down within 100 ms and then exactly silent; `stop` silences everything and drops notes not yet played.
- **No invalid or denormal numbers:** random notes at every extreme of every control, at three sample rates, with the output and all internal memory checked each second, and exact zeros at rest.
- **Playing:** a note starts on the exact sample asked for; the sound is identical however the blocks are sliced; the same seed repeats exactly; two plucks of the same note differ; level is even across the range within 1.5 dB; harder is brighter, not only louder; plucking a fifth of the way along removes every fifth partial; the pickup stays fixed to the body.
- **Cost:** ten seconds of the line in under one second of one core.
- **Building blocks** (`dsp.test.ts`): the delay line, the filters, the loss and loop designs, the meters (K-weighting against the coefficients printed in ITU-R BS.1770) and the measurement helpers.
- **Settings** (`bassSettings.test.ts`) and **the engine's choice of bass** (`engineJamBass.test.ts`): the default, the modelled bass when chosen, the fall-back, following the lab, and Stop.

Checked in a browser, not by the test suite:

- The worklet's output, rendered off-line through Tone, is identical sample for sample to the core's output in Node.
- The lab plays both basses, flips without a gap and matches levels, in development and from a production build opened from `file://` in Electron.
- In Progressions, the jam's bass notes move from one bass to the other when the lab's switch flips, and Stop silences both.

## Cost

Measured in Node 22 on the development machine (Apple M4 Max), at 48 kHz:

| | Per sample | Share of one core |
|---|---|---|
| One sounding string | about 40 ns | 0.2% |
| The jam's blues bass part | 60 ns | 0.3% |
| The two-bar line | 76 ns | 0.4% |
| Nothing playing | under 1 ns | none |

The line costs more than one string because the notes it has just damped are still dying away. A slower laptop might take five times as long, which is still under 2% of a core. The worklet runs the same code in the same JavaScript engine. Tone's wrapper around a worklet adds a small array to each 128-sample block, which is the only memory the audio thread allocates while it plays.

## Decisions to check

Each of these went beyond the brief or read it loosely. Say if any is wrong.

1. **Pitch bloom and the 2-cent rule.** The string is in tune to 0.13 cents. On top of that, the default sound starts a hard pluck up to 6 cents sharp, as a real string does. The tuning tests therefore run with the bloom off. If the backing should be strictly in tune from the first millisecond, set Pitch bloom to 0 and make that the default.
2. **Matching by RMS.** The brief asked for the same RMS, and that is the default. The lab adds a K-weighted match because equal RMS leaves the modelled bass sounding slightly louder (see "Levels").
3. **One switch for the lab and the jam, saved.** The A/B switch sets the jam's bass and survives a restart, so the owner can practise with B for a few days before deciding. Since the owner's verdict the default is B. A choice saved while comparing (settings without `v: 2`) gives way to B once; sound settings are kept.
4. **Shared files.** `main.tsx`, `vite.config.ts` and `tsconfig.node.json` were touched as well as `engine.ts`. The lab needs mounting, and the worklet cannot load without the bundling step.
5. **No release noise.** A soft thump as the damping finger lands was built and then removed: at any believable level the dying note covered it completely.

## Not in S1

- Slides, hammer-ons, slap, ghost notes and fret buzz. They need the bass line to ask for them (a richer `JamEvent`) and, for slap and buzz, a model of the string hitting the frets.
- A compressor. The model evens out its own note levels, which does most of that job.
- A choice of bass in Settings. Until the owner decides, the lab is the only switch.
- The other instruments. The plan for each is in the research note.

## Done when

- [x] `docs/sound/research.md` covers how professional sounds are made, the details that matter, real sources, and a plan for each instrument.
- [x] The modelled bass runs in an AudioWorklet from a pure TypeScript core, with `BassVoice`'s interface.
- [x] Tuning within 2 cents from E1 to G3, sensible decay times, no NaN or denormals, and the cost budget, all tested.
- [x] The sound lab plays a line and the 12-bar blues with an A/B switch, matched loudness and the model's controls.
- [x] The engine loads the worklet and chooses the jam's bass through a setting the lab flips. The synth bass stays the default.
- [x] `npm test`, `npx tsc -b` and `npm run lint` pass.
- [ ] The owner has listened, in the lab and in the jam, on speakers and headphones, and has chosen.
