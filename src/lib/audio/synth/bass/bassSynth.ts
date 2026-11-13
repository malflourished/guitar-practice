/**
 * The modelled electric bass as one instrument: four string voices, the
 * pickup's low-pass, a light amplifier and a cabinet, with notes placed to
 * the sample.
 *
 * Pure TypeScript with no audio API in it, so it renders the same in a Node
 * test, in the sound lab's loudness measurement and inside the AudioWorklet
 * (`bassProcessor.ts`). Frames are absolute sample counts on the caller's
 * clock: schedule notes with `noteOn(frame, ...)`, then call `render` for
 * consecutive stretches of that clock.
 *
 * How it plays, as a bassist would:
 * - A note is fretted where `fingerBass` puts it, on one of four strings.
 * - Shortly before a new note on a string that is still ringing, a finger
 *   lands on that string and stops it.
 * - A new note mutes the other strings, which overlap it briefly as they die.
 * - A note's end is a finger damping the string, not a fade.
 */
import { Biquad, Shelf } from '../dsp/biquad';
import { Random } from '../dsp/random';
import {
  BASS_MAX_MIDI,
  BASS_MIN_MIDI,
  fingerBass,
  midiToHz,
  sanitizeBassParams,
  type BassParams,
} from './bassParams';
import { TONE_Q, designNote } from './bassNote';
import { BassStringVoice } from './bassString';

/** Voices: one for the sounding note and spares for the notes dying under it. */
const VOICE_COUNT = 4;
/** How long before a pluck the finger lands on a string that is still ringing, in seconds. */
const PREPARE_SECONDS = 0.025;
/** How fast that finger, or `stop`, silences a string, in seconds. */
const FAST_DAMP_SECONDS = 0.03;
/** The cabinet: little below and little above these, in hertz. */
const CABINET_LOW_HZ = 35;
const CABINET_HIGH_HZ = 4000;
/** The amplifier's bias: what makes its distortion uneven, like a valve's. */
const AMP_BIAS = 0.12;
/**
 * The amplifier lifts everything above these two corners by 12 dB before its
 * soft clipper and lowers it again after. Played softly the two cancel. Driven,
 * the clipper works on the string's upper partials and not only on the
 * fundamental, which is where an amplifier's growl comes from.
 */
const EMPHASIS_LOW_HZ = 250;
const EMPHASIS_HIGH_HZ = 1000;
/** With nothing sounding, the output filters are switched off after this long below the quiet level. */
const TAIL_SECONDS = 0.05;
const QUIET_LEVEL = 1e-7;
/** A pluck softer than this (80 dB under full strength) is not played. */
const MIN_VELOCITY = 1e-4;
/**
 * Housekeeping (putting quiet strings and the output filters to sleep) happens
 * only where the clock crosses a multiple of this many frames, so the sound
 * does not depend on how the caller slices its blocks.
 */
const GRID = 128;

/**
 * Output gain that matches `BassVoice` (the synth bass) at its default level
 * of -4.5 dB: with the default parameters, the reference line has the same
 * RMS in both (-12.9 dBFS before the master volume). Measured in the sound
 * lab on 2026-11-13; see docs/specs/S1-modelled-bass.md.
 */
export const BASS_OUTPUT_GAIN = 1.31;

interface SynthEvent {
  frame: number;
  order: number;
  kind: 'prepare' | 'on' | 'off';
  id: number;
  midi: number;
  velocity: number;
  string: number;
}

export class BassSynth {
  readonly sampleRate: number;
  private params: BassParams;
  private readonly voices: BassStringVoice[] = [];
  private readonly events: SynthEvent[] = [];
  private readonly random: Random;
  private readonly mix = new Float64Array(GRID);
  private readonly pickup = new Biquad();
  private readonly cabinetLow = new Biquad();
  private readonly cabinetHigh = new Biquad();
  private readonly emphasis = new Shelf();
  private readonly deemphasis = new Shelf();
  private preGain = 1;
  private postGain = 1;
  private readonly biasOut = softClip(AMP_BIAS);
  private chainAwake = false;
  private quietSamples = 0;
  private cellPeak = 0;
  private stopRequested = false;
  private nextId = 1;
  private nextOrder = 0;
  private plucks = 0;

