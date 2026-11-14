/**
 * The sound lab's audio for the drums: all three kits side by side, a small
 * scheduler that loops a groove through them, and the level measurements that
 * match them.
 *
 * It does not touch the app's engine or Tone's Transport, so the lab can run
 * whatever the rest of the app is doing. Every stroke goes to all three kits
 * at once; the A/B/C switch only moves three gains, so flipping is instant
 * and the groove never restarts. The strokes come from `buildDrumBar`, the
 * same function the jam loop uses, so what is heard here is what the jam plays.
 */
import * as Tone from 'tone';
import { BassVoice } from '../lib/audio/bassVoice';
import { buildDrumBar, drumPhrase, isSwungGroove, type DrumGroove } from '../lib/audio/drumGrooves';
import { BEATS_PER_BAR, buildJamBar, jamBarStep, type JamChord } from '../lib/audio/jamSchedule';
import { chordPitchClasses, leadPadVoicings } from '../lib/audio/padVoicing';
import { PadVoice } from '../lib/audio/padVoice';
import { BLUES_STEPS } from '../lib/audio/synth/bass/bassLine';
import { getBassSettings } from '../lib/audio/synth/bass/bassSettings';
import { ModelledBassVoice } from '../lib/audio/synth/bass/modelledBassVoice';
import { DrumKitVoice } from '../lib/audio/synth/drums/drumKitVoice';
import { DEFAULT_DRUM_PARAMS, DRUM_KIT_IDS, type DrumKitId, type DrumParams, type DrumPiece } from '../lib/audio/synth/drums/drumParams';
import { measureKit, type StereoLevels } from '../lib/audio/synth/drums/drumPattern';
import type { DrumSettings } from '../lib/audio/synth/drums/drumSettings';

/** Match by K-weighted loudness (what LUFS meters measure), or by plain RMS level. */
export type DrumMatchMode = 'loudness' | 'rms';

/** The decibels to add to a kit so it is as loud as the reference. */
export function drumMatchTrim(reference: StereoLevels, kit: StereoLevels, mode: DrumMatchMode): number {
  const difference = mode === 'rms' ? reference.rmsDb - kit.rmsDb : reference.loudness - kit.loudness;
  return Number.isFinite(difference) ? difference : 0;
}

/**
 * What every kit is matched to: the acoustic kit with its default controls,
 * on the reference part. It is a fixed mark, so turning a kit's dials changes
 * that kit's trim and nobody else's, and 0 dB on the Drums fader keeps its
 * meaning (see "Levels" in docs/specs/S2-drums.md).
 */
const referenceLevels = new Map<number, StereoLevels>();
export function drumReferenceLevels(sampleRate: number): StereoLevels {
  let levels = referenceLevels.get(sampleRate);
  if (!levels) {
    levels = measureKit('acoustic', DEFAULT_DRUM_PARAMS.acoustic, sampleRate);
    referenceLevels.set(sampleRate, levels);
  }
  return levels;
}

/** The trim never lifts a kit's peaks past this, in dBFS: beyond it the limiter would squash them and spoil the comparison. */
export const DRUM_TRIM_PEAK_CEILING_DB = -1;

/** A kit's trim against the reference, to a tenth of a decibel, held under the peak ceiling. */
export function drumKitTrim(kit: StereoLevels, sampleRate: number, mode: DrumMatchMode): { trimDb: number; shortBy: number } {
  const wanted = drumMatchTrim(drumReferenceLevels(sampleRate), kit, mode);
  const ceiling = Math.floor((DRUM_TRIM_PEAK_CEILING_DB - kit.peakDb) * 10) / 10;
  const trimDb = Math.min(Math.round(wanted * 10) / 10, ceiling);
  return { trimDb, shortBy: Math.max(0, wanted - trimDb) };
}

const DOMINANT_SEVENTH = [0, 4, 7, 10];
/** The band plays a 12-bar blues in A under the drums; without it the drums loop four bars. */
const BAND_KEY_PC = 9;
const SOLO_BARS = 4;
const SWITCH_SECONDS = 0.015;
const LOOK_AHEAD_SECONDS = 0.3;

interface Playing {
  groove: DrumGroove;
  band: boolean;
  beatSeconds: number;
  /** The audio-clock time of the first bar. */
  start: number;
  /** The next bar to hand to the voices. */
  bar: number;
}

export class DrumLabAudio {
  private readonly limiter: Tone.Limiter;
  private readonly master: Tone.Gain;
  private readonly gains: Record<DrumKitId, Tone.Gain>;
  private readonly kits: Record<DrumKitId, DrumKitVoice>;
  private bass: ModelledBassVoice | BassVoice | null = null;
  private bassLoading: Promise<void> | null = null;
  private pad: PadVoice | null = null;
  private timer: number | null = null;
  private playing: Playing | null = null;
  private humanize: number;
  private disposed = false;
  private readonly chords: JamChord[];
  private readonly padVoicings: number[][];

  private constructor(
    nodes: { limiter: Tone.Limiter; master: Tone.Gain; gains: Record<DrumKitId, Tone.Gain> },
    kits: Record<DrumKitId, DrumKitVoice>,
    settings: DrumSettings,
  ) {
    this.limiter = nodes.limiter;
    this.master = nodes.master;
    this.gains = nodes.gains;
    this.kits = kits;
    this.humanize = settings.humanize;
    this.chords = BLUES_STEPS.map((step) => {
      const rootPc = (BAND_KEY_PC + step) % 12;
      return { rootPc, quality: 'dom7', fifthPc: (rootPc + 7) % 12 };
    });
    this.padVoicings = leadPadVoicings(this.chords.map((chord) => chordPitchClasses(chord.rootPc, DOMINANT_SEVENTH)));
    this.setKit(settings.kit);
  }

