# Making instrument sounds ourselves

**Package S1, part 1: research.** Written 2026-11-13.
**Built from it:** the modelled bass in `src/lib/audio/synth/`, described in [specs/S1-modelled-bass.md](../specs/S1-modelled-bass.md).

This note answers two questions. Why does a synthesized instrument sound cheap? And what do the people who make professional instrument sounds do about it? It ends with a plan for each instrument vibrato~ could play.

The owner's constraint shapes the answers: we write the sound code ourselves, with no third-party synthesis code and no sample packs. Tone.js stays for scheduling and routing. Numbers in square brackets point to the sources at the end.

Four words used throughout:

- A **partial** is one of the pure tones that add up to a note. On a string they sit close to whole multiples of the lowest one (the **fundamental**), so they are also called harmonics.
- **Timbre** is everything about a note that is not its pitch, loudness or length: the balance of its partials, and how that balance changes while the note sounds.
- **T60** is the time a sound takes to fall by 60 dB, which is roughly to silence.
- A **delay line** is a memory that plays back what went into it a fixed time ago. It is how a program imitates a wave travelling along a string.

## The short version

1. **A synthesized note sounds cheap when nothing in it moves.** There are four kinds of stillness: the waveform repeats exactly from cycle to cycle, all the partials fade together, a harder note is only louder, and the same note twice is the same sound twice. A real instrument is never still in any of these ways. Research on how we tell instruments apart says the same thing from the listener's side: the attack and the way the spectrum changes over time carry as much of an instrument's identity as its steady tone [20, 21, 22].
2. **There are three ways to make an instrument sound:** play back recordings (sampling), simulate the mechanism (physical modelling), or mix the two (hybrids). For a plucked string, modelling is small, cheap to run and well understood. Forty years of published work show how to do it [1 to 8], and a string turns out to be a delay line with a filter in a loop.
3. **For a plucked string these details matter most,** roughly in this order (our judgement, drawn from the sources):
   - each partial fades at its own rate, the high ones fastest;
   - where the string is plucked and where the pickup sits, because each removes a regular pattern of partials;
   - the pluck itself: finger or pick, and how hard;
   - how the note ends: a finger damps the string, it is not a volume fade;
   - stiffness, which makes the waveform change shape as the note rings;
   - the pickup and amplifier, including their mild distortion;
   - small differences from one note to the next.
4. **Three things we did not expect:**
   - The pickup is fixed to the body, so its effect on the tone changes with every fretted note. Many simple string models place it at a fixed fraction of the string and lose this.
   - The textbook loss filter cannot damp a bass string enough at 48 kHz. A low string's wave travels 1.7 m per round trip and loses far more treble on the way than a three-point average can remove. The fix is in "Losses" below.
   - Matching two bass sounds by RMS level does not make them equally loud. The one with more harmonics sounds louder, most of all on small speakers. The sound lab can match either way.
5. **On laptop speakers a bass is heard through its harmonics.** The fundamental of the low E is 41 Hz, which small speakers do not reproduce. The ear rebuilds the pitch from the partials above it [35, 36]. A bass sound for this app needs strong, well-shaped partials between about 80 and 800 Hz, and the amplifier stage is there to help make them.
6. **Compare sounds at matched loudness or not at all.** The louder of two sounds tends to be preferred, so listening standards require levels to be aligned first [34].

The plan, in one table. Details are in "The plan for vibrato~" below.

| Instrument | Technique | When |
|---|---|---|
| Electric bass | Modelled string: delay loop, loss filter, stiffness, pluck and pickup positions, pickup and amp | Now (S1) |
| Guitar | Keep the recordings the owner likes. Later: the same string model, six strings, for a clean electric | After the bass is judged |
| Electric piano | A few decaying partials per note, then a pickup distortion that makes harder notes bark | Next keyboard sound |
| Organ | 91 always-running sine generators mixed by drawbars, then a rotating-speaker effect | Best fit for a blues backing |
| Drums | Synthesized kick and snare. Cymbals are the hard case | With song form (P5) |
| Pads | Several detuned, alias-free sawtooths, slow filter movement, stereo chorus | When the pad is revisited |

## Why today's bass sounds cheap

`BassVoice` (`src/lib/audio/bassVoice.ts`) is a sawtooth and a triangle wave at the same pitch, through a 700 Hz low-pass, with a volume envelope (5 ms attack, 0.25 s decay, 0.15 s release) and a short filter sweep. It is a sensible, sturdy synth bass. Set against the list above:

| What a real bass does | What `BassVoice` does |
|---|---|
| Partials fade at different rates, so the tone mellows over a second or two | One filter sweep in the first 120 ms, then the tone is fixed |
| Partials are slightly sharp of whole multiples, so the waveform keeps changing shape | Exact multiples, locked together: every cycle is identical |
| The pluck and pickup positions remove a pattern of partials that changes with the note | The same harmonic recipe for every note |
| A harder pluck is brighter and starts slightly sharp | A harder note is only louder |
| Each pluck differs a little | Each note is identical |
| The note ends when a finger damps the string | The level ramps down over 150 ms |

