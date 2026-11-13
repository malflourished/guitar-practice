/**
 * The sound lab's own audio: both basses side by side, a small scheduler that
 * loops a line through them, and the level measurements that match them.
 *
 * It does not touch the app's engine or Tone's Transport, so the lab can run
 * whatever the rest of the app is doing. Each note goes to both basses at
 * once; the A/B switch only moves two gains, so flipping is instant and the
 * line never restarts.
 */
import * as Tone from 'tone';
import { BassVoice } from '../lib/audio/bassVoice';
import { chordPitchClasses, leadPadVoicings } from '../lib/audio/padVoicing';
import { PadVoice } from '../lib/audio/padVoice';
import {
  BLUES_STEPS,
  REFERENCE_BPM,
  REFERENCE_LINE,
  RIFF_LINE,
  bluesBassLine,
  renderBassLine,
  type BassLine,
} from '../lib/audio/synth/bass/bassLine';
import type { BassParams } from '../lib/audio/synth/bass/bassParams';
import { ModelledBassVoice } from '../lib/audio/synth/bass/modelledBassVoice';
import { kWeightedLoudness, peak, rms, toDb } from '../lib/audio/synth/dsp/loudness';

/** A is the synth bass (`BassVoice`), B the modelled bass. */
export type LabVoice = 'a' | 'b';
export type LabLineName = 'riff' | 'blues';
/** Match by plain RMS level, or by K-weighted loudness (what LUFS meters measure). */
export type MatchMode = 'rms' | 'loudness';

export interface Levels {
  peakDb: number;
  rmsDb: number;
  /** K-weighted loudness, in LKFS. */
  loudness: number;
}

export function levelsOf(samples: Float32Array, sampleRate: number): Levels {
  return { peakDb: toDb(peak(samples)), rmsDb: toDb(rms(samples)), loudness: kWeightedLoudness(samples, sampleRate) };
}

/** The decibels to add to B so it matches A. */
export function matchTrim(a: Levels, b: Levels, mode: MatchMode): number {
  const difference = mode === 'rms' ? a.rmsDb - b.rmsDb : a.loudness - b.loudness;
  return Number.isFinite(difference) ? difference : 0;
}

const synthBassLevels = new Map<number, Promise<Levels>>();

/**
 * The synth bass's levels on the reference line, rendered off-line through
 * Tone exactly as the jam plays it. Measured once per sample rate.
 *
 * `BassVoice` builds its nodes on Tone's current context, so the off-line
 * context has to stand in as the current one while the voice is built. The
 * swap is done by hand, and undone before anything else can run. Tone's own
 * `Offline` helper waits in the middle of its swap, and two calls that overlap
 * there leave the whole app on a finished off-line context.
 */
export function measureSynthBass(sampleRate: number): Promise<Levels> {
  let measuring = synthBassLevels.get(sampleRate);
  if (!measuring) {
    const beat = 60 / REFERENCE_BPM;
    const live = Tone.getContext();
    const offline = new Tone.OfflineContext(1, REFERENCE_LINE.beats * beat, sampleRate);
    Tone.setContext(offline);
    try {
      const voice = new BassVoice(Tone.getDestination());
      for (const note of REFERENCE_LINE.notes) voice.play(note.midi, note.beat * beat, note.beats * beat, note.velocity);
    } finally {
      Tone.setContext(live);
    }
    measuring = offline.render().then((buffer) => levelsOf(buffer.getChannelData(0), sampleRate));
    measuring.catch(() => synthBassLevels.delete(sampleRate));
    synthBassLevels.set(sampleRate, measuring);
  }
  return measuring;
}

/** The modelled bass's levels on the same line, before any trim. */
export function measureModelledBass(params: BassParams, sampleRate: number): Levels {
  return levelsOf(renderBassLine(REFERENCE_LINE, { bpm: REFERENCE_BPM, sampleRate, params }), sampleRate);
}

interface LabEvent {
  beat: number;
  beats: number;
  /** A bass note, or the notes of a pad chord. */
  midi?: number;
  midis?: number[];
  velocity: number;
}

const DOMINANT_SEVENTH = [0, 4, 7, 10];

function labEvents(line: LabLineName, keyPc: number, withPad: boolean): { beats: number; events: LabEvent[] } {
  const bass: BassLine = line === 'riff' ? RIFF_LINE : bluesBassLine(keyPc);
  const events: LabEvent[] = bass.notes.map((note) => ({ ...note }));
  if (line === 'blues' && withPad) {
    const voicings = leadPadVoicings(BLUES_STEPS.map((step) => chordPitchClasses((keyPc + step) % 12, DOMINANT_SEVENTH)));
    voicings.forEach((midis, bar) => {
      if (midis.length > 0) events.push({ beat: bar * 4, beats: 4, midis, velocity: 0.8 });
    });
  }
  events.sort((a, b) => a.beat - b.beat);
  return { beats: bass.beats, events };
}