  /** Build the lab's audio. Call from a click: the browser will not start sound without one. */
  static async create(settings: DrumSettings): Promise<DrumLabAudio> {
    await Tone.start();
    // The same safety net and master level as the app's engine at its default volume.
    const limiter = new Tone.Limiter(-2).toDestination();
    const master = new Tone.Gain(0.75).connect(limiter);
    const gains = {} as Record<DrumKitId, Tone.Gain>;
    for (const kit of DRUM_KIT_IDS) gains[kit] = new Tone.Gain(0).connect(master);
    try {
      const kits = {} as Record<DrumKitId, DrumKitVoice>;
      for (const kit of DRUM_KIT_IDS) {
        kits[kit] = await DrumKitVoice.create(gains[kit], { kit, params: settings.params[kit], trimDb: settings.trimDb[kit] });
      }
      return new DrumLabAudio({ limiter, master, gains }, kits, settings);
    } catch (error) {
      for (const node of [...Object.values(gains), master, limiter]) node.dispose();
      throw error;
    }
  }

  /** Loop a groove from the top: four bars with a fill and a crash, or a 12-bar blues with the band. */
  play(groove: DrumGroove, bpm: number, band: boolean): void {
    this.stop();
    this.playing = { groove, band, beatSeconds: 60 / bpm, start: Tone.immediate() + 0.12, bar: 0 };
    if (band) void this.loadBass();
    this.schedule();
    this.timer = window.setInterval(this.schedule, 50);
  }

  /** One stroke, now, on every kit: the switch decides which is heard. */
  hit(piece: DrumPiece, velocity: number, seconds = 0): void {
    const time = Tone.immediate() + 0.03;
    for (const kit of DRUM_KIT_IDS) this.kits[kit].hit(piece, time, velocity, seconds);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.playing = null;
    for (const kit of DRUM_KIT_IDS) this.kits[kit].stop();
    this.bass?.stop();
    this.pad?.stop();
  }

  /** Hear this kit. All three keep playing; only the gains move. */
  setKit(kit: DrumKitId): void {
    for (const id of DRUM_KIT_IDS) this.gains[id].gain.rampTo(id === kit ? 1 : 0, SWITCH_SECONDS);
  }

  setParams(kit: DrumKitId, params: DrumParams): void {
    this.kits[kit].setParams(params);
  }

  setTrim(kit: DrumKitId, db: number): void {
    this.kits[kit].setTrim(db);
  }

  /** How much the timing and dynamics wander, from the next bar on. */
  setHumanize(amount: number): void {
    this.humanize = amount;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    for (const kit of DRUM_KIT_IDS) this.kits[kit].dispose();
    this.bass?.dispose();
    this.pad?.dispose();
    for (const node of [...Object.values(this.gains), this.master, this.limiter]) node.dispose();
  }

  /** The band's bass: the one the jam loop is set to play, at its own level. */
  private loadBass(): Promise<void> {
    this.bassLoading ??= (async () => {
      const settings = getBassSettings();
      let bass: ModelledBassVoice | BassVoice;
      try {
        if (settings.jamBass !== 'modelled') throw new Error('the synth bass is chosen');
        bass = await ModelledBassVoice.create(this.master, { params: settings.params, trimDb: settings.trimDb });
      } catch {
        bass = new BassVoice(this.master);
      }
      if (this.disposed) bass.dispose();
      else this.bass = bass;
    })();
    return this.bassLoading;
  }

  /** Hand the voices every bar that starts in the next stretch of the audio clock. */
  private schedule = (): void => {
    const playing = this.playing;
    if (!playing) return;
    const horizon = Tone.immediate() + LOOK_AHEAD_SECONDS;
    const { groove, band, beatSeconds } = playing;
    const steps = band ? this.chords.length : SOLO_BARS;
    for (;;) {
      const barStart = playing.start + playing.bar * BEATS_PER_BAR * beatSeconds;
      // a bar is sent whole, a little before it starts: early enough for a stroke placed just ahead of the beat
      if (barStart - 0.05 > horizon) return;
      const bar = playing.bar++;
      const position = { stepIndex: bar % steps, pass: Math.floor(bar / steps) };
      const request = { groove, bar, ...position, steps, ...drumPhrase(position, steps), humanize: this.humanize };
      const sticks = buildDrumBar(request);
      const brushes = buildDrumBar({ ...request, brushes: true });
      for (const kit of DRUM_KIT_IDS) {
        for (const hit of kit === 'brushes' ? brushes : sticks) {
          const time = barStart + hit.beat * beatSeconds + hit.offsetMs / 1000;
          this.kits[kit].hit(hit.piece, time, hit.velocity, (hit.beats ?? 0) * beatSeconds);
        }
      }
      if (!band) continue;
      const feel = isSwungGroove(groove) ? 'swing' : 'straight';
      const events = buildJamBar(jamBarStep(this.chords, position.stepIndex, this.padVoicings), { guitar: 'off', pad: true, feel, click: false });
      for (const event of events) {
        const time = barStart + event.beat * beatSeconds;
        if (event.kind === 'bass') this.bass?.play(event.midi, time, event.duration * beatSeconds, event.velocity);
        else if (event.kind === 'pad') {
          this.pad ??= new PadVoice(this.master);
          this.pad.play(event.midis, time, event.duration * beatSeconds);
        }
      }
    }
  };
}