Nothing here is a bug. A sawtooth through a filter is a different instrument: a synth bass. Making it sound like a bass guitar means changing the method, not tuning the envelope.

## Three ways to make an instrument sound

Smith's history of digital synthesis [11] sorts methods into processed recordings, spectral models, physical models and abstract algorithms such as FM. The first and third matter here.

### Sampling

Record the real instrument and play the recordings back [12].

- **How the professionals do it.** They record every note, or every few notes, at several loudness levels (velocity layers), with several takes of each (round robins, so a repeated note does not repeat a recording), and with separate recordings for note endings, mutes, slides and other articulations. Basses and guitars are often sampled string by string, and recorded straight from the pickup so the amplifier can be modelled afterwards. A playback engine chooses the recording and transposes it to fill gaps. Large libraries run to tens of gigabytes.
- **What it is good at.** It is the real sound, with the body, the room and the microphone included for free. It is the best choice where the physics is hard: an acoustic guitar's body, cymbals, a choir.
- **Where it falls short.**
  - A recording is fixed. Crossing from one velocity layer to the next is a jump in timbre, or a blend of two recordings that do not line up.
  - Transposing a recording moves the body's resonances along with the pitch, which sounds wrong beyond two or three semitones.
  - A note's length is the recording's length, so long notes need loops.
  - It needs recording sessions or licensed material. The owner has ruled out sample packs.
- **In vibrato~ today.** The guitars work this way: CC0 recordings (`public/audio/`), a soft and a normal layer, the played string preferred, takes rotated, never transposed far (`chooseSample` in `src/lib/audio/instruments.ts`). The owner likes them.

### Physical modelling

Simulate the mechanism and let the sound be the by-product.

- **The digital waveguide.** A wave on a string is two travelling waves moving in opposite directions and reflecting at the ends. A delay line holds a travelling wave exactly, so a string is a loop of delay with a filter where the ends would be [3, 4]. Karplus and Strong found the algorithm by experiment in 1983 [1]. Jaffe and Smith explained it as a string, and added exact tuning, control of decay, the pluck position and a brightness that follows dynamics [2]. Välimäki, Karjalainen and colleagues turned it into an engineering method, the single delay loop, with filters measured from real instruments [5, 6, 7, 8].
- **Other families.**
  - *Modal synthesis:* one small resonator for each mode of vibration, all summed [29]. It suits bars, bells, drums and tines, which have few modes at awkward frequencies.
  - *Finite differences:* solve the equations of motion on a grid [10]. It is the most general method and the most expensive.
- **A rule of thumb.** A delay line is the cheapest way to get hundreds of harmonic partials. A bank of resonators is the most flexible way to get a few inharmonic ones. The low E of a bass has about 480 partials below 20 kHz. The delay loop produces all of them for the cost of a few multiplications per sample.
- **What it is good at.** It needs no recordings and almost no memory. It responds continuously to how it is played: any loudness, any pluck point, any note length. No two notes need be the same. The controls are physical ("move the pickup towards the bridge").
- **Where it falls short.** A recording contains everything. A model contains only what was put in. Bodies and strongly nonlinear things (cymbals, a string buzzing on frets) are hard. A model needs tuning by ear against the real thing.
- **In products.** Yamaha's VL1 (1994) was the first commercial waveguide synthesizer. Pianoteq models a piano in a few megabytes. IK Multimedia's MODO BASS models an electric bass with modal synthesis and no samples.

### Hybrids

- **Commuted synthesis** [13, 14]. A plucked acoustic guitar is a chain: pluck, then string, then body. The string and body are linear, so their order can be swapped without changing the result. Put the body first: record the body's response to a tap once, and use that short recording as the "pluck" that excites the string model. The body's hundreds of resonances then cost nothing while the note plays. This is how a waveguide acoustic guitar is made convincing [7, 17]. It only works for the linear parts, so a distorting amplifier cannot be folded in this way.
- **Sample the attack, model the rest.** A short recorded attack leads into a modelled sustain, or a recorded dry signal goes through a modelled amplifier and cabinet. Most commercial bass and guitar libraries do the second.
- **For us.** Commuted synthesis is the route to a modelled acoustic guitar if we ever want one. The body response could be derived from the CC0 guitar recordings already in the repo.

### Side by side

| | Sampling | Physical modelling | Hybrid (commuted) |
|---|---|---|---|
| Size | megabytes to gigabytes | kilobytes of code | one short response per body |
| Realism of a single note | highest | good where the physics is modelled | high |
| Realism of a phrase | limited by layers and takes | high: every note is made fresh | high |
| Response to dynamics | steps between layers | continuous | continuous |
| Cost to make | recording sessions | research and tuning by ear | both, in small amounts |
| Fits the owner's constraint | only with our own recordings | yes | yes, with our own body responses |

