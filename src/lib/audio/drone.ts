import * as Tone from 'tone';
import type { NoteName } from '../../types/music';
import { noteToSemitone } from '../music/notes';
import { PadVoice } from './padVoice';

/**
 * A drone on the root, for Scales: the jam loop's pad voice holding the key
 * note, so every note of a scale is heard against home.
 *
 * It is the root alone, in two octaves. A fifth on top would be the usual
 * tanpura drone, but it would decide the question for scales whose fifth is
 * not perfect (Locrian) and colour all the others; the root leaves each
 * scale's own notes to do the talking.
 *
 * The drone has its own gain into the output, beside the engine: it follows
 * the engine's volume and mute (`setLevel`) and outlives `stopAll`, so a scale
 * can be played and stopped over it.
 */

/** The guitar's low E. The drone's root is the first one at or above it. */
const DRONE_FLOOR_MIDI = 40;
/** The pad's own level per note; the jam loop's is the same. */
const DRONE_VOLUME_DB = -20;
/** Under the guitar, at the engine's volume. */
const DRONE_LEVEL = 0.7;
/** The pad holds a chord for a set time; a drone is one very long chord. */
const DRONE_HOLD_SECONDS = 12 * 60 * 60;
/** A voice that has been stopped is thrown away once its tail has gone. */
const DRONE_TAIL_MS = 1500;

/** The drone's notes for a root: E2 to D♯3, and the octave above. */
export function droneMidis(root: NoteName): number[] {
  const low = DRONE_FLOOR_MIDI + ((noteToSemitone(root) - (DRONE_FLOOR_MIDI % 12) + 12) % 12);
  return [low, low + 12];
}

/** The part of `PadVoice` the drone uses. */
type DroneVoice = Pick<PadVoice, 'play' | 'stop' | 'dispose'>;

interface DroneAudio {
  start: () => Promise<unknown>;
  now: () => number;
  /** A gain into the output, and a pad voice playing into it. */
  build: (level: number) => { setLevel: (level: number) => void; voice: () => DroneVoice; dispose: () => void };
}

const toneAudio: DroneAudio = {
  start: () => Tone.start(),
  now: () => Tone.now(),
  build: (level) => {
    const out = new Tone.Gain(level).toDestination();
    return {
      setLevel: (next) => { out.gain.rampTo(next, 0.05); },
      voice: () => new PadVoice(out, { volumeDb: DRONE_VOLUME_DB }),
      dispose: () => out.dispose(),
    };
  },
};

export class RootDrone {
  private out: ReturnType<DroneAudio['build']> | null = null;
  private voice: DroneVoice | null = null;
  private level = 0;
  private turn = 0;
  private root: NoteName | null = null;
  private readonly audio: DroneAudio;

  constructor(audio: DroneAudio = toneAudio) {
    this.audio = audio;
  }

  /** The root sounding now, or null. */
  get sounding(): NoteName | null { return this.root; }

  /** The engine's volume (0 to 1), or 0 while it is muted. */
  setLevel(volume: number) {
    this.level = Math.max(0, Math.min(1, volume)) * DRONE_LEVEL;
    this.out?.setLevel(this.level);
  }

  /** Hold `root`. A drone already sounding hands over to the new root. */
  async start(root: NoteName) {
    const turn = ++this.turn;
    await this.audio.start();
    if (turn !== this.turn) return; // stopped, or asked for another root, meanwhile
    this.out ??= this.audio.build(this.level);
    this.release();
    // A fresh voice each time: the old one fades on its own gain, so nothing clicks.
    this.voice = this.out.voice();
    this.voice.play(droneMidis(root), this.audio.now() + 0.03, DRONE_HOLD_SECONDS);
    this.root = root;
  }

  stop() {
    this.turn += 1;
    this.release();
    this.root = null;
  }

  private release() {
    const old = this.voice;
    if (!old) return;
    this.voice = null;
    old.stop();
    setTimeout(() => old.dispose(), DRONE_TAIL_MS);
  }

  dispose() {
    this.stop();
    const out = this.out;
    this.out = null;
    if (out) setTimeout(() => out.dispose(), DRONE_TAIL_MS);
  }
}
