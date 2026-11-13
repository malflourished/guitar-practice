# Making drum sounds ourselves

**Package S2, part 1: research.** Written 2026-11-13.
**Built from it:** the drum kits and grooves in `src/lib/audio/synth/drums/` and `src/lib/audio/drumGrooves.ts`, described in [specs/S2-drums.md](../specs/S2-drums.md).
**Companion:** [research.md](research.md), the general note on instrument sounds that S1 wrote. This note follows its method and its rule: our own DSP, no third-party synthesis code, no sample packs.

It answers four questions. How are professional drum sounds made? How can each piece of a kit be synthesized? What makes a drum part feel played and not programmed? And where do recordings still win? Numbers in square brackets point to the sources at the end; they are numbered for this note alone.

Words used throughout:

- A **mode** is one way a drumhead or cymbal can vibrate, with its own frequency and its own decay. A struck drum is the sum of its modes.
- **Modal synthesis** makes a sound by adding up one decaying tone per mode.
- **Inharmonic** partials are not whole multiples of a lowest one. A string's partials are nearly harmonic, a drum's and a cymbal's are not, which is why they have a colour and no clear note.
- A **ghost note** is a very soft stroke, usually on the snare, between the main ones.
- The **swing ratio** is how a beat is divided between its long first part and its short second part: 2:1 puts the second note two thirds of the way through.
- The **bus** is the point where all the drums are mixed together and processed as one.

## The short version

1. **A kit is three kinds of sound source, and they are not equally hard.**
   - *Drums* (kick, snare, toms) are stretched membranes. A struck drumhead has a few strong modes that die away in a fraction of a second. That is exactly what modal synthesis is good at, and a handful of modes per drum is enough [1, 2, 9].
   - *Cymbals and hi-hats* are thin metal plates. A cymbal has over a thousand modes in the hearing range, and at playing strength they feed energy to each other, so the sound blooms and shimmers after the stroke [3, 4, 5]. Simulating that honestly costs far more computing than a web page's audio thread has [6, 7].
   - *Snare wires and brushes* are noise: many small collisions or a continuous scrape. They are made from shaped noise, and the art is in what shapes it.
2. **The classic drum machines are instruments, not failed imitations.** The 808's kick is one damped resonator. Its hi-hat, cymbal and cowbell are six square waves through two band-pass filters [10, 11]. A kit in that tradition is honest synthesis: nothing in it pretends to be a recording, and it suits the app's look.
3. **Feel matters more than timbre, and feel is mostly dynamics.** What separates a played part from a programmed one, roughly in order:
   - loud and soft strokes in a pattern: accents, ghost notes, the hi-hat's strong and weak hand;
   - a harder stroke sounding different, not only louder;
   - no two strokes exactly alike;
   - the swing ratio;
   - a few milliseconds of timing, in a pattern and not at random;
   - the bus: one room around the kit, and peaks held together.
4. **Four things we did not expect:**
   - **Timing looseness is not what makes a groove.** In listening tests, perfectly quantized drum patterns were rated as groovy as, or groovier than, the same patterns with microtiming [17, 18, 19]. Exaggerated deviations made them worse. So the kit plays close to the grid, and puts its humanity into dynamics and tone.
   - **If timing does wander, it should wander slowly.** Human timing errors are not independent from one stroke to the next. They drift, and listeners preferred drifting variation to the random jitter that "humanize" buttons add [20, 21].
   - **Real swing is not 2:1.** Jazz drummers' ride cymbals swing harder than triplets at slow tempos (up to about 3.5:1) and flatten towards even eighths at fast ones. The triplet ratio appears only at one tempo in between [14, 15]. The jam loop uses 2:1 everywhere, and the drums match it. See "Decisions for the owner" at the end.
   - **Even the commercial modelled kit samples its cymbals.** IK Multimedia's MODO DRUM models its kicks, snares and toms and, as far as its reviewers could tell, plays recordings for hi-hats and cymbals [30]. That is a fair measure of how hard metal is.