  constructor(sampleRate: number, params: Partial<BassParams> = {}, seed = 1) {
    this.sampleRate = sampleRate;
    this.params = sanitizeBassParams(params);
    this.random = new Random(seed);
    const maxPeriod = sampleRate / midiToHz(BASS_MIN_MIDI - 1);
    for (let i = 0; i < VOICE_COUNT; i++) this.voices.push(new BassStringVoice(sampleRate, maxPeriod));
    this.cabinetLow.setHighpass(CABINET_LOW_HZ, 0.7, sampleRate);
    this.cabinetHigh.setLowpass(CABINET_HIGH_HZ, 0.7, sampleRate);
    this.emphasis.set(EMPHASIS_LOW_HZ, EMPHASIS_HIGH_HZ, sampleRate);
    this.deemphasis.set(EMPHASIS_HIGH_HZ, EMPHASIS_LOW_HZ, sampleRate);
    this.applyChainParams();
  }

  getParams(): BassParams {
    return { ...this.params };
  }

  /** Change some controls. Tone and drive apply at once; the rest from the next note. */
  setParams(change: Partial<BassParams>): void {
    this.params = sanitizeBassParams(change, this.params);
    this.applyChainParams();
  }

  /**
   * Pluck `midi` at `frame`. With `durationFrames`, the note is damped that
   * long after. Returns the note's id for `noteOff`, or 0 if nothing was
   * scheduled (an invalid note, or one too soft to hear).
   */
  noteOn(frame: number, midi: number, velocity = 0.8, durationFrames?: number): number {
    if (!Number.isFinite(frame) || !Number.isFinite(midi) || !Number.isFinite(velocity)) return 0;
    if (velocity < MIN_VELOCITY) return 0;
    const note = Math.min(BASS_MAX_MIDI, Math.max(BASS_MIN_MIDI, midi));
    const at = Math.round(frame);
    const id = this.nextId++;
    const { string } = fingerBass(note);
    const prepare = at - Math.round(PREPARE_SECONDS * this.sampleRate);
    this.schedule({ frame: prepare, kind: 'prepare', id, midi: note, velocity: 0, string });
    this.schedule({ frame: at, kind: 'on', id, midi: note, velocity: Math.min(1, Math.max(0, velocity)), string });
    if (durationFrames !== undefined && Number.isFinite(durationFrames)) {
      this.schedule({ frame: at + Math.max(1, Math.round(durationFrames)), kind: 'off', id, midi: note, velocity: 0, string });
    }
    return id;
  }

  /** Damp the note with this id at `frame`. */
  noteOff(frame: number, id: number): void {
    if (!Number.isFinite(frame) || id <= 0) return;
    this.schedule({ frame: Math.round(frame), kind: 'off', id, midi: 0, velocity: 0, string: -1 });
  }

  /** Silence everything from the next sample rendered, and forget what was scheduled. */
  stop(): void {
    this.events.length = 0;
    this.stopRequested = true;
  }

  /** How many strings are sounding. */
  get activeVoices(): number {
    let count = 0;
    for (const voice of this.voices) if (voice.active) count++;
    return count;
  }

  /** True when nothing is sounding or scheduled and the output is exactly zero. */
  get silent(): boolean {
    return this.events.length === 0 && !this.chainAwake && this.activeVoices === 0;
  }

  /**
   * Render `out[from..to)`. `startFrame` is the clock position of `out[from]`;
   * successive calls must follow on from each other.
   */
  render(out: Float32Array, startFrame: number, from = 0, to = out.length): void {
    const events = this.events;
    let position = from;
    let frame = startFrame;
    if (this.stopRequested) {
      this.stopRequested = false;
      for (const voice of this.voices) voice.damp(FAST_DAMP_SECONDS);
    }
    while (position < to) {
      while (events.length > 0 && events[0].frame <= frame) this.run(events.shift()!);
      const untilEvent = events.length > 0 ? events[0].frame - frame : Infinity;
      const untilGrid = GRID - (((frame % GRID) + GRID) % GRID);
      const count = Math.min(to - position, untilEvent, untilGrid);
      this.renderChunk(out, position, count);
      position += count;
      frame += count;
      if (count === untilGrid) this.housekeeping();
    }
  }