const SWITCH_SECONDS = 0.015;
const LOOK_AHEAD_SECONDS = 0.3;

export class SoundLabAudio {
  private readonly limiter: Tone.Limiter;
  private readonly master: Tone.Gain;
  private readonly gainA: Tone.Gain;
  private readonly gainB: Tone.Gain;
  private readonly synthBass: BassVoice;
  private readonly modelled: ModelledBassVoice;
  private pad: PadVoice | null = null;
  private timer: number | null = null;
  private events: LabEvent[] = [];
  private loopBeats = 0;
  private index = 0;
  private loopStart = 0;
  private beatSeconds = 0.5;

  private constructor(modelled: ModelledBassVoice, nodes: { limiter: Tone.Limiter; master: Tone.Gain; gainA: Tone.Gain; gainB: Tone.Gain }, voice: LabVoice) {
    this.limiter = nodes.limiter;
    this.master = nodes.master;
    this.gainA = nodes.gainA;
    this.gainB = nodes.gainB;
    this.modelled = modelled;
    this.synthBass = new BassVoice(this.gainA);
    this.setVoice(voice);
  }

  /** Build the lab's audio. Call from a click: the browser will not start sound without one. */
  static async create(options: { params: BassParams; trimDb: number; voice: LabVoice }): Promise<SoundLabAudio> {
    await Tone.start();
    // The same safety net and master level as the app's engine at its default volume.
    const limiter = new Tone.Limiter(-2).toDestination();
    const master = new Tone.Gain(0.75).connect(limiter);
    const gainA = new Tone.Gain(0).connect(master);
    const gainB = new Tone.Gain(0).connect(master);
    try {
      const modelled = await ModelledBassVoice.create(gainB, { params: options.params, trimDb: options.trimDb });
      return new SoundLabAudio(modelled, { limiter, master, gainA, gainB }, options.voice);
    } catch (error) {
      for (const node of [gainA, gainB, master, limiter]) node.dispose();
      throw error;
    }
  }

  /** Loop a line from the top. */
  play(line: LabLineName, bpm: number, keyPc: number, withPad: boolean): void {
    this.stop();
    const built = labEvents(line, keyPc, withPad);
    this.events = built.events;
    this.loopBeats = built.beats;
    this.beatSeconds = 60 / bpm;
    this.index = 0;
    this.loopStart = Tone.immediate() + 0.12;
    this.schedule();
    this.timer = window.setInterval(this.schedule, 50);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.events = [];
    this.synthBass.stop();
    this.modelled.stop();
    this.pad?.stop();
  }

  /** Hear A or B. Both keep playing; only the gains move. */
  setVoice(voice: LabVoice): void {
    this.gainA.gain.rampTo(voice === 'a' ? 1 : 0, SWITCH_SECONDS);
    this.gainB.gain.rampTo(voice === 'b' ? 1 : 0, SWITCH_SECONDS);
  }

  setParams(params: BassParams): void {
    this.modelled.setParams(params);
  }

  setTrim(db: number): void {
    this.modelled.setTrim(db);
  }

  dispose(): void {
    this.stop();
    this.synthBass.dispose();
    this.modelled.dispose();
    this.pad?.dispose();
    for (const node of [this.gainA, this.gainB, this.master, this.limiter]) node.dispose();
  }

  /** Hand the voices every note due in the next stretch of the audio clock. */
  private schedule = (): void => {
    if (this.events.length === 0) return;
    const horizon = Tone.immediate() + LOOK_AHEAD_SECONDS;
    for (;;) {
      const event = this.events[this.index];
      const time = this.loopStart + event.beat * this.beatSeconds;
      if (time > horizon) return;
      const seconds = event.beats * this.beatSeconds;
      if (event.midi !== undefined) {
        this.synthBass.play(event.midi, time, seconds, event.velocity);
        this.modelled.play(event.midi, time, seconds, event.velocity);
      } else if (event.midis) {
        this.pad ??= new PadVoice(this.master);
        this.pad.play(event.midis, time, seconds);
      }
      this.index += 1;
      if (this.index >= this.events.length) {
        this.index = 0;
        this.loopStart += this.loopBeats * this.beatSeconds;
      }
    }
  };
}