## The details that matter

Each part says what happens on the real instrument, how a model does it, and what the modelled bass does. The bass's signal path, for reference:

```
pluck shape → pluck-position comb → [ delay line → stiffness filters → loss filter ] (a loop)
            → pickup-position comb → pickup response → amp → cabinet
```

### 1. The excitation: finger or pick, and where

- **Real.** A pluck pulls the string into a shallow triangle and lets go. For an ideal pluck the partials fall off as 1/n² in the string's displacement, where n is the partial's number [9]. A magnetic pickup senses the string's velocity, not its displacement, which makes the fall-off 1/n and the sound brighter.
- **Where.** Plucking at a fraction β of the string's length scales partial n by sin(nπβ). A pluck one fifth of the way along removes partials 5, 10, 15 and so on. Near the bridge the tone is thin and nasal. Near the neck it is round and deep. Players use this all the time.
- **Finger or pick.** The string does not leave a fingertip instantly. It slides off soft flesh over a millisecond or two, which rounds the corner of the triangle and removes treble. A pick lets go in a fraction of a millisecond, so the sound is brighter and starts with a click. Models of the player's touch treat the finger as a damped spring pressed on the string [18].
- **How hard.** A harder pluck moves the string further and releases it more quickly, so it is brighter as well as louder.
- **Model.** The pluck is a short smooth pulse fed into the loop. Its width sets the brightness. The position is a comb filter: the pulse, and an inverted copy delayed by the time the wave takes to reach the end of the string and return [2]. A little noise mixed in stands for skin sliding over the windings.
- **Our bass.** The pulse is 0.25 ms wide for a pick and up to 2.4 ms for a soft fingertip, and it narrows with velocity. The pluck point is set as a distance from the bridge in centimetres, because the hand stays put while the sounding length changes with the fretted note.

### 2. Losses that depend on frequency, and decay

- **Real.** A plucked note starts bright and mellows, because high partials fade faster than low ones. The string loses energy to internal friction, to the air, and through its ends into the bridge and neck [9, 16]. Worn strings, and flatwound strings, lose treble far faster than new roundwound ones. That is most of the difference between a bright modern tone and a 1960s thump.
- **Model.** The wave passes a gentle low-pass filter, the loop filter, once per round trip [1, 5]. If the filter's gain at some frequency is G, and the note's frequency is f0, a partial there has T60 = 6.91 / (−f0 · ln G) seconds. The filter can be designed straight from the decay times wanted [15].
- **The trap.** Textbook models use a three-point average as the loop filter because it adds no pitch error. At 48 kHz it can remove at most 1.7% of a 2 kHz partial per round trip. The low E makes only 41 round trips a second, so that partial would ring for ten seconds. A real one lasts a second or less. A one-pole low-pass can be set as dark as needed. Its delay varies with frequency, so the tuning has to account for it.
- **How exact must it be?** Not very. In listening tests, changes of 25 to 40% in a plucked string's decay time went unnoticed [24]. The shape matters (treble first), the exact figures do not.
- **Dead spots.** On some notes the neck resonates at the string's frequency and drains it, so the note dies early [19, 28]. A model does not have these unless they are added. For a practice backing, their absence is welcome.
- **Two-stage decay.** A string vibrates both towards the body and across it, at slightly different frequencies. The two beat slowly, and the note fades fast at first and then slowly [27]. It matters for guitar and piano. For a bass note of a second or two it is not worth doubling the cost.
- **Our bass.** The loop filter is a one-pole low-pass designed per note from two targets: the fundamental's T60 (about 9 s) and the T60 at 1 kHz (1.6 s for fairly new strings, down to 0.2 s for dead ones).

### 3. Dispersion and inharmonicity

- **Real.** A string is slightly stiff, like a thin bar, and stiffness makes high frequencies travel faster than low ones. This is dispersion. The partials come out sharp of whole multiples: partial n is at n · f0 · √(1 + B·n²), where B is the inharmonicity coefficient [9, 25]. Thick, short strings have the most: a bass's low strings and a piano's.
- **Why it matters.** Because the partials are not exact multiples, they drift against each other and the waveform never repeats. This is a large part of why a low string growls where a sawtooth buzzes. It can be heard directly as well, and listening tests found that the lower the note, the less inharmonicity it takes to hear it [23].
- **Model.** All-pass filters in the loop delay low frequencies more than high ones without changing their level. The delay line is shortened to keep the fundamental in tune [26].
- **Pitch that depends on loudness.** A string stretches as it swings, which raises its tension. A hard pluck therefore starts a few cents sharp and settles as the note fades [30]. On a bass this bloom is part of the attack.
- **Our bass.** Six first-order all-pass filters, solved for each note so that a partial near 1 kHz lands where the stiff-string formula puts it. B is estimated from the core wire of each string: about 1.4 × 10⁻⁴ for the open E, down to 2 × 10⁻⁵ for the open G, rising as the string is fretted shorter. The bloom is 6 cents at full velocity by default, and it can be turned off.

