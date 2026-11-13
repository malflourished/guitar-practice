import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/instruments';

/** What Settings remembers about the sound, under `vibrato:sound-*`. */
export interface SoundSettings {
  instrument: GuitarInstrumentName;
  volume: number;
  muted: boolean;
  room: number;
}

export const ROOM_MAX = 0.5;

const KEYS = {
  instrument: 'sound-instrument',
  volume: 'sound-volume',
  muted: 'sound-muted',
  room: 'sound-room',
} as const;

interface ReadableStorage {
  getItem(key: string): string | null;
}
interface WritableStorage extends ReadableStorage {
  setItem(key: string, value: string): void;
}

function readJson(storage: ReadableStorage, key: string): unknown {
  try {
    const raw = storage.getItem(`vibrato:${key}`);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const inRange = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

/** Only the values that are saved and still valid; the engine's defaults cover the rest. */
export function readSoundSettings(storage: ReadableStorage): Partial<SoundSettings> {
  const found: Partial<SoundSettings> = {};
  const instrument = readJson(storage, KEYS.instrument);
  if (GUITAR_INSTRUMENTS.some(({ name }) => name === instrument)) {
    found.instrument = instrument as GuitarInstrumentName;
  }
  const volume = readJson(storage, KEYS.volume);
  if (inRange(volume, 1)) found.volume = volume;
  const muted = readJson(storage, KEYS.muted);
  if (typeof muted === 'boolean') found.muted = muted;
  const room = readJson(storage, KEYS.room);
  if (inRange(room, ROOM_MAX)) found.room = room;
  return found;
}

export function writeSoundSettings(
  storage: WritableStorage,
  settings: SoundSettings,
): void {
  try {
    for (const [field, key] of Object.entries(KEYS)) {
      storage.setItem(
        `vibrato:${key}`,
        JSON.stringify(settings[field as keyof SoundSettings]),
      );
    }
  } catch {
    // ignore storage write failures
  }
}
