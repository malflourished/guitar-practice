import { useDeferredValue, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Tone from 'tone';
import { DRUM_GROOVES, type DrumGroove } from '../lib/audio/drumGrooves';
import {
  DEFAULT_DRUM_PARAMS,
  DRUM_KIT_IDS,
  DRUM_KIT_LABELS,
  DRUM_PARAM_SPECS,
  sameDrumParams,
  type DrumKitId,
  type DrumParamKey,
  type DrumParamSpec,
  type DrumParams,
  type DrumPiece,
} from '../lib/audio/synth/drums/drumParams';
import { measureKit, type StereoLevels } from '../lib/audio/synth/drums/drumPattern';
import { getDrumSettings, setDrumSettings, subscribeDrumSettings } from '../lib/audio/synth/drums/drumSettings';
import { DrumLabAudio, drumKitTrim, type DrumMatchMode } from './drumLabAudio';

const KIT_LETTERS: Record<DrumKitId, string> = { acoustic: 'A', machine: 'B', brushes: 'C' };

/** Single strokes to try a kit piece by piece: the piece, how hard, and what the button says. */
const STROKES: { piece: DrumPiece; velocity: number; label: string; seconds?: number }[] = [
  { piece: 'kick', velocity: 0.9, label: 'Kick' },
  { piece: 'snare', velocity: 0.9, label: 'Snare' },
  { piece: 'snare', velocity: 0.2, label: 'Ghost' },
  { piece: 'rim', velocity: 0.7, label: 'Rim' },
  { piece: 'hatClosed', velocity: 0.75, label: 'Closed' },
  { piece: 'hatOpen', velocity: 0.7, label: 'Open' },
  { piece: 'hatFoot', velocity: 0.6, label: 'Foot' },
  { piece: 'ride', velocity: 0.8, label: 'Ride' },
  { piece: 'crash', velocity: 0.86, label: 'Crash' },
  { piece: 'tomHigh', velocity: 0.8, label: 'Tom 1' },
  { piece: 'tomMid', velocity: 0.8, label: 'Tom 2' },
  { piece: 'tomLow', velocity: 0.85, label: 'Tom 3' },
  { piece: 'brushTap', velocity: 0.8, label: 'Tap' },
  { piece: 'brushSweep', velocity: 0.7, label: 'Sweep', seconds: 0.6 },
];

function formatValue(spec: DrumParamSpec, value: number): string {
  if (spec.unit === '') return String(Math.round(value * 100));
  if (spec.unit === 'Hz') return `${Math.round(value)} Hz`;
  return `${value.toFixed(2)} ${spec.unit}`;
}

function formatDb(value: number): string {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}` : '–';
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number');
}

/** A dial has to rest this long before its kit is measured again, in milliseconds. */
const MEASURE_AFTER_MS = 140;

/**
 * A kit's levels on the reference part. Measuring renders ten seconds of
 * drums, so it waits until the kit's dials have rested a moment; until then
 * the last trim stands.
 */
function useKitLevels(kit: DrumKitId, params: DrumParams, sampleRate: number): StereoLevels | null {
  const settled = useDeferredValue(params);
  const [measured, setMeasured] = useState<{ params: DrumParams; levels: StereoLevels } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setMeasured((last) => (last && sameDrumParams(last.params, settled) ? last : { params: settled, levels: measureKit(kit, settled, sampleRate) })),
      MEASURE_AFTER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [kit, settled, sampleRate]);
  return measured && sameDrumParams(measured.params, params) ? measured.levels : null;
}

/**
 * The drums page of the sound lab (docs/specs/S2-drums.md): the acoustic kit
 * (A), the machine kit (B) and the brushes kit (C) at matched loudness, on
 * each of the jam loop's grooves, with each kit's main controls. The kit
 * chosen here is the kit the jam loop plays.
 */
export default function DrumLab() {
  const settings = useSyncExternalStore(subscribeDrumSettings, getDrumSettings);
  const { kit, humanize } = settings;
  const params = settings.params[kit];

  const [playing, setPlaying] = useState<DrumGroove | null>(null);
  const [tempo, setTempo] = useState(100);
  const [band, setBand] = useState(false);
  const [matchMode, setMatchMode] = useState<DrumMatchMode>('loudness');
  const [error, setError] = useState<string | null>(null);
  const [sampleRate] = useState(() => Tone.getContext().sampleRate);
  const audioRef = useRef<DrumLabAudio | null>(null);
  const startingRef = useRef<Promise<DrumLabAudio> | null>(null);
  const summaryRef = useRef<HTMLInputElement>(null);

  // Each kit is measured by rendering the reference part through the kit itself, so the match follows every dial.
  const levels: Record<DrumKitId, StereoLevels | null> = {
    acoustic: useKitLevels('acoustic', settings.params.acoustic, sampleRate),
    machine: useKitLevels('machine', settings.params.machine, sampleRate),
    brushes: useKitLevels('brushes', settings.params.brushes, sampleRate),
  };
  const trims = {} as Record<DrumKitId, { trimDb: number; shortBy: number }>;
  for (const id of DRUM_KIT_IDS) {
    const measured = levels[id];
    trims[id] = measured ? drumKitTrim(measured, sampleRate, matchMode) : { trimDb: settings.trimDb[id], shortBy: 0 };
  }
  const { acoustic: trimA, machine: trimB, brushes: trimC } = { acoustic: trims.acoustic.trimDb, machine: trims.machine.trimDb, brushes: trims.brushes.trimDb };

  // The match is saved with the settings, so the jam loop plays each kit at the level found here.
  useEffect(() => {
    const found = { acoustic: trimA, machine: trimB, brushes: trimC };
    for (const id of DRUM_KIT_IDS) audioRef.current?.setTrim(id, found[id]);
    setDrumSettings((saved) => (DRUM_KIT_IDS.every((id) => saved.trimDb[id] === found[id]) ? saved : { ...saved, trimDb: found }));
  }, [trimA, trimB, trimC]);

  const { acoustic: paramsA, machine: paramsB, brushes: paramsC } = settings.params;
  useEffect(() => {
    audioRef.current?.setParams('acoustic', paramsA);
  }, [paramsA]);
  useEffect(() => {
    audioRef.current?.setParams('machine', paramsB);
  }, [paramsB]);
  useEffect(() => {
    audioRef.current?.setParams('brushes', paramsC);
  }, [paramsC]);

  useEffect(() => {
    audioRef.current?.setKit(kit);
  }, [kit]);

  useEffect(() => {
    audioRef.current?.setHumanize(humanize);
  }, [humanize]);

  // Closing the page stops the lab's sound.
  useEffect(
    () => () => {
      const starting = startingRef.current;
      startingRef.current = null;
      audioRef.current?.dispose();
      audioRef.current = null;
      void starting?.then((audio) => audio.dispose()).catch(() => {});
    },
    [],
  );

  const audio = async (): Promise<DrumLabAudio> => {
    if (audioRef.current) return audioRef.current;
    const starting = startingRef.current ?? DrumLabAudio.create(getDrumSettings());
    startingRef.current = starting;
    try {
      const created = await starting;
      if (startingRef.current === starting) {
        audioRef.current = created;
        startingRef.current = null;
        // catch up with anything that moved while the kits were loading
        const now = getDrumSettings();
        created.setKit(now.kit);
        created.setHumanize(now.humanize);
        for (const id of DRUM_KIT_IDS) {
          created.setParams(id, now.params[id]);
          created.setTrim(id, now.trimDb[id]);
        }
      }
      return created;
    } catch (failure) {
      if (startingRef.current === starting) startingRef.current = null;
      throw failure;
    }
  };

  const play = async (groove: DrumGroove, options: { tempo?: number; band?: boolean } = {}) => {
    setError(null);
    try {
      const lab = await audio();
      if (audioRef.current !== lab) return; // the page closed while the sound was starting
      lab.play(groove, options.tempo ?? tempo, options.band ?? band);
      setPlaying(groove);
    } catch {
      setPlaying(null);
      setError('The drum kit could not start in this browser.');
    }
  };

  const stop = () => {
    audioRef.current?.stop();
    setPlaying(null);
  };

  const strike = async (piece: DrumPiece, velocity: number, seconds = 0) => {
    setError(null);
    try {
      const lab = await audio();
      if (audioRef.current === lab) lab.hit(piece, velocity, seconds);
    } catch {
      setError('The drum kit could not start in this browser.');
    }
  };

  /** A change to tempo or band restarts the groove that is playing. */
  const replay = (options: { tempo?: number; band?: boolean }) => {
    if (playing) void play(playing, options);
  };

  const choose = (next: DrumKitId) => setDrumSettings((saved) => ({ ...saved, kit: next }));

  const setParam = (key: DrumParamKey, value: number) => {
    setDrumSettings((saved) => ({ ...saved, params: { ...saved.params, [saved.kit]: { ...saved.params[saved.kit], [key]: value } } }));
  };

  const resetKit = () => {
    setDrumSettings((saved) => ({ ...saved, params: { ...saved.params, [saved.kit]: DEFAULT_DRUM_PARAMS[saved.kit] } }));
  };

  // [ and ] step through the kits, 1 to 4 start a groove and 0 stops, from anywhere while the page is open.
  const keysRef = useRef({ play, stop });
  useEffect(() => {
    keysRef.current = { play, stop };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || isTyping(event.target)) return;
      const left = event.code === 'BracketLeft' || event.key === '[';
      const right = event.code === 'BracketRight' || event.key === ']';
      if (left || right) {
        event.preventDefault();
        setDrumSettings((saved) => {
          const index = DRUM_KIT_IDS.indexOf(saved.kit) + (left ? -1 : 1);
          return { ...saved, kit: DRUM_KIT_IDS[Math.min(DRUM_KIT_IDS.length - 1, Math.max(0, index))] };
        });
        return;
      }
      const groove = DRUM_GROOVES[Number(event.key) - 1];
      if (groove && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        void keysRef.current.play(groove.id);
      } else if (event.key === '0') {
        event.preventDefault();
        keysRef.current.stop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isDefault = sameDrumParams(params, DEFAULT_DRUM_PARAMS[kit]);
  const summary = `drums ${KIT_LETTERS[kit]} ${kit}${isDefault ? ' (default)' : ''} · ${DRUM_PARAM_SPECS.map(
    (spec) => `${spec.key} ${params[spec.key]}`,
  ).join(' · ')} · humanize ${humanize} · trim ${formatDb(trims[kit].trimDb)} dB (${matchMode})`;

  const copySummary = () => {
    summaryRef.current?.select();
    void navigator.clipboard?.writeText(summary).catch(() => {});
  };

  const short = trims[kit].shortBy;

  return (
    <>
      <div className="sound-ab sound-abc" role="group" aria-label="Which kit">
        {DRUM_KIT_IDS.map((id) => (
          <button key={id} type="button" aria-pressed={kit === id} onClick={() => choose(id)}>
            <b>{KIT_LETTERS[id]}</b> {DRUM_KIT_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="sound-note">
        The jam loop in Progressions plays this kit, once its Drums fader is up. The choice is kept on this computer.
      </p>

      <div className="sound-row sound-wrap">
        {DRUM_GROOVES.map((groove) => (
          <button key={groove.id} type="button" aria-pressed={playing === groove.id} onClick={() => void play(groove.id)}>
            {groove.label}
          </button>
        ))}
        <button type="button" disabled={!playing} onClick={stop}>
          Stop
        </button>
      </div>
      <div className="sound-row sound-options">
        <label>
          <span>Tempo</span>
          <input
            type="number"
            min={50}
            max={220}
            value={tempo}
            onChange={(event) => {
              const next = Math.min(220, Math.max(50, Number(event.target.value) || 100));
              setTempo(next);
              replay({ tempo: next });
            }}
          />
        </label>
        <label className="sound-check" title="A 12-bar blues in A, with the jam loop's bass and pad">
          <input
            type="checkbox"
            checked={band}
            onChange={(event) => {
              setBand(event.target.checked);
              replay({ band: event.target.checked });
            }}
          />
          <span>Bass and pad</span>
        </label>
      </div>
      <p className="sound-note">
        {band ? 'A 12-bar blues in A: a fill in bar 12, the crash at the top.' : 'Four bars round: a fill in bar 4, the crash at the top.'}
      </p>

      <div className="sound-strokes" role="group" aria-label="One stroke">
        {STROKES.map((stroke) => (
          <button key={stroke.label} type="button" onClick={() => void strike(stroke.piece, stroke.velocity, stroke.seconds)}>
            {stroke.label}
          </button>
        ))}
      </div>

      <div className="sound-levels">
        <div className="sound-row">
          <span className="sound-label">Match</span>
          <button type="button" aria-pressed={matchMode === 'loudness'} onClick={() => setMatchMode('loudness')}>
            Loudness
          </button>
          <button type="button" aria-pressed={matchMode === 'rms'} onClick={() => setMatchMode('rms')}>
            RMS
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th />
              <th>RMS</th>
              <th>Peak</th>
              <th>LKFS</th>
              <th>Trim</th>
            </tr>
          </thead>
          <tbody>
            {DRUM_KIT_IDS.map((id) => {
              const measured = levels[id];
              const trim = trims[id].trimDb;
              return (
                <tr key={id}>
                  <th>{KIT_LETTERS[id]}</th>
                  <td>{measured ? formatDb(measured.rmsDb + trim) : '…'}</td>
                  <td>{measured ? formatDb(measured.peakDb + trim) : '…'}</td>
                  <td>{measured ? formatDb(measured.loudness + trim) : '…'}</td>
                  <td>{formatDb(trim)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="sound-note">
          {short >= 0.5
            ? `${KIT_LETTERS[kit]} is ${short.toFixed(1)} dB short of a match: its peaks would pass the top.`
            : 'Each kit is trimmed to the acoustic kit at its default settings.'}{' '}
          Levels are for four bars of straight eighths, before the master volume.
        </p>
      </div>

      <div className="sound-presets">
        <span className="sound-label">
          {KIT_LETTERS[kit]} {DRUM_KIT_LABELS[kit]}
        </span>
        <button type="button" disabled={isDefault} onClick={resetKit}>
          Reset
        </button>
      </div>
      {DRUM_PARAM_SPECS.map((spec) => (
        <label key={spec.key} className="sound-dial" title={spec.hint}>
          <span>{spec.label}</span>
          <input
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={params[spec.key]}
            onChange={(event) => setParam(spec.key, Number(event.target.value))}
          />
          <output>{formatValue(spec, params[spec.key])}</output>
        </label>
      ))}
      <label className="sound-dial" title="How much the grooves' timing and dynamics wander. 0 is exactly as written.">
        <span>Humanize</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={humanize}
          onChange={(event) => setDrumSettings((saved) => ({ ...saved, humanize: Number(event.target.value) }))}
        />
        <output>{Math.round(humanize * 100)}</output>
      </label>

      {error && (
        <p className="sound-error" role="alert">
          {error}
        </p>
      )}
      <div className="sound-row">
        <button type="button" onClick={copySummary}>
          Copy settings
        </button>
      </div>
      <input
        ref={summaryRef}
        className="sound-summary"
        readOnly
        value={summary}
        aria-label="Current settings as text"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="sound-note">\ hides this · [ and ] step through the kits · 1 to 4 play a groove, 0 stops</p>
    </>
  );
}