### 4. Nonlinearity: pickup, amp, saturation

A linear device gives the same tone at any level. A nonlinear one changes the tone as the level rises, which is one reason real instruments sound different when played hard.

- **The pickup.** The string moves in a magnetic field that is stronger closer to the magnet, so the output is not proportional to the string's motion. This adds even harmonics that grow with level [32, 33].
- **The amplifier.** Valves, transformers and loudspeakers compress and add harmonics as they are driven [37]. A bass is rarely heard entirely clean, and a little saturation helps it on small speakers (see the short version, point 5).
- **String against fret.** A hard pluck makes the string rattle on the frets. Slap playing is built on this. It needs a collision model [39, 40] and is not in S1.
- **The digital pitfall.** Distortion makes new high partials. Any that land above half the sample rate fold back as tones that do not belong to the note (aliasing). Heavy distortion needs oversampling or antiderivative anti-aliasing [38]. A light saturation of a signal with little energy above 4 kHz, as on our bass, does not.
- **Our bass.** The pickup's sensitivity varies a little with the string's position. The amp is an asymmetric soft clipper with a gentle default drive.

### 5. The body, pickup or cabinet response

- **Acoustic instruments.** The body is a resonator with hundreds of modes. It decides the instrument's character and is the hardest part to model. Commuted synthesis, above, sidesteps it [14, 17].
- **Electric instruments.** The solid body barely radiates. The pickup and what follows it are the "body".
  - *Pickup position.* A pickup at a fraction γ of the sounding length scales partial n by sin(nπγ), the same rule as the pluck [31, 32]. The pickup is fixed to the body. When a note is fretted the sounding length shrinks, γ grows, and the pattern of missing partials moves. Each note gets a different filter, and each string sounds different at the same pitch.
  - *Pickup width.* A pickup senses a short length of string, not a point, which removes some treble, more on slow, heavy strings [32].
  - *Pickup circuit.* The coil's inductance and the cable's capacitance form a resonant low-pass filter at a few kilohertz. The tone control pulls it down [32].
  - *Cabinet.* A bass speaker gives little above about 4 kHz and little below about 40 Hz.
- **Our bass.** Pickup position in centimetres from the bridge (14 cm by default, about where a Precision-style split coil sits on a 34-inch scale, going by players' measurements, not a maker's specification). A resonant low-pass for the pickup circuit, labelled Tone. A 4 kHz low-pass and a 35 Hz high-pass for the cabinet.

### 6. Variation from note to note

- **Real.** No two plucks are the same. The finger lands in a slightly different place with slightly different force, and index and middle fingers alternate.
- **Sampling's answer.** Round robins: several takes of each note, played in rotation. Without them, repeated notes give the "machine-gun" effect.
- **Model.** Vary the pluck point, hardness and strength by a few percent on each note, and alternate two "fingers" with slightly different settings. The noise in the pluck is new every time.
- **What must not vary.** Timing and pitch. This is a practice tool, and the band has to be dependable.
- **Our bass.** Position, hardness and level vary by a few percent under one Variation control. A seeded random generator keeps the tests repeatable.

### 7. Velocity that changes the timbre, not only the level

- **Real.** On nearly every instrument, louder means brighter. Risset and Mathews showed in the 1960s that a synthetic trumpet only convinced once its spectrum widened with loudness [22]. A recording of a loud note turned down does not sound like a soft note.
- **Sampling's answer.** Velocity layers, with the jumps described above.
- **Model.** Jaffe and Smith used a low-pass filter on the excitation whose cutoff follows the dynamic level [2].
- **Our bass.** Three mechanisms, all following velocity: the pluck pulse narrows, the pickup and amp distort more, and the pitch bloom grows.

### 8. Release and damping noises

- **Real.** A bass note ends when something touches the string: the fretting finger relaxes, or the plucking finger comes to rest on the string ready for the next note. The string stops within a few cycles, treble first, sometimes with a faint thump. Before a repeated note on the same string, the finger lands and silences the string for a few hundredths of a second, then plucks. That small gap is what makes a line sound articulated and not smeared.
- **Sampling's answer.** Release samples, and recorded fret and finger noises mixed in at low level.
- **Model.** Raise the loop's loss sharply when the note ends, so the string stops the way a damped string does. Feed in a small soft pulse for the finger landing.
- **Our bass.** A note-off damps the string in about 80 ms. A new note on a string that is still ringing damps it 25 ms before the pluck. A new note on another string lets the old one overlap as it is muted.
- **Not in S1.** Slides, hammer-ons and finger squeaks. They belong to phrases, not single notes, and need the bass line to ask for them.