5. **On laptop speakers a kick drum is its click and its upper body, not its fundamental.** The same finding as for the bass in S1: a 55 Hz fundamental is not reproduced, so the kick must put energy between 100 and 250 Hz and have a clear beater click.
6. **Drums are all peak.** A kick that peaks as high as the bass has about a tenth of its average power. The jam mix has almost no headroom left (P2.2 measured it), so the drum bus has to hold its own peaks down.

What S2 builds, in one table. Details are in "The plan" below.

| Piece | Acoustic kit | Machine kit (80s) |
|---|---|---|
| Kick | Three head modes whose pitch falls as the stroke dies, a beater click, a shell thump | One swept resonator with a hard pitch punch, a click, saturation |
| Snare | Two pairs of head modes, wires as noise driven by the head's own motion | Two swept tones and a noise burst, with a gated-room burst |
| Cross-stick | Three short stick-and-rim modes | A short high tick |
| Hi-hats | One bank of plate modes with a foot that changes its damping, plus noise bands | Six square waves through two band-passes |
| Ride, crash | A bank of plate modes each, re-struck by every hit, fed with a noise "cascade" that blooms | The same six square waves, longer and lower |
| Toms (fills) | Three modes with a pitch glide | A swept tone and noise |
| Bus | A small room, soft clipping on the drums | Less room, the gated burst, a harder clip |

A third kit, **brushes**, follows from the research: a brush sweep is shaped noise, which synthesis can do. It uses the acoustic kit's drums and cymbals.

## How professional drum sounds are made

### Recording a kit

A recorded kit is many microphones [28, 29]:

- **Close microphones** on each drum, often two for the kick (inside for the click, outside for the boom) and two for the snare (above for the stick and the head, below for the wires).
- **Overheads**, a stereo pair above the kit. They carry the cymbals and the picture of the whole kit.
- **Room microphones** further away. They add size.

The sound of a drum on a record is the drum, the room and the processing together:

- **Gates and equalizers** on each close microphone. A typical kick is cut around 300 to 400 Hz (the "boxy" region) and lifted at 60 to 80 Hz and at 3 to 5 kHz (the click).
- **Compression** with an attack of 10 to 30 ms, slow enough to let the stroke's first instant through, so the drum keeps its punch while its body is levelled.
- **Parallel compression**: a heavily squashed copy mixed under the clean one.
- **A bus compressor and tape or console saturation** across the whole kit, which is what engineers mean by "glue".
- **Reverb.** A plate on the snare, or the gated reverb that marks early-1980s records, credited to engineer Hugh Padgham's sessions with Peter Gabriel and Phil Collins: a big, dense room cut off abruptly after a quarter of a second or so.

### Sampled kits

Drum libraries record all of the above for every piece: dozens of loudness levels, several takes of each, every microphone, and every way of hitting (hi-hat closed with the tip, closed with the shank, half open in several stages, open, foot; snare centre, edge, rimshot, cross-stick, ghost, flam, roll; ride bow, bell, edge). A playback engine picks a recording for each note. Large libraries run to tens of gigabytes. Research.md describes the method and its limits; they are the same here. Its great strength for drums is that the cymbals and the room are real.

### Drum machines

Three generations matter for the sound we want:

- **Analogue circuits** (Roland CR-78, 1978; TR-808, 1980; the drums of the TR-909, 1983; Simmons SDS-V, 1981). Each voice is a small circuit: a resonator or oscillator for the body, filtered noise for snares and metal, simple envelopes. See "The classic designs" below.
- **Samples** (Linn LM-1, 1980; LinnDrum, 1982; Oberheim DMX; the 909's hi-hats and cymbals). Short, low-resolution recordings of real drums. The Linn machines were the first to sound like a recorded kit, and the LinnDrum is the pop sound of the decade.
- **Models** (today). Kicks, snares and toms from modal synthesis in real time, with recordings for the metal [30].

## How each piece can be synthesized

### Membranes: kick, snare, toms

**The physics.**

- An ideal circular membrane has modes at fixed ratios to its lowest: 1, 1.59, 2.14, 2.30, 2.65, 2.92, 3.16, 3.50, 3.60 and on up [1]. They are not harmonics, which is why a drum has a pitch region and not a note.
- A real drum departs from that in useful ways [1, 2, 8]:
  - *The air* loads the head and lowers its lowest modes the most.
  - *Two heads* are coupled through the air between them, so each low mode comes as a pair: heads moving together, and heads moving in opposition [9].
  - *The lowest mode pushes the most air*, so it is the loudest and also dies the fastest. A drum goes "thud" and then rings on its higher modes.
- **Where it is hit.** A stroke at the centre excites only the modes that are symmetric about the centre, which gives a short, dry thump. A stroke towards the edge brings in the others and rings more.
- **How hard.** A stick or beater stays on the head for a few milliseconds, and for less time when the stroke is harder, so a hard stroke is brighter [1].
- **Pitch glide.** A hard stroke stretches the head, which raises its tension. The drum starts sharp and falls to its resting pitch as it dies away [2, 12]. On a kick this is the downward "boom". Drum machines exaggerate it.

**Synthesis.** One decaying tone per mode, started by a short pulse whose width follows the stroke's hardness, with the frequencies raised in proportion to the drum's own level so the pitch falls as it fades. Four to eight modes are plenty. This is the method of the published membrane models [12], cut down to what a jam needs.

**Kick.** Three symmetric modes (a centre stroke), from about 55 Hz. A beater click: a millisecond or two of filtered noise and a pulse, brighter for a harder stroke. A short thump from the shell. Decay of a quarter to a third of a second, because a kick in a kit is damped with a pillow.

**Snare.** Two things at once:

- *The head*: its lowest mode, a pair somewhere between 170 and 230 Hz in published measurements, and the next near 320 to 330 Hz [2, 9], dying in about a tenth of a second.
- *The wires*: coiled strands stretched across the bottom head. When that head moves, they are thrown off and slap back, which makes a burst of noise [9, 13]. Two details make it a snare and not a hiss:
  - The noise is driven by the head, so it buzzes at the head's frequency and dies with it.
  - A harder stroke throws the wires further, so the noise is longer and brighter, not only louder.

  A ghost note is nearly all wires and very little head.

**Cross-stick.** The stick lies across the head, which damps it, and its shoulder strikes the rim. What is heard is the stick and the rim: a short woody click of a few high modes, close to a clave.

**Toms.** As the kick, higher, with both heads free: a longer ring and the most audible pitch glide in the kit.

### Metal: hi-hats, ride, crash

**The physics.**

- A cymbal is a thin, slightly domed plate, free at the edge. By the textbook formula for the modal density of a flat plate, a 20-inch ride has a mode about every 12 Hz: well over a thousand below 20 kHz. (Our estimate, from a 2 kg bronze ride; a 14-inch hi-hat cymbal has roughly half as many.)
- At playing strength the modes are not independent. Energy put into the low modes spreads to higher ones, and the vibration becomes chaotic [3, 4]. Reid's summary of the measurements: for the first few milliseconds the energy is in strong peaks at a few hundred hertz, then it moves up the spectrum until the cymbal rings at a few kilohertz, and at the end of the decay the highest modes have died first [26]. For a crash struck on its edge the spread is nearly instant [5].
- This is why a cymbal is the hard case. A louder stroke is a different sound from start to finish, and no fixed set of decaying tones has the bloom.
- **How it is played** changes which part dominates:
  - *Ride, tip of the stick on the bow*: a clear "ping" (the stick's click and a few modes) over a quiet wash.
  - *Crash, shoulder of the stick on the edge*: a large push into the low modes and the full bloom.
  - *Hi-hats* are two cymbals facing each other. Closed, they damp each other and give a tick of 50 to 100 ms. Half open, they sizzle against each other. Open, they ring for a second or more until the foot closes them. The foot alone gives a soft "chick": the two plates clapping shut, with no stick click and less treble.

**The honest route.** Solve the nonlinear plate equations on a grid [6], or as a few thousand coupled modes [7]. Both give convincing crashes and gongs and both take far longer than real time on one processor. Not for an audio worklet.

**The cheap routes.**

| Method | Sound | Cost |
|---|---|---|
| Filtered white noise with an envelope (the earliest rhythm boxes [26], and P2.2's cymbal) | "Tss". No metal in it | Almost nothing |
| Six square waves at unrelated frequencies through band-pass filters (the 808) [11] | The drum-machine cymbal: metallic, thin, unmistakable | Almost nothing |
| A pair of oscillators, one modulating the other's frequency [25, 27] | Dense metallic clusters; needs careful envelopes | Very low |
| A bank of several hundred decaying modes | A struck metal plate. No bloom, since it is linear | High |
| A few dozen modes for the part the ear resolves, noise for the rest [31] | The nearest to a real cymbal that is cheap | Moderate |

**Our acoustic cymbals** take the last route and add three ideas:

- **Each cymbal is one object.** A bank of modes that keeps ringing, and every stroke adds energy to it. A ride pattern costs the same as one stroke, strokes build on each other as they do on metal, and the hi-hat's foot is simply the bank's damping: closing it chokes the ring the way a real pair does.
- **The cascade is fed in as noise.** After a stroke, a decaying noise signal keeps exciting the bank, rising late for a crash. Each mode filters it, so every partial flutters and none is a clean sine. That stands in for the energy arriving from other modes, which a linear bank cannot produce. The noise is low-passed, and the low-pass falls as the cymbal dies, so the top of the sound goes first.
- **Plain noise fills the gaps.** Forty partials where a cymbal has a thousand sound like a cluster of bells. The same noise, unfiltered by the modes, is mixed under them, and above about 6 kHz, where the ear hears only a band's level, it takes over.

One thing found while building, by looking at spectrograms: a plain two-pole resonator passes everything below its own frequency, so a bank of thirty put a thump under every cymbal stroke. Each mode has to be a true band-pass.

### Brushes

- A brush is a fan of a hundred or so thin wires.
- **A tap** lands the wires over several milliseconds. The attack is soft and diffuse, with no stick click.
- **A sweep** drags the wires across the coated head: a continuous hiss whose loudness and brightness follow the speed of the hand, coloured by the drum, with the snares answering faintly. In a swing pattern one hand keeps the hiss going in circles, with a push on each beat, while the other taps the ride rhythm on the head.
- **Synthesis.** A scrape is noise whose level and bandwidth follow the speed of the contact: the standard recipe for contact sounds [32]. An analogue circuit for exactly this sound, amplitude-modulated noise through several filters, was patented in 1980 [33]. A tap is the snare model struck softly several times over a few milliseconds.
- **Can it sound good?** The sweep, yes: it is the piece of the kit closest to pure shaped noise. The taps are plausible. What a recording adds is the grain of real wires on a real coating. We build it as a third kit and let the owner judge.

### The classic designs

What each machine actually does, from the published circuit analyses:

- **808 kick** [10]. A "bridged-T" network: a filter that rings at one frequency when struck by a pulse. It rings at about 49.5 Hz by the authors' analysis (Roland's own chart says 56). For the first six milliseconds or so the circuit raises that frequency by more than an octave, which is what makes it punch. A separate leak makes the pitch sag slightly as the note dies. Decay runs from a short thud to several seconds.
- **808 snare.** Two of the same resonators at different pitches, and high-passed noise for the wires.
- **808 hi-hats, cymbal and cowbell** [11]. Six square-wave oscillators at 205.3, 304.4, 369.6, 522.7, 540 and 800 Hz. Their sum goes through two band-pass filters at about 3.4 and 7.1 kHz, which pick out the crowd of upper harmonics. Three bands get three envelopes. The cowbell is the 540 and 800 Hz pair alone.
- **909.** The kick and snare are oscillators swept down in pitch by an envelope, with noise. The hi-hats and cymbals are short recordings.
- **LinnDrum.** All recordings, tunable.
- **Simmons.** A swept oscillator and filtered noise per pad: the falling "pew" of 1980s toms.

**Our machine kit** is in this tradition and copies none of them: a swept resonator kick with a hard punch, a two-tone snare with a noise burst and a gated-room burst, six square waves of our own tuning for all the metal, swept toms.

## What makes a drum track feel played

### Dynamics, and timbre that follows them

- **Accents come in patterns.** Porcaro's sixteenth-note hi-hat in "I Keep Forgettin'" alternates strong and weak strokes: the loudness values fall into two overlapping groups, from intentional accents on every second note [21]. Drummers do this by alternating the shoulder of the stick on the edge of the hat with its tip on the top, so the strong stroke is also fuller and longer.
- **Ghost notes** sit far under the backbeat, typically by 15 to 20 dB (a working figure from practice, not a measurement). They are heard as texture between the main strokes.
- **A louder stroke is a different sound** (see the physics above): brighter, the wires longer, the pitch starting higher. A recording of a loud stroke turned down does not sound like a soft one. This is the same point as research.md's section 7.
- **Level and timing are linked.** Drummers asked to play "laid back" mostly played those strokes louder as well as later [23]. An accent is prepared from a greater height and tends to lengthen the gap after it [24].

### No two strokes alike

A stick never lands twice in the same place at the same angle. Sample libraries answer with several takes of each stroke. A model changes the strike point, the hardness and the level by a few percent each time, and alternates two "hands".

### The swing ratio

- Measured on classic recordings, the drummer's ride cymbal ratio is about 3.5:1 at slow tempos and falls to 1:1 at fast ones. The short note stays near 100 ms at medium and fast tempos [14]. Expert drummers do not simply scale the pattern with tempo [15].
- Soloists swing less than the drummer, and tend to place their downbeats a little after the cymbal's while meeting it on the off-beats [14, 16].
- **For vibrato~.** The jam's bass pickup and guitar up-strums sit at exactly two thirds of the beat (`SWING_OFFSET`), and the drums must agree with them, so the drums use 2:1 too. At practice tempos (60 to 120 BPM) a real drummer would lean harder than that. Changing it is a decision about the whole band, not the drums.
- **A shuffle** is the same division played on every beat, with the backbeat on 2 and 4. It is triplet-based, and 2:1 is right for it.

### Microtiming

- **Small deviations are real.** Porcaro's sixteenth notes, played without a click at 96 BPM, average 156.6 ms apart with a standard deviation of 8.7 ms [21].
- **They drift.** In that track and in controlled experiments, the deviations are long-range correlated: each one is related to those before it, over many bars [20, 21]. When computer-made rhythms were "humanized", listeners clearly preferred that kind of variation to independent random jitter [20].
- **They are not what makes groove.** A drum pattern with strictly metronomic timing got the highest groove ratings, and larger deviations got lower ones [17]. Jazz, funk and samba patterns with idiomatic microtiming were rated below their quantized versions [18]. Real bass and drum performances were rated the same with their original timing and fully quantized, and worse when the deviations were exaggerated [19]. Most listeners cannot tell which of bass and drums is ahead when they are within about 30 ms of each other [22].
- **Some of it is systematic.** The backbeat is often placed slightly late [34], and laid-back strokes are louder [23].
- **For vibrato~.** Stay on the grid. Add a slow, bounded drift of a few milliseconds shared by the whole kit, a millisecond or two of difference between hands, and a snare backbeat a few milliseconds behind. Every stroke's time is the grid time plus a small offset computed from its position, so nothing accumulates and the kit can never drift away from the Transport.

### The bus

- **One room.** Close-miked drums with no room sound like separate machines. A short room on every piece puts them in one place. Dry synthesized drums need this more than recorded ones.
- **Peaks.** Soft clipping or compression on the drum bus trims the first millisecond of the kick and snare. It costs little punch and gives back several decibels of headroom, which the jam mix needs.
- **Level against the band.** In a full mix the kick and snare peaks are usually the highest in the track while their average level is low. In a practice backing they should sit under the guitar the player is listening to.

## Where recordings still win

| Piece | How close synthesis gets | What a recording has that we do not |
|---|---|---|
| Kick | Close. A damped kick is a simple object | The air and the shell of one particular drum; the room |
| Snare | Fairly close for backbeats and ghost notes | The exact rattle of the wires; rimshots; rolls and buzzes |
| Toms | Close | Sympathetic ringing of the rest of the kit |
| Cross-stick | Close | The stick's own voice |
| Closed hi-hat | Fair. The tick is easy, the metal is the hard part | The dozens of half-open sounds between closed and open |
| Open hi-hat, ride | Fair. The ping and wash are there, the fine shimmer is statistical | The true bloom; the bell; a famous cymbal's character |
| Crash | The weakest piece. It reads as a crash, and it is not one | Everything about the first half second |
| Brushes | Sweeps fair to good, taps fair | The grain of wire on coating |
| The whole kit | Dynamics and feel can be as good as we write them | A drummer's choices; the room; bleed between microphones |

If the owner wants a truly real kit one day, the efficient answer is the one the commercial modelled kit chose: synthesize the drums and record our own cymbals (a dozen one-shots). The machine kit has no such gap: it is the real thing.

## The plan for vibrato~

Everything is in one AudioWorklet, built on S1's pattern: a pure TypeScript core that renders in Node tests, a thin worklet wrapper, a main-thread voice, and the sound lab for the ears.

**Kits.** `acoustic`, `machine` and `brushes`, as in the table at the top. Each kit has the same thirteen dials (kick tune, decay and punch; snare tune, wires and decay; hi-hat tone and length; cymbal tone and ring; room; drive; variation) with its own defaults.

**Every stroke** has a velocity that changes its tone as well as its level, and a small seeded variation in strike point, hardness and level. Pitch and timing never vary inside the synth: timing belongs to the groove.

**Grooves** (`src/lib/audio/drumGrooves.ts`), as plain data like `buildJamBar`:

| Groove | For | What it plays |
|---|---|---|
| Straight 8ths | Rock and pop entries | Hi-hat eighths with a strong and weak hand, kick on 1 and 3 with a pushed variation, snare on 2 and 4, a ghost note |
| Shuffle | The blues entries | The swung pair on the hi-hat, backbeat on 2 and 4, kick on 1 and 3 with a swung pickup |
| Swing | The jazz entries | The ride pattern (1, 2, the swung "and" of 2, 3, 4, the swung "and" of 4), hi-hat foot on 2 and 4, a feathered kick, sparse snare and cross-stick comping |
| 16ths | City pop, the Dorian vamp | Sixteenth-note hi-hat with accents on the beat, a syncopated kick, snare on 2 and 4, ghost notes |

- The swung "and" is at `SWING_OFFSET`, the same constant the bass and guitar use.
- A short fill ends each pass, and the kit's crash marks the top of the next. On forms shorter than four bars both come every second pass (see below).
- Humanizing is bounded and computed from the bar and the position, never accumulated.

**The bus.** A small stereo room, soft clipping on the drums, a 30 Hz high-pass, and a ceiling that no pile-up of strokes can pass. The measured levels are in the spec. They showed that the jam's mix had no headroom left before the drums arrived, so the whole jam was made 3 dB quieter, with the owner's approval.

**Cost.** Measured: three to six units for a groove (a unit is one sounding bass string, 40 ns a sample), which is 0.5 to 1.2% of one processor core on the development machine. The cymbals are most of it. The table is in the spec.

## Decisions for the owner

1. **The swing ratio.** The whole jam swings at 2:1. The measurements above say a drummer at 80 BPM would be nearer 3:1, and that the ratio should fall as the tempo rises. If the blues feels stiff at slow tempos, the first thing to try is a tempo-dependent `SWING_OFFSET` for all four layers together: about 0.72 of the beat at 60 BPM, two thirds at 120 to 140, easing towards 0.6 by 220. It is one constant today, so it is a small change, but it changes the guitar and bass too.
2. **Short forms.** A drummer marks a 4-, 8- or 12-bar form, not every second bar. On the two- and three-bar vamps the drums fill and crash every second pass. P2.2's noise cymbal, which the drums replace only while they are up, still marks every pass.
3. **Cymbals.** If the acoustic kit's crash and ride are the part that does not convince, recording a dozen cymbal one-shots of our own would close most of the gap, and would stay inside the "no sample packs" rule.

## Sources

Acoustics of drums and cymbals:

- [1] N. H. Fletcher, T. D. Rossing, *The Physics of Musical Instruments*, 2nd ed., Springer, 1998. Chapters 3 (membranes and plates), 18 (drums) and 20 (cymbals, gongs).
- [2] T. D. Rossing, "Acoustics of drums," *Physics Today* 45(3), 40–47, 1992. Also T. D. Rossing, *Science of Percussion Instruments*, World Scientific, 2000.
- [3] A. Chaigne, C. Touzé, O. Thomas, "Nonlinear vibrations and chaos in gongs and cymbals," *Acoustical Science and Technology* 26(5), 403–409, 2005.
- [4] T. D. Rossing, "Acoustics of percussion instruments: recent progress," *Acoustical Science and Technology* 22(3), 177 ff., 2001.
- [5] Q. B. Nguyen, C. Touzé, "Nonlinear vibrations of thin plates with variable thickness: application to sound synthesis of cymbals," *Journal of the Acoustical Society of America* 145(2), 977–988, 2019.
- [8] H. Fletcher, I. G. Bassett, "Some experiments with the bass drum," *Journal of the Acoustical Society of America* 64(6), 1570–1576, 1978.
- [9] T. D. Rossing, I. Bork, H. Zhao, D. O. Fystrom, "Acoustics of snare drums," *Journal of the Acoustical Society of America* 92(1), 84–94, 1992.

Physical models:

- [6] S. Bilbao, "Percussion synthesis based on models of nonlinear shell vibration," *IEEE Transactions on Audio, Speech, and Language Processing* 18(4), 872–880, 2010.
- [7] M. Ducceschi, C. Touzé, "Modal approach for nonlinear vibrations of damped impacted plates: application to sound synthesis of gongs and cymbals," *Journal of Sound and Vibration* 344, 313–331, 2015.
- [12] F. Avanzini, R. Marogna, "A modular physically based approach to the sound synthesis of membrane percussion instruments," *IEEE Transactions on Audio, Speech, and Language Processing* 18(4), 891–902, 2010.
- [13] S. Bilbao, "Time domain simulation and sound synthesis for the snare drum," *Journal of the Acoustical Society of America* 131(1), 914–925, 2012.
- [31] X. Serra, J. O. Smith, "Spectral modeling synthesis: a sound analysis/synthesis system based on a deterministic plus stochastic decomposition," *Computer Music Journal* 14(4), 12–24, 1990. The idea of splitting a sound into tones and noise.
- [32] K. van den Doel, P. G. Kry, D. K. Pai, "FoleyAutomatic: physically-based sound effects for interactive simulation and animation," *Proc. SIGGRAPH*, 537–544, 2001. Scraping and rolling as noise into modal resonators.
- [33] US patent 4,181,059, "Circuit for simulating sound of wire brush rotated around head of snare drum," 1980.

Drum machines and synthesis recipes:

- [10] K. J. Werner, J. S. Abel, J. O. Smith, "A physically-informed, circuit-bendable, digital model of the Roland TR-808 bass drum circuit," *Proc. Digital Audio Effects (DAFx-14)*, Erlangen, 2014.
- [11] K. J. Werner, J. S. Abel, J. O. Smith, "The TR-808 cymbal: a physically-informed, circuit-bendable, digital model," *Proc. ICMC/SMC*, Athens, 2014.
- [25] G. Reid, "Synth Secrets" series, *Sound on Sound*: "Synthesizing drums: the bass drum" (January 2002), "Practical bass drum synthesis" (February 2002), "Synthesizing drums: the snare drum" (March 2002), "Practical snare drum synthesis" (April 2002).
- [26] G. Reid, "Analysing metallic percussion," *Sound on Sound*, May 2002.
- [27] G. Reid, "Synthesizing realistic cymbals," *Sound on Sound*, June 2002.
- [30] IK Multimedia MODO DRUM (released 2019): the review in *Sound on Sound*, and the maker's description of its "hybrid" engine of modal synthesis and sampling.
- Roland Corporation, *TR-808 Service Notes*, 1981, and *TR-909 Service Notes*, 1984: the circuits themselves.

Feel:

- [14] A. Friberg, A. Sundström, "Swing ratios and ensemble timing in jazz performance: evidence for a common rhythmic pattern," *Music Perception* 19(3), 333–349, 2002.
- [15] H. Honing, W. B. de Haas, "Swing once more: relating timing and tempo in expert jazz drumming," *Music Perception* 25(5), 471–476, 2008.
- [16] C. Dittmar, M. Pfleiderer, S. Balke, M. Müller, "A swingogram representation for tracking micro-rhythmic variation in jazz performances," *Journal of New Music Research* 47(2), 97–113, 2018.
- [17] J. Frühauf, R. Kopiez, F. Platz, "Music on the timing grid: the influence of microtiming on the perceived groove quality of a simple drum pattern performance," *Musicae Scientiae* 17(2), 246–260, 2013.
- [18] M. Davies, G. Madison, P. Silva, F. Gouyon, "The effect of microtiming deviations on the perception of groove in short rhythms," *Music Perception* 30(5), 497–510, 2013.
- [19] O. Senn, L. Kilchenmann, R. von Georgi, C. Bullerjahn, "The effect of expert performance microtiming on listeners' experience of groove in swing or funk music," *Frontiers in Psychology* 7, 1487, 2016.
- [20] H. Hennig, R. Fleischmann, A. Fredebohm, Y. Hagmayer, J. Nagler, A. Witt, F. J. Theis, T. Geisel, "The nature and perception of fluctuations in human musical rhythms," *PLoS ONE* 6(10), e26457, 2011.
- [21] E. Räsänen, O. Pulkkinen, T. Virtanen, M. Zollner, H. Hennig, "Fluctuations of hi-hat timing and dynamics in a virtuoso drum track of a popular music recording," *PLoS ONE* 10(6), e0127902, 2015.
- [22] M. W. Butterfield, "Participatory discrepancies and the perception of beats in jazz," *Music Perception* 27(3), 157–176, 2010.
- [23] A. Danielsen, C. H. Waadeland, H. G. Sundt, M. A. G. Witek, "Effects of instructed timing and tempo on snare drum sound in drum kit performance," *Journal of the Acoustical Society of America* 138(4), 2301–2316, 2015.
- [24] S. Dahl, "The playing of an accent: preliminary observations from temporal and kinematic analysis of percussionists," *Journal of New Music Research* 29(3), 225–233, 2000.
- [34] V. Iyer, "Embodied mind, situated cognition, and expressive microtiming in African-American music," *Music Perception* 19(3), 387–414, 2002.

Recording and mixing:

- [28] R. Izhaki, *Mixing Audio: Concepts, Practices and Tools*, 3rd ed., Routledge, 2017.
- [29] B. Owsinski, *The Mixing Engineer's Handbook*, 4th ed., 2017.

Open-source code worth reading to learn, not to copy: the percussion voices of Mutable Instruments' Plaits module (É. Gillet), which model the 808's kick, snare and hi-hat circuits.
