# Vibrato

A guitar practice companion built with React, TypeScript, Tone.js, and Electron.

**Picking up work?** The plan, with what is done and what is next, is in [docs/ROADMAP.md](docs/ROADMAP.md). Current work happens on the `vibrato-next` branch.

## Daily practice

The Practice tab guides a ten-minute session in any of the twelve minor keys:

1. **Roots — 2 minutes:** find the root and fifth in a focused fretboard window.
2. **Scale — 3 minutes:** play a minor pentatonic loop up and down in eighth notes.
3. **Ear — 2 minutes:** distinguish the minor third, fifth, and minor seventh. Each question records one first answer.
4. **Changes — 3 minutes:** play over i–iv–V, with one four-beat bar per chord.

Choose a key, starting tempo, and guitar, then start. Each block has a four-beat count-in. Pause at any time, or use Space when focus is outside a form control. The clock counts active practice; count-ins, pauses, and rests between blocks do not consume the ten minutes. Leaving the tab pauses the session. At each break, assess how the block felt and continue when ready.

Pause to change guitar, metronome, or tempo-ramp settings. The optional scale ramp adds 4 BPM after every four loops, capped at 120 BPM. Volume, mute, and room ambience can change during playback.

Drafts and the last 100 results are saved in local storage on this device. The five most recent results appear below the practice screen. A reload restores an unfinished session paused. Finishing early saves a **short session**. Ratings describe the player's own assessment; Vibrato does not yet listen to or grade a physical guitar performance.

Notes, chords, scales, progressions, intervals, and theory remain available for exploration. The interval trainer preserves its aggregate first-answer score between visits.

## Sound and appearance

Three guitar banks are bundled locally: steel acoustic, nylon acoustic, and warm electric. The electric bank includes soft attacks and alternate takes. Playback uses string-aware sample selection and damping, directional strums, a room effect, and a limiter. Notes, count-ins, and visual cues share Tone's audio transport. Sound failures show a retry action.

See [sound credits](public/audio/CREDITS.md) for the CC0 recording sources and licenses. Regenerate the samples with Python 3 and ffmpeg:

```sh
python3 scripts/prepare-samples.py
```

The script uses pinned upstream revisions in `public/audio/sources.json`. It requires network access only when rebuilding samples. The generated manifest includes source URLs and SHA-256 hashes; tests check every shipped file. The packaged app needs no network access for guitar playback.

Vibrato's background uses a slowly merging WebGL field, airbrushed color bands, and film grain. Each key has a dominant color and related highlights. The footer offers Flow, Calm, and Still motion; the system's reduced-motion preference is honored. Animation stops in hidden tabs and Scholar mode. A CSS fallback remains available without WebGL.

## Development

```sh
npm install
npm run dev
```

```sh
npm test
npm run lint
npm run build
```

The tests cover music theory and position generation, session state transitions and persistence validation, scores, sample integrity and selection, transport scheduling, interrupted loading, and recovery from sample errors. Browser checks should also cover real Web Audio playback, reload/resume, each session block, mobile layout, and key/theme changes.

Build the macOS application locally:

```sh
npm run app:build
```

The app is written to `release/` using the committed icon. `npm run app:install` additionally copies it to `/Applications/`. To regenerate a changed icon separately, run `npm run icon` (Python 3 and Pillow required).

## GitHub builds

The **Build Vibrato** workflow runs lint, tests, the web build, and the Apple Silicon Mac package on pull requests and pushes to `main`, `vibrato-next`, or `codex/*` branches. Each successful run provides `Vibrato-macOS-AppleSilicon` and `Vibrato-web` artifacts for 30 days.

Download the Mac artifact from the run's **Artifacts** section, unzip it, then unzip the enclosed `Vibrato-macOS-AppleSilicon.zip` to get `vibrato~.app`. The inner archive preserves executable permissions and app-bundle symlinks. These development builds are unsigned and not notarized; the workflow has no signing credentials.

## Code map

- `src/components/PracticeSession.tsx` — practice interface and browser lifecycle.
- `src/lib/practice/` — session state machine, validation, history, and scoring.
- `src/lib/audio/` — bundled instruments, sampler, musical patterns, and pitch helpers.
- `src/components/AmbientBackground.tsx` — lava field and motion lifecycle.
- `src/lib/keyPalette.ts` — key-based color treatment.
- `src/lib/music/` — theory, fretboard geometry, shapes, and voicings.