### 9. Stereo and space

- **Bass.** Keep it mono, central and nearly dry. Low frequencies carry little sense of direction, and reverb on a bass clouds the whole mix. The engine already routes the bass around the room effect.
- **Width.** For pads and keyboards, width comes from differences between left and right: chorus voices with different phases, or slightly detuned copies. Check the sum in mono, because laptop speakers are close to mono.
- **One room.** Sending every instrument to the same reverb puts them in the same space. Artificial reverb is its own field [44, 45, 46]. The engine's convolution room is enough for now.
- **Space as part of the instrument.** An organ's rotating speaker is an effect, but the instrument is not itself without it [48].

### 10. Gain staging and loudness matching

- **Headroom.** Each voice should peak well below full scale before the master, so the limiter is a safety net and not a mixer. P2.1 found the guitar alone hitting the limiter, which left no room for bass or pad.
- **Peak and RMS.** A plucked sound has a sharp attack, so its peak is far above its average (RMS) level. A sustained synth is the opposite. Two sounds at the same RMS can have peaks 6 dB apart.
- **Loudness is not RMS.** The ear is less sensitive to low frequencies, and more so at low listening levels. Broadcast loudness measurement therefore filters the signal before averaging it (K-weighting [34]): it turns down the deepest bass and turns up the treble slightly. For two bass sounds at equal RMS, the one with more harmonics measures, and sounds, louder.
- **Always match before comparing.** Otherwise the louder one wins. The lab matches by RMS by default, as the brief asked, and can match by K-weighted loudness instead. On small speakers the second is the fairer comparison.
- **Our bass.** The model's output gain is set so its RMS over a reference line equals `BassVoice`'s. The jam's measured levels and the P2.2 faders then mean the same thing for either bass.

## The plan for vibrato~

Cost is given in units of one sounding bass string. The measured figure for that unit is in the S1 spec. Costs for instruments not yet built are estimates from counting the arithmetic per sample.

| Instrument | Technique | Key parameters | Cost in an AudioWorklet | Where recordings would still win |
|---|---|---|---|---|
| **Electric bass** (S1, built) | Single delay loop per string; one-pole loss filter; six all-pass stiffness filters; pluck and pickup combs at physical distances; pickup low-pass; soft-clip amp; cabinet filters | Pluck hardness and position; pickup position; tone; string age (T60 at 1 kHz); sustain; stiffness; drive; pitch bloom; release time; variation | 1 unit per sounding string. A line keeps 1 to 2 sounding | Slides, hammer-ons, slap and ghost notes; the feel of a real player; the stamp of one famous bass and amp |
| **Guitar** | Keep the recordings. For a modelled clean electric: the bass's string model on six strings, a pick pulse, both directions of vibration for shimmer, two pickup positions, a brighter pickup filter, a clean amp with spring reverb | As the bass, plus pickup selector, pick angle, strum spread | About 1.5 units per string, 9 for a full strum | The acoustic guitar's body and the sound of a strum. A commuted model with our own body response would narrow the gap, but the owner already likes the recordings |
| **Electric piano** (tine type) | Per note: a hammer pulse into 2 to 4 decaying partials (the tine's fundamental and the short inharmonic "bell" of the attack [41]); then a pickup nonlinearity that adds harmonics with level (the bark) [32]; a damper on release; stereo tremolo and a mild amp | Hammer hardness; pickup distance and offset (the instrument's "voicing"); bell level and decay; tremolo rate and depth; drive | About 0.5 unit per note. Ten notes held is 5 units | Key and damper noises, and the unevenness from note to note that gives one old instrument its character. An FM pair is a cheaper alternative with its own classic sound [43] |
| **Organ** (tonewheel) | 91 sine generators that never stop, as in the real instrument; each key connects nine of them through the drawbars; key click from the contacts closing at slightly different times; percussion; a vibrato scanner; a rotating-speaker effect with separate horn and drum, Doppler shift and tremolo [47, 48] | Drawbar settings; click and leakage amounts; percussion; rotor speed (slow about 0.8 Hz, fast about 6.7 Hz) and how quickly it changes; drive | About 6 to 8 units in total, the same for one note or ten | Very little. The instrument is additive synthesis already. A real rotating speaker in a real room is the part that is hard to match |
| **Drums** | *Kick:* a sine whose pitch drops quickly, a click, saturation [50]. *Snare:* two short pitched modes plus filtered noise for the wires. *Toms:* a few modes at a drumhead's ratios [9]. *Hats and cymbals:* a dense set of inharmonic partials with noise [49, 51] | Per drum: pitch, pitch drop, decay, noise balance, tone. For the kit: swing, accents and ghost notes | Kick, snare and toms under 1 unit each. A cymbal built from 200 modes is about 10 units | Cymbals, hi-hats and brushes. A cymbal's vibration is chaotic [51], and the cheap methods sound like a drum machine. If the music wants a real kit, record our own one-shots for the cymbals and synthesize the drums |
| **Pads** | Several alias-free sawtooths per note, slightly detuned, with random starting phases [52, 53]; a filter that moves slowly; a stereo chorus [45]; the shared room | Voices per note and detune; filter cutoff and movement; chorus depth; width; attack and release | About 3 units for a four-note chord | Real string sections and choirs. A pad is not trying to be either |

