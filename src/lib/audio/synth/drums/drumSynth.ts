/**
 * A drum kit as one instrument: the kit's voices, a small room, and a bus
 * that holds the drums' peaks down, with strokes placed to the sample.
 *
 * Pure TypeScript with no audio API in it, so it renders the same in a Node
 * test, in the sound lab's loudness measurement and inside the AudioWorklet
 * (`drumProcessor.ts`). Frames are absolute sample counts on the caller's
 * clock: schedule strokes with `hit(frame, ...)`, then call `render` for
 * consecutive stretches of that clock.
 *
 * The signal path:
 *
 *   drums (kick, snare, toms, rim, brush) ─► soft clipper ─┐
 *   metal (hi-hats, ride, crash) ──────────────────────────┼─► 30 Hz high-pass ─► ceiling ─► out
 *   every voice's send ─► room ────────────────────────────┘
 *
 * The clipper is why the drums fit in the jam's mix: it trims the first
 * millisecond of a kick or a snare, which costs little punch and several
 * decibels of peak. Metal goes round it, so cymbals stay clean. The ceiling
 * at the end does nothing to a groove; it is there so that no pile-up of
 * strokes, at any setting, can leave the kit above -2 dBFS.
 */
import { Biquad } from '../dsp/biquad';
import { Random } from '../dsp/random';
import { SmallRoom } from '../dsp/room';
import {
  DEFAULT_DRUM_PARAMS,
  isDrumKitId,
  isDrumPiece,
  sanitizeDrumParams,
  type DrumKitId,
  type DrumParams,
  type DrumPiece,
} from './drumParams';
import { createKit, type DrumKit } from './kits';
import { softClip } from './machine';

/**
 * Housekeeping (putting quiet voices and the output filters to sleep) happens
 * only where the clock crosses a multiple of this many frames, so the sound
 * does not depend on how the caller slices its blocks. It is also the longest
 * stretch a voice is asked to render at once.
 */
const GRID = 128;
/** `stop`, and a change of kit, fade the sound out over this long, in seconds. */
const STOP_SECONDS = 0.03;
/** Nothing below this is of use from a drum kit, and small speakers only suffer from it. */
const HIGHPASS_HZ = 30;
/**
 * The ceiling: the output is untouched up to the knee (-6 dBFS) and bends
 * smoothly above it, never passing the knee plus this much (-2 dBFS).
 */
const CEILING_KNEE = 0.5;
const CEILING_ROOM = 0.294;
/** A stroke softer than this is not played. */
const MIN_VELOCITY = 1e-3;
/** With nothing sounding, the output filters are switched off after this long below the quiet level. */
const TAIL_SECONDS = 0.05;
const QUIET_LEVEL = 1e-7;
/**
 * A brush lands over several milliseconds, not at once: a tap on the brushes
 * kit is four light strokes, this far apart in seconds, at these shares of
 * its strength. The first is not the strongest, so the tap swells.
 */
const BRUSH_SPREAD_SECONDS = [0, 0.0016, 0.0036, 0.0062];
const BRUSH_SPREAD_SHARES = [0.34, 0.46, 0.52, 0.38];

/**
 * Each kit's output gain: set so that, with its default controls, every kit
 * measures the same K-weighted loudness on the reference groove, and so that
 * the kit's loudest strokes leave room in the jam's mix. Measured on
 * 2026-11-13; see "Levels" in docs/specs/S2-drums.md.
 */
export const KIT_OUTPUT_GAIN: Readonly<Record<DrumKitId, number>> = {
  acoustic: 0.5,
  machine: 0.456,
  brushes: 0.456,
};

interface SynthEvent {
  frame: number;
  order: number;
  piece: DrumPiece;
  velocity: number;
  seconds: number;
}

