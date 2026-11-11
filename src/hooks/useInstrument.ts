import { useCallback, useEffect, useState } from 'react';
import type { FretPosition } from '../types/music';
import { positionToMidi } from '../lib/audio/pitch';
import { GuitarAudioEngine, type EngineState, type GuitarInstrumentName } from '../lib/audio/engine';
import { chordPattern, sequencePattern, type PlaybackOptions, type PracticePattern } from '../lib/audio/pattern';

export interface UseInstrument extends EngineState {
  playingPosition: FretPosition | null;
  playingId: string | null;
  setInstrument: (name: GuitarInstrumentName) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setRoom: (room: number) => void;
  playNote: (midi: number) => void;
  hearInterval: (rootMidi: number, semitones: number) => void;
  playPosition: (position: FretPosition) => void;
  playSequence: (positions: FretPosition[], bpm: number, id: string, onNote?: (index: number) => void) => void;
  strum: (positions: FretPosition[]) => void;
  playProgression: (chords: FretPosition[][], bpm: number, id: string, onStep?: (index: number) => void) => void;
  playPattern: (pattern: PracticePattern, options: PlaybackOptions, id?: string) => Promise<boolean>;
  stopAll: () => void;
}

export function useInstrument(): UseInstrument {
  const [engine] = useState(() => new GuitarAudioEngine());
  const [state, setState] = useState(() => engine.getState());
  const [playingPosition, setPlayingPosition] = useState<FretPosition | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  useEffect(() => engine.subscribe(setState), [engine]);
  useEffect(() => () => engine.stopAll(), [engine]);
  const stopAll = useCallback(() => {
    engine.stopAll(); setPlayingPosition(null); setPlayingId(null);
  }, [engine]);
  const setInstrument = useCallback((name: GuitarInstrumentName) => {
    setPlayingId(null); setPlayingPosition(null); void engine.setInstrument(name);
  }, [engine]);
  const setVolume = useCallback((volume: number) => engine.setVolume(volume), [engine]);
  const setMuted = useCallback((muted: boolean) => engine.setMuted(muted), [engine]);
  const setRoom = useCallback((room: number) => engine.setRoom(room), [engine]);
  const playNote = useCallback((midi: number) => { void engine.playNote(midi); }, [engine]);
  const hearInterval = useCallback((rootMidi: number, semitones: number) => { void engine.hearInterval(rootMidi, semitones); }, [engine]);
  const playPosition = useCallback((p: FretPosition) => { void engine.playNote(positionToMidi(p), { string: p.string }); }, [engine]);
  const strum = useCallback((positions: FretPosition[]) => {
    setPlayingPosition(null); setPlayingId(null); void engine.playChord(positions);
  }, [engine]);
  const playPattern = useCallback(async (pattern: PracticePattern, options: PlaybackOptions, id = 'practice') => {
    const success = await engine.playPattern(pattern, { ...options,
      onEvent: event => { setPlayingPosition(event.positions[0] ?? null); options.onEvent?.(event); },
      onEnd: () => { setPlayingId(null); setPlayingPosition(null); options.onEnd?.(); },
    });
    if (success) setPlayingId(id);
    return success;
  }, [engine]);
  const playSequence = useCallback((positions: FretPosition[], bpm: number, id: string, onNote?: (index: number) => void) => {
    void playPattern(sequencePattern(positions), { bpm, onEvent: e => onNote?.(e.index) }, id);
  }, [playPattern]);
  const playProgression = useCallback((chords: FretPosition[][], bpm: number, id: string, onStep?: (index: number) => void) => {
    void playPattern(chordPattern(chords), { bpm, onEvent: e => onStep?.(e.index) }, id);
  }, [playPattern]);
  return { ...state, playingPosition, playingId, setInstrument, setVolume, setMuted, setRoom,
    playNote, hearInterval, playPosition, strum, playPattern, playSequence, playProgression, stopAll };
}
