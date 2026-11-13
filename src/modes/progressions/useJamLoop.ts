import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UseInstrument } from '../../hooks/useInstrument';
import type { FretPosition } from '../../types/music';
import { chordPitchClasses, leadPadVoicings } from '../../lib/audio/padVoicing';
import {
  BEATS_PER_BAR,
  buildJamBar,
  jamBarStep,
  isTopOfForm,
  jamPosition,
  nextChange,
  type JamBarOptions,
  type NextChange,
} from '../../lib/audio/jamSchedule';
import { jamGains, type JamMix } from '../../lib/audio/jamMix';
import { getChordIntervals, noteToSemitone, type ResolvedProgressionStep } from '../../lib/music';
import { jamChordsOf } from './jamChords';

/** What the rest of the screen (and P3 and P4) reads about the loop. */
export interface JamLoopState {
  /** The loop is running, count-in included. */
  playing: boolean;
  /** The count-in bar. */
  countIn: boolean;
  /** The step (bar) sounding now. During the count-in, the first. */
  stepIndex: number;
  /** The step after it, wrapping to 0 at the end of a pass. */
  nextStepIndex: number;
  /**
   * The next step whose chord differs, and how many bars away (1 is the next
   * bar); null in a one-chord loop, and during the count-in.
   */
  next: NextChange | null;
  /** 0 to 3 within the bar. */
  beat: number;
  /** The bar before a change of chord (root, quality or bass differ). */
  changeComing: boolean;
  /** How many times round the loop, from 0. */
  pass: number;
  /** Bars played since the count-in, from 0 (it keeps counting past the end of a pass). */
  bar: number;
}

export const IDLE_JAM: JamLoopState = {
  playing: false,
  countIn: false,
  stepIndex: 0,
  nextStepIndex: 0,
  next: null,
  beat: 0,
  changeComing: false,
  pass: 0,
  bar: 0,
};

interface JamLoopInput {
  audio: UseInstrument;
  steps: ResolvedProgressionStep[];
  /** The shapes the neck and panel show now, one per step (the strum follows them). */
  chordPositions: FretPosition[][];
  /** How long the guitar holds each chord (the Guitar fader decides whether it sounds). */
  guitar: Exclude<JamBarOptions['guitar'], 'off'>;
  /** The three faders, applied to the engine at once, also while the loop is stopped. */
  mix: JamMix;
  feel: JamBarOptions['feel'];
  click: boolean;
  loop: boolean;
  tempo: number;
  progressionId: string;
  stepIndex: number;
  setStepIndex: (index: number) => void;
}

/**
 * Starts and stops the jam loop and tells the screen where it is. Choices
 * (guitar rhythm, feel, click, loop) are read at each bar line, and the tempo
 * and the mix faders at once, so changing them while it plays needs no
 * restart. From the second pass on, bar 1 carries a cymbal. When the loop ends
 * for any reason, the chord that was selected before Play comes back.
 */
export function useJamLoop(input: JamLoopInput) {
  const { audio, steps, tempo } = input;
  const [state, setState] = useState<JamLoopState>(IDLE_JAM);
  const running = audio.playingId?.startsWith('jam') ?? false;

  const chords = useMemo(() => jamChordsOf(steps), [steps]);
  const padVoicings = useMemo(
    () =>
      leadPadVoicings(
        steps.map((step) =>
          chordPitchClasses(noteToSemitone(step.root), getChordIntervals(step.quality)),
        ),
      ),
    [steps],
  );

  // The latest choices, for the scheduler to read at each bar line.
  const latest = useRef({ ...input, chords, padVoicings });
  useEffect(() => {
    latest.current = { ...input, chords, padVoicings };
  });
  const before = useRef<{ stepIndex: number; progressionId: string } | null>(null);

  const start = useCallback(
    (id = 'jam') => {
      const now = latest.current;
      if (now.chords.length === 0) return;
      before.current = { stepIndex: now.stepIndex, progressionId: now.progressionId };
      now.setStepIndex(0);
      setState({ ...IDLE_JAM, playing: true, countIn: true, changeComing: false });
      void now.audio
        .playJam(
          {
            bpm: now.tempo,
            steps: now.chords.length,
            getBar: (bar) => {
              const latestNow = latest.current;
              const position = jamPosition(bar, latestNow.chords);
              const { stepIndex } = position;
              return {
                events: buildJamBar(
                  jamBarStep(latestNow.chords, stepIndex, latestNow.padVoicings),
                  {
                    guitar: latestNow.guitar,
                    // the faders decide what sounds: an Off one schedules nothing
                    pad: true,
                    feel: latestNow.feel,
                    click: latestNow.click,
                    // the top of the form, from the second pass on
                    cymbal: isTopOfForm(position),
                  },
                ),
                strum: latestNow.chordPositions[stepIndex] ?? [],
              };
            },
            loop: () => latest.current.loop,
            onBeat: (bar, beat) => {
              const latestNow = latest.current;
              if (bar < 0) {
                setState({ ...IDLE_JAM, playing: true, countIn: true, beat });
                return;
              }
              const position = jamPosition(bar, latestNow.chords);
              latestNow.setStepIndex(position.stepIndex);
              setState({
                playing: true,
                countIn: false,
                beat,
                bar,
                ...position,
                next: nextChange(position.stepIndex, latestNow.chords),
              });
            },
          },
          id,
        )
        .then((started) => {
          if (!started) setState(IDLE_JAM);
        });
    },
    [],
  );

  // A running loop follows the Settings tempo.
  const { setJamTempo } = audio;
  useEffect(() => {
    if (running) setJamTempo(tempo);
  }, [running, tempo, setJamTempo]);

  // The faders reach the engine as they move, and at start-up from what was
  // saved, so the mix is set before Play. The engine ramps each change.
  const { setJamMix } = audio;
  const { guitar: guitarLevel, bass: bassLevel, pad: padLevel } = input.mix;
  useEffect(() => {
    setJamMix(jamGains({ guitar: guitarLevel, bass: bassLevel, pad: padLevel }));
  }, [setJamMix, guitarLevel, bassLevel, padLevel]);

  // However the loop ended, put the screen back as it was.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    setState(IDLE_JAM);
    const saved = before.current;
    before.current = null;
    if (saved && saved.progressionId === latest.current.progressionId) {
      latest.current.setStepIndex(saved.stepIndex);
    }
  }, [running]);

  return { state: running ? state : IDLE_JAM, start, beatsPerBar: BEATS_PER_BAR };
}