export class DrumSynth {
  readonly sampleRate: number;
  private kitId: DrumKitId;
  private params: DrumParams;
  private kit: DrumKit;
  private readonly random: Random;
  private readonly room: SmallRoom;
  private readonly events: SynthEvent[] = [];
  private readonly scratch = new Float64Array(GRID);
  private readonly drumLeft = new Float64Array(GRID);
  private readonly drumRight = new Float64Array(GRID);
  private readonly metalLeft = new Float64Array(GRID);
  private readonly metalRight = new Float64Array(GRID);
  private readonly send = new Float64Array(GRID);
  private readonly highpassLeft = new Biquad();
  private readonly highpassRight = new Biquad();
  private preGain = 1;
  private postGain = 1;
  private roomLevel = 0;
  private outputGain = 1;
  private chainAwake = false;
  private quietSamples = 0;
  private cellPeak = 0;
  private nextOrder = 0;
  /** Frames left of a fade to silence, after `stop` or before a change of kit. */
  private fadeLeft = 0;
  private fadeTotal = 1;
  private stopRequested = false;
  private pendingKit: DrumKitId | null = null;

  constructor(sampleRate: number, kit: DrumKitId = 'acoustic', params: Partial<DrumParams> = {}, seed = 1) {
    this.sampleRate = sampleRate;
    this.kitId = isDrumKitId(kit) ? kit : 'acoustic';
    this.params = sanitizeDrumParams(params, DEFAULT_DRUM_PARAMS[this.kitId]);
    this.random = new Random(seed);
    this.kit = createKit(this.kitId, sampleRate, this.params, this.random);
    this.room = new SmallRoom(sampleRate, this.kit.roomSeconds);
    this.highpassLeft.setHighpass(HIGHPASS_HZ, 0.707, sampleRate);
    this.highpassRight.setHighpass(HIGHPASS_HZ, 0.707, sampleRate);
    this.applyBus();
  }

  getKit(): DrumKitId {
    return this.kitId;
  }

  getParams(): DrumParams {
    return { ...this.params };
  }

  /** Change some controls. They apply from the next stroke; Room and Drive at once. */
  setParams(change: Partial<DrumParams>): void {
    this.params = sanitizeDrumParams(change, this.params);
    this.kit.configure(this.params);
    this.applyBus();
  }

  /**
   * Change kit, with that kit's controls (its defaults where `params` leaves
   * one out). What is sounding fades out first, over a few hundredths of a
   * second; strokes already scheduled play on the new kit.
   */
  setKit(kit: DrumKitId, params: Partial<DrumParams> = {}): void {
    if (!isDrumKitId(kit)) return;
    const next = sanitizeDrumParams(params, DEFAULT_DRUM_PARAMS[kit]);
    if (kit === this.kitId && !this.pendingKit) {
      this.setParams(next);
      return;
    }
    this.params = next;
    this.pendingKit = kit;
    if (this.kit.busy || this.room.active) this.startFade();
    else this.swapKit();
  }

  /**
   * Play `piece` at `frame`. `durationFrames` is how long a brush sweep
   * lasts; other pieces ring as long as they ring. Returns false if nothing
   * was scheduled (not a piece, not a number, or too soft to hear).
   */
  hit(frame: number, piece: DrumPiece, velocity = 0.8, durationFrames = 0): boolean {
    if (!isDrumPiece(piece) || !Number.isFinite(frame) || !Number.isFinite(velocity)) return false;
    if (velocity < MIN_VELOCITY) return false;
    const at = Math.round(frame);
    const strength = Math.min(1, velocity);
    const seconds = Number.isFinite(durationFrames) && durationFrames > 0 ? durationFrames / this.sampleRate : 0;
    const brushes = (this.pendingKit ?? this.kitId) === 'brushes';
    if (brushes && (piece === 'brushTap' || piece === 'snare')) {
      BRUSH_SPREAD_SECONDS.forEach((delay, i) => {
        this.schedule(at + Math.round(delay * this.sampleRate), piece, strength * BRUSH_SPREAD_SHARES[i], seconds);
      });
    } else {
      this.schedule(at, piece, strength, seconds);
    }
    return true;
  }

  /** Silence everything, quickly and without a click, and forget what was scheduled. */
  stop(): void {
    this.events.length = 0;
    this.stopRequested = true;
  }