Notes for whoever builds each one:

- **Electric bass.** Everything above is in the S1 spec. The next steps, if the owner wants more, are slides into notes and a compressor.
- **Guitar.** Do nothing until asked. The first use for a model would be something recordings do badly: long sustained notes, bends and vibrato for ear training.
- **Electric piano.** The pickup nonlinearity is the instrument. Get the bark right before anything else, and loudness-match against a reference at three velocities.
- **Organ.** The best next instrument for a blues or jazz backing. It is cheap, it suits synthesis, and it can replace the pad. The rotating speaker is half the sound. Build it as a reusable effect.
- **Drums.** Feel matters more than timbre: swing, accents and ghost notes. Start with kick, snare and a ride pattern for the blues. P2.2's cymbal is filtered noise. A set of inharmonic partials under it would be the first upgrade.
- **Pads.** Today's `PadVoice` is one sawtooth per note into a chorus. Detuned pairs with random phases, a filter that drifts slowly, and true stereo would lift it for little work.

### What every instrument should reuse

The bass was written so the next instruments start from parts, not from nothing. In `src/lib/audio/synth/dsp/`:

- a delay line with smooth fractional reads (strings, chorus, rotating speaker);
- biquad filters, and the design of loss and stiffness filters from physical targets;
- a soft clipper;
- a seeded random source, for variation that tests can repeat;
- loudness meters: peak, RMS and K-weighted.

The pattern is also meant to be reused: a pure TypeScript core that renders in Node tests, a thin AudioWorklet wrapper, a main-thread voice with `play`, `stop` and `dispose`, and the sound lab for judging by ear.

### Rules for sound code in an AudioWorklet

- The audio thread calls `process` every 128 samples, about every 2.7 ms at 48 kHz, and a late answer is a click. Keep the total well under a tenth of that.
- Allocate nothing while rendering: no arrays, objects or closures inside `process`. Garbage collection on the audio thread is a click too.
- Send notes ahead of time with their start times and place them to the sample inside the worklet. Messages to a worklet arrive late and unevenly.
- Put silent voices to sleep and zero their memory. A filter left to decay for ever reaches numbers so small that some processors slow down badly on them (denormals).
- Work in hertz and seconds, never in samples, so the sound is the same at 44.1, 48 and 96 kHz.

## How we check a sound

1. **Numbers first.** Tuning within 2 cents across the range. Decay times in a sensible range, with treble fading first. No invalid numbers. The cost. The tests in `src/lib/audio/synth/` do this for the bass.
2. **Then ears, at matched loudness.** A/B against the old sound, flipping while it plays, alone and inside the backing.
3. **On the speakers that matter.** Laptop speakers and headphones. A bass that is only good on big speakers is no use here.
4. **Over time.** A sound that impresses for ten seconds can tire in ten minutes of practice. The owner should play along for a session before deciding.

## Sources

Books and surveys:

- [4] J. O. Smith, *Physical Audio Signal Processing*, W3K Publishing, 2010. Online at ccrma.stanford.edu/~jos/pasp. The standard text: waveguides, plucked strings, commuted synthesis, pickups.
- [8] V. Välimäki, J. Pakarinen, C. Erkut, M. Karjalainen, "Discrete-time modelling of musical instruments," *Reports on Progress in Physics* 69(1), 1–78, 2006.
- [9] N. H. Fletcher, T. D. Rossing, *The Physics of Musical Instruments*, 2nd ed., Springer, 1998. Plucked strings, stiff strings, drumhead modes.
- [10] S. Bilbao, *Numerical Sound Synthesis*, Wiley, 2009.
- [11] J. O. Smith, "Viewpoints on the history of digital synthesis," *Proc. International Computer Music Conference (ICMC)*, Montreal, 1991.
- [12] D. C. Massie, "Wavetable sampling synthesis," in M. Kahrs and K. Brandenburg (eds.), *Applications of Digital Signal Processing to Audio and Acoustics*, Kluwer, 1998.

Plucked strings:

- [1] K. Karplus, A. Strong, "Digital synthesis of plucked-string and drum timbres," *Computer Music Journal* 7(2), 43–55, 1983.
- [2] D. A. Jaffe, J. O. Smith, "Extensions of the Karplus-Strong plucked-string algorithm," *Computer Music Journal* 7(2), 56–69, 1983.
- [3] J. O. Smith, "Physical modeling using digital waveguides," *Computer Music Journal* 16(4), 74–91, 1992.
- [5] V. Välimäki, J. Huopaniemi, M. Karjalainen, Z. Jánosy, "Physical modeling of plucked string instruments with application to real-time sound synthesis," *Journal of the Audio Engineering Society* 44(5), 331–353, 1996.
- [6] M. Karjalainen, V. Välimäki, T. Tolonen, "Plucked-string models: from the Karplus-Strong algorithm to digital waveguides and beyond," *Computer Music Journal* 22(3), 17–32, 1998.
- [7] V. Välimäki, T. Tolonen, "Development and calibration of a guitar synthesizer," *Journal of the Audio Engineering Society* 46(9), 766–778, 1998.
- [13] J. O. Smith, "Efficient synthesis of stringed musical instruments," *Proc. ICMC*, Tokyo, 1993.
- [14] M. Karjalainen, V. Välimäki, Z. Jánosy, "Towards high-quality sound synthesis of the guitar and string instruments," *Proc. ICMC*, Tokyo, 1993.
- [15] B. Bank, V. Välimäki, "Robust loss filter design for digital waveguide synthesis of string tones," *IEEE Signal Processing Letters* 10(1), 18–20, 2003.
- [16] J. Woodhouse, "Plucked guitar transients: comparison of measurements and synthesis," *Acta Acustica united with Acustica* 90, 945–965, 2004.
- [17] M. Karjalainen, J. O. Smith, "Body modeling techniques for string instrument synthesis," *Proc. ICMC*, Hong Kong, 1996.
- [18] G. Cuzzucoli, V. Lombardo, "A physical model of the classical guitar, including the player's touch," *Computer Music Journal* 23(2), 52–69, 1999.
- [19] H. Fleischer, T. Zwicker, "Investigating dead spots of electric guitars," *Acta Acustica united with Acustica* 85(1), 1999.
- [28] A. Paté, J.-L. Le Carrou, B. Fabre, "Predicting the decay time of solid body electric guitar tones," *Journal of the Acoustical Society of America* 135(5), 3045–3055, 2014.
- [54] T. I. Laakso, V. Välimäki, M. Karjalainen, U. K. Laine, "Splitting the unit delay: tools for fractional delay filter design," *IEEE Signal Processing Magazine* 13(1), 30–60, 1996. How to delay a signal by a fraction of a sample, which is what tunes a string.

Stiffness and tension:

- [25] H. Fletcher, E. D. Blackham, R. Stratton, "Quality of piano tones," *Journal of the Acoustical Society of America* 34(6), 749–761, 1962.
- [26] J. Rauhala, V. Välimäki, "Tunable dispersion filter design for piano synthesis," *IEEE Signal Processing Letters* 13(5), 253–256, 2006. See also J. S. Abel, V. Välimäki, J. O. Smith, "Robust, efficient design of allpass filters for dispersive string sound synthesis," *IEEE Signal Processing Letters* 17(4), 406–409, 2010.
- [27] G. Weinreich, "Coupled piano strings," *Journal of the Acoustical Society of America* 62(6), 1474–1484, 1977.
- [30] T. Tolonen, V. Välimäki, M. Karjalainen, "Modeling of tension modulation nonlinearity in plucked strings," *IEEE Transactions on Speech and Audio Processing* 8(3), 300–310, 2000.

Electric bass and guitar, pickups, amplifiers:

- [31] J. D. Tillman, "Response effects of guitar pickup position and width," 2000, revised 2002. till.com/articles/PickupResponse.
- [32] R. C. D. Paiva, J. Pakarinen, V. Välimäki, "Acoustics and modeling of pickups," *Journal of the Audio Engineering Society* 60(10), 768–782, 2012.
- [33] N. G. Horton, T. R. Moore, "Modeling the magnetic pickup of an electric guitar," *American Journal of Physics* 77(2), 144–150, 2009.
- [37] J. Pakarinen, D. T. Yeh, "A review of digital techniques for modeling vacuum-tube guitar amplifiers," *Computer Music Journal* 33(2), 85–100, 2009.
- [38] J. D. Parker, V. Zavalishin, E. Le Bivic, "Reducing the aliasing of nonlinear waveshaping using continuous-time convolution," *Proc. Digital Audio Effects (DAFx-16)*, Brno, 2016.
- [39] E. Rank, G. Kubin, "A waveguide model for slapbass synthesis," *Proc. IEEE ICASSP*, Munich, 1997.
- [40] P. Kramer, J. Abeßer, C. Dittmar, G. Schuller, "A digital waveguide model of the electric bass guitar including different playing techniques," *Proc. IEEE ICASSP*, Kyoto, 2012.
- [55] N. Lindroos, H. Penttinen, V. Välimäki, "Parametric electric guitar synthesis," *Computer Music Journal* 35(3), 18–27, 2011. The closest published design to our bass: a waveguide string with pick, pickup and tone-control models.
- [56] C. R. Sullivan, "Extending the Karplus-Strong algorithm to synthesize electric guitar timbres with distortion and feedback," *Computer Music Journal* 14(3), 26–37, 1990.