  /** Every number the instrument remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void {
    for (const voice of this.voices) voice.forEachState(visit);
    for (const filter of [this.pickup, this.cabinetLow, this.cabinetHigh]) filter.state().forEach(visit);
    visit(this.emphasis.state());
    visit(this.deemphasis.state());
    this.mix.forEach(visit);
  }

  private schedule(event: Omit<SynthEvent, 'order'>): void {
    const events = this.events;
    const entry: SynthEvent = { ...event, order: this.nextOrder++ };
    let index = events.length;
    while (index > 0 && events[index - 1].frame > entry.frame) index--;
    events.splice(index, 0, entry);
  }

  private run(event: SynthEvent): void {
    const params = this.params;
    if (event.kind === 'prepare') {
      // The plucking finger lands on the string it is about to play.
      for (const voice of this.voices) {
        if (voice.active && voice.string === event.string) voice.damp(FAST_DAMP_SECONDS);
      }
      return;
    }
    if (event.kind === 'off') {
      for (const voice of this.voices) {
        if (voice.active && voice.noteId === event.id && !voice.damped) voice.damp(params.releaseSeconds);
      }
      return;
    }
    // A new note. The same string is stopped (if `prepare` came too late to do it), the others are muted.
    for (const voice of this.voices) {
      if (!voice.active) continue;
      if (voice.string === event.string) voice.damp(FAST_DAMP_SECONDS);
      else if (!voice.damped) voice.damp(params.releaseSeconds);
    }
    const voice = this.freeVoice();
    const finger = this.plucks++ % 2; // index and middle fingers alternate
    const design = designNote(event.midi, event.velocity, params, this.sampleRate, {
      position: 0.5 * this.random.bipolar() + (finger === 0 ? -0.5 : 0.5),
      hardness: 0.7 * this.random.bipolar() + (finger === 0 ? -0.3 : 0.3),
      level: this.random.bipolar(),
    });
    voice.start(design, event.id, this.random);
    this.chainAwake = true;
    this.quietSamples = 0;
  }

  /** A sleeping voice, or failing that the quietest one, silenced. */
  private freeVoice(): BassStringVoice {
    let quietest = this.voices[0];
    for (const voice of this.voices) {
      if (!voice.active) return voice;
      if (voice.level < quietest.level) quietest = voice;
    }
    quietest.sleep();
    return quietest;
  }

  private applyChainParams(): void {
    this.pickup.setLowpass(this.params.toneHz, TONE_Q, this.sampleRate);
    // Drive pushes the signal further into the soft clipper; the gain after it keeps quiet notes at the same level.
    this.preGain = 0.3 + 2.2 * this.params.drive ** 1.5;
    this.postGain = BASS_OUTPUT_GAIN / (this.preGain * (1 - AMP_BIAS * AMP_BIAS));
  }

  private renderChunk(out: Float32Array, position: number, count: number): void {
    let sounding = false;
    for (const voice of this.voices) if (voice.active) sounding = true;
    if (!sounding && !this.chainAwake) {
      out.fill(0, position, position + count);
      return;
    }
    const mix = this.mix;
    mix.fill(0, 0, count);
    for (const voice of this.voices) if (voice.active) voice.process(mix, 0, count);

    const { pickup, cabinetLow, cabinetHigh, emphasis, deemphasis, preGain, postGain, biasOut } = this;
    let loudest = this.cellPeak;
    for (let i = 0; i < count; i++) {
      const picked = emphasis.process(pickup.process(mix[i]));
      const driven = (softClip(preGain * picked + AMP_BIAS) - biasOut) * postGain;
      const y = cabinetHigh.process(cabinetLow.process(deemphasis.process(driven)));
      out[position + i] = y;
      const magnitude = y < 0 ? -y : y;
      if (magnitude > loudest) loudest = magnitude;
    }
    this.cellPeak = loudest;
  }

  /** Put strings that have stopped to sleep, and the output filters once they have rung out. */
  private housekeeping(): void {
    let sounding = false;
    for (const voice of this.voices) {
      voice.sleepIfStopped();
      if (voice.active) sounding = true;
    }
    const quiet = !sounding && this.cellPeak < QUIET_LEVEL;
    this.cellPeak = 0;
    if (!this.chainAwake) return;
    if (!quiet) {
      this.quietSamples = 0;
      return;
    }
    this.quietSamples += GRID;
    if (this.quietSamples >= TAIL_SECONDS * this.sampleRate) {
      this.pickup.reset();
      this.cabinetLow.reset();
      this.cabinetHigh.reset();
      this.emphasis.reset();
      this.deemphasis.reset();
      this.mix.fill(0);
      this.chainAwake = false;
      this.quietSamples = 0;
    }
  }
}

/** A soft clipper: straight for small signals, flattening smoothly to ±2/3 at ±1 and beyond. */
function softClip(x: number): number {
  if (x >= 1) return 2 / 3;
  if (x <= -1) return -2 / 3;
  return x - (x * x * x) / 3;
}