  /** True when nothing is sounding or scheduled and the output is exactly zero. */
  get silent(): boolean {
    return this.events.length === 0 && !this.chainAwake && !this.kit.busy && !this.room.active && this.fadeLeft === 0;
  }

  /** How many of the kit's voices are sounding. */
  get activeVoices(): number {
    let count = 0;
    for (const { voice } of this.kit.strips) if (voice.active) count++;
    return count;
  }

  /**
   * Render `left[from..to)` and `right[from..to)`. `startFrame` is the clock
   * position of index `from`; successive calls must follow on from each other.
   */
  render(left: Float32Array, right: Float32Array, startFrame: number, from = 0, to = left.length): void {
    const events = this.events;
    let position = from;
    let frame = Math.round(startFrame);
    if (this.stopRequested) {
      this.stopRequested = false;
      if (this.kit.busy || this.room.active || this.chainAwake) this.startFade();
    }
    while (position < to) {
      while (events.length > 0 && events[0].frame <= frame) {
        const event = events.shift()!;
        this.kit.hit(event.piece, event.velocity, event.seconds);
        this.chainAwake = true;
        this.quietSamples = 0;
      }
      const untilEvent = events.length > 0 ? events[0].frame - frame : Infinity;
      const untilGrid = GRID - (((frame % GRID) + GRID) % GRID);
      const untilFade = this.fadeLeft > 0 ? this.fadeLeft : Infinity;
      const count = Math.min(to - position, untilEvent, untilGrid, untilFade);
      this.renderChunk(left, right, position, count);
      position += count;
      frame += count;
      if (untilFade === count) this.finishFade();
      if (count === untilGrid) this.housekeeping();
    }
  }

  /** Every number the instrument remembers, for checks that none is invalid or denormal. */
  forEachState(visit: (value: number) => void): void {
    this.kit.forEachState(visit);
    this.room.forEachState(visit);
    this.highpassLeft.state().forEach(visit);
    this.highpassRight.state().forEach(visit);
    for (const buffer of [this.scratch, this.drumLeft, this.drumRight, this.metalLeft, this.metalRight, this.send]) {
      buffer.forEach(visit);
    }
  }

  private schedule(frame: number, piece: DrumPiece, velocity: number, seconds: number): void {
    const events = this.events;
    const entry: SynthEvent = { frame, order: this.nextOrder++, piece, velocity, seconds };
    let index = events.length;
    while (index > 0 && events[index - 1].frame > entry.frame) index--;
    events.splice(index, 0, entry);
  }

  private applyBus(): void {
    // Drive pushes the drums further into the soft clipper; the gain after it keeps quiet strokes at the same level.
    this.preGain = 0.45 + 1.6 * this.params.drive;
    this.postGain = 1 / this.preGain;
    this.roomLevel = this.params.room * this.kit.roomLevel;
    this.outputGain = KIT_OUTPUT_GAIN[this.kitId];
  }

  private startFade(): void {
    if (this.fadeLeft > 0) return;
    this.fadeTotal = Math.max(1, Math.round(STOP_SECONDS * this.sampleRate));
    this.fadeLeft = this.fadeTotal;
  }

  /** The fade has reached silence: put everything to sleep, and bring in the new kit if one is waiting. */
  private finishFade(): void {
    this.kit.sleep();
    this.room.sleep();
    this.highpassLeft.reset();
    this.highpassRight.reset();
    this.clearBuffers();
    this.chainAwake = false;
    this.quietSamples = 0;
    this.cellPeak = 0;
    if (this.pendingKit) this.swapKit();
  }

  private swapKit(): void {
    if (!this.pendingKit) return;
    this.kitId = this.pendingKit;
    this.pendingKit = null;
    this.kit = createKit(this.kitId, this.sampleRate, this.params, this.random);
    this.room.setDecay(this.kit.roomSeconds);
    this.applyBus();
  }