Hearing and judging:

- [20] J. M. Grey, "Multidimensional perceptual scaling of musical timbres," *Journal of the Acoustical Society of America* 61(5), 1270–1277, 1977.
- [21] S. McAdams, S. Winsberg, S. Donnadieu, G. De Soete, J. Krimphoff, "Perceptual scaling of synthesized musical timbres," *Psychological Research* 58, 177–192, 1995.
- [22] J.-C. Risset, M. V. Mathews, "Analysis of musical-instrument tones," *Physics Today* 22(2), 23–30, 1969.
- [23] H. Järveläinen, V. Välimäki, M. Karjalainen, "Audibility of the timbral effects of inharmonicity in stringed instrument tones," *Acoustics Research Letters Online* 2(3), 79–84, 2001.
- [24] H. Järveläinen, T. Tolonen, "Perceptual tolerances for decay parameters in plucked string synthesis," *Journal of the Audio Engineering Society* 49(11), 1049–1059, 2001.
- [34] ITU-R BS.1770-4, "Algorithms to measure audio programme loudness and true-peak audio level," 2015 (K-weighting). ITU-R BS.1116-3, "Methods for the subjective assessment of small impairments in audio systems," 2015 (level alignment before comparing).
- [35] B. C. J. Moore, *An Introduction to the Psychology of Hearing*, 6th ed., Brill, 2013. Pitch from harmonics when the fundamental is missing.
- [36] E. Larsen, R. M. Aarts, *Audio Bandwidth Extension*, Wiley, 2004. Using that effect to make small loudspeakers seem to play bass.

Other instruments, effects:

- [29] J.-M. Adrien, "The missing link: modal synthesis," in G. De Poli, A. Piccialli, C. Roads (eds.), *Representations of Musical Signals*, MIT Press, 1991.
- [41] L. Gabrielli, M. Cantarini, P. Castellini, S. Squartini, "The Rhodes electric piano: analysis and simulation of the inharmonic overtones," *Journal of the Acoustical Society of America* 148(5), 3052–3064, 2020.
- [43] J. M. Chowning, "The synthesis of complex audio spectra by means of frequency modulation," *Journal of the Audio Engineering Society* 21(7), 526–534, 1973.
- [44] M. R. Schroeder, "Natural sounding artificial reverberation," *Journal of the Audio Engineering Society* 10(3), 219–223, 1962.
- [45] J. Dattorro, "Effect design, part 1: reverberator and other filters" and "part 2: delay-line modulation and chorus," *Journal of the Audio Engineering Society* 45(9), 660–684 and 45(10), 764–788, 1997.
- [46] V. Välimäki, J. D. Parker, L. Savioja, J. O. Smith, J. S. Abel, "Fifty years of artificial reverberation," *IEEE Transactions on Audio, Speech, and Language Processing* 20(5), 1421–1448, 2012.
- [47] J. Pekonen, T. Pihlajamäki, V. Välimäki, "Computationally efficient Hammond organ synthesis," *Proc. DAFx-11*, Paris, 2011.
- [48] J. O. Smith, S. Serafin, J. S. Abel, D. Berners, "Doppler simulation and the Leslie," *Proc. DAFx-02*, Hamburg, 2002.
- [49] P. R. Cook, "Physically informed sonic modeling (PhISM): synthesis of percussive sounds," *Computer Music Journal* 21(3), 38–49, 1997.
- [50] K. J. Werner, J. S. Abel, J. O. Smith, "A physically-informed, circuit-bendable, digital model of the Roland TR-808 bass drum circuit," *Proc. DAFx-14*, Erlangen, 2014.
- [51] A. Chaigne, C. Touzé, O. Thomas, "Nonlinear vibrations and chaos in gongs and cymbals," *Acoustical Science and Technology* 26(5), 403–409, 2005.
- [52] V. Välimäki, A. Huovilainen, "Antialiasing oscillators in subtractive synthesis," *IEEE Signal Processing Magazine* 24(2), 116–125, 2007.
- [53] A. Szabo, "How to emulate the Super Saw," bachelor's thesis, KTH Royal Institute of Technology, Stockholm, 2010.

Open-source code worth reading to learn, not to copy: the Synthesis ToolKit (STK) by P. Cook and G. Scavone, and the physical-modelling library of the Faust language, both of which implement the string models in [4].
