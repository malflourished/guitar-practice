import { useCallback, useEffect, useRef, useState } from 'react';
import type { FretPosition } from '../types/music';
import { positionToMidi } from '../lib/audio/pitch';
import {
  GuitarAudioEngine,
  type EngineState,
  type GuitarInstrumentName,
} from '../lib/audio/engine';

export interface UseInstrument {
  ready: boolean;
  loading: boolean;
  instrument: GuitarInstrumentName;
  volume: number;
  muted: boolean;
  /** Position currently sounding during a sequence (scale) playback, else null. */
  playingPosition: FretPosition | null;
  /** Identifier of the active sequence playback (e.g. direction), else null. */
  playingId: string | null;
  setInstrument: (name: GuitarInstrumentName) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  playNote: (midi: number) => void;
  playPosition: (position: FretPosition) => void;
  /**
   * Play a set of fret positions sequentially like a scale run at the given
   * tempo (BPM). `id` labels the run so the UI can show a stop affordance.
   */
  playSequence: (positions: FretPosition[], bpm: number, id: string) => void;
  /** Strum a set of fret positions low-to-high. */
  strum: (positions: FretPosition[]) => void;
  stopAll: () => void;
}

/** One note per beat: convert beats-per-minute into a gap in milliseconds. */
function bpmToGapMs(bpm: number): number {
  return 60000 / Math.max(1, bpm);
}

/**
 * Owns a single GuitarAudioEngine for the lifetime of the component and mirrors
 * its loading/instrument/volume state into React. Also schedules the visual
 * "currently playing" highlight in lockstep with sequenced playback.
 */
export function useInstrument(): UseInstrument {
  const [engine] = useState(() => new GuitarAudioEngine());
  const [state, setState] = useState<EngineState>(() => engine.getState());
  const [playingPosition, setPlayingPosition] = useState<FretPosition | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => engine.subscribe(setState), [engine]);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const setInstrument = useCallback(
    (name: GuitarInstrumentName) => {
      void engine.setInstrument(name);
    },
    [engine],
  );

  const setVolume = useCallback((volume: number) => engine.setVolume(volume), [engine]);
  const setMuted = useCallback((muted: boolean) => engine.setMuted(muted), [engine]);

  const playNote = useCallback((midi: number) => void engine.playNote(midi), [engine]);

  const playPosition = useCallback(
    (position: FretPosition) => void engine.playNote(positionToMidi(position)),
    [engine],
  );

  const stopAll = useCallback(() => {
    engine.stopAll();
    clearTimers();
    setPlayingPosition(null);
    setPlayingId(null);
  }, [engine, clearTimers]);

  const strum = useCallback(
    (positions: FretPosition[]) => {
      clearTimers();
      setPlayingPosition(null);
      setPlayingId(null);
      const midis = positions.map(positionToMidi);
      if (midis.length === 0) return;
      void engine.playChord(midis);
    },
    [engine, clearTimers],
  );

  const playSequence = useCallback(
    (positions: FretPosition[], bpm: number, id: string) => {
      clearTimers();
      setPlayingPosition(null);

      const midis = positions.map(positionToMidi);
      if (midis.length === 0) {
        setPlayingId(null);
        return;
      }

      const gapMs = bpmToGapMs(bpm);
      setPlayingId(id);
      void engine.playSequence(midis, { gapMs, duration: gapMs / 1000 });

      // Drive the on-fretboard highlight to follow each note as it sounds.
      positions.forEach((position, index) => {
        timersRef.current.push(
          setTimeout(() => setPlayingPosition(position), index * gapMs),
        );
      });
      timersRef.current.push(
        setTimeout(() => {
          setPlayingPosition(null);
          setPlayingId(null);
        }, positions.length * gapMs),
      );
    },
    [engine, clearTimers],
  );

  return {
    ready: state.ready,
    loading: state.loading,
    instrument: state.instrument,
    volume: state.volume,
    muted: state.muted,
    playingPosition,
    playingId,
    setInstrument,
    setVolume,
    setMuted,
    playNote,
    playPosition,
    playSequence,
    strum,
    stopAll,
  };
}