  private renderChunk(left: Float32Array, right: Float32Array, position: number, count: number): void {
    const { kit, room } = this;
    const busy = kit.busy;
    if (!busy && !room.active && !this.chainAwake) {
      left.fill(0, position, position + count);
      right.fill(0, position, position + count);
      if (this.fadeLeft > 0) this.fadeLeft -= count;
      return;
    }
    const { scratch, drumLeft, drumRight, metalLeft, metalRight, send } = this;
    drumLeft.fill(0, 0, count);
    drumRight.fill(0, 0, count);
    metalLeft.fill(0, 0, count);
    metalRight.fill(0, 0, count);
    send.fill(0, 0, count);

    kit.prepare(count);
    for (const strip of kit.strips) {
      if (!strip.voice.active) continue;
      scratch.fill(0, 0, count);
      strip.voice.render(scratch, count);
      const toLeft = strip.metal ? metalLeft : drumLeft;
      const toRight = strip.metal ? metalRight : drumRight;
      const { left: gainLeft, right: gainRight, send: gainSend } = strip;
      for (let i = 0; i < count; i++) {
        const sample = scratch[i];
        toLeft[i] += sample * gainLeft;
        toRight[i] += sample * gainRight;
        send[i] += sample * gainSend;
      }
    }

    // The drum bus: a soft clipper that trims the peaks.
    const { preGain, postGain } = this;
    for (let i = 0; i < count; i++) {
      drumLeft[i] = softClip(drumLeft[i] * preGain) * postGain + metalLeft[i];
      drumRight[i] = softClip(drumRight[i] * preGain) * postGain + metalRight[i];
    }
    kit.extras(drumLeft, drumRight, count);
    if (this.roomLevel > 0 || room.active) room.process(busy ? send : null, drumLeft, drumRight, count, this.roomLevel);

    const { highpassLeft, highpassRight, outputGain, fadeTotal } = this;
    let fadeLeft = this.fadeLeft;
    let loudest = this.cellPeak;
    for (let i = 0; i < count; i++) {
      let l = ceiling(highpassLeft.process(drumLeft[i] * outputGain));
      let r = ceiling(highpassRight.process(drumRight[i] * outputGain));
      if (fadeLeft > 0) {
        const gain = fadeLeft / fadeTotal;
        l *= gain;
        r *= gain;
        fadeLeft--;
      }
      left[position + i] = l;
      right[position + i] = r;
      const magnitude = (l < 0 ? -l : l) + (r < 0 ? -r : r);
      if (magnitude > loudest) loudest = magnitude;
    }
    this.fadeLeft = fadeLeft;
    this.cellPeak = loudest;
  }

  /** Put voices that have died away to sleep, then the room, then the output filters. */
  private housekeeping(): void {
    this.kit.settle();
    const busy = this.kit.busy;
    this.room.settle(busy);
    const quiet = !busy && !this.room.active && this.cellPeak < QUIET_LEVEL;
    this.cellPeak = 0;
    if (!this.chainAwake) return;
    if (!quiet) {
      this.quietSamples = 0;
      return;
    }
    this.quietSamples += GRID;
    if (this.quietSamples >= TAIL_SECONDS * this.sampleRate) {
      this.highpassLeft.reset();
      this.highpassRight.reset();
      this.clearBuffers();
      this.chainAwake = false;
      this.quietSamples = 0;
    }
  }

  private clearBuffers(): void {
    this.scratch.fill(0);
    this.drumLeft.fill(0);
    this.drumRight.fill(0);
    this.metalLeft.fill(0);
    this.metalRight.fill(0);
    this.send.fill(0);
  }
}

/** Straight through below the knee; above it, a smooth bend that never passes the ceiling. */
function ceiling(sample: number): number {
  const magnitude = sample < 0 ? -sample : sample;
  if (magnitude <= CEILING_KNEE) return sample;
  const bent = CEILING_KNEE + CEILING_ROOM * Math.tanh((magnitude - CEILING_KNEE) / CEILING_ROOM);
  return sample < 0 ? -bent : bent;
}
