import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as Tone from 'tone';
import {
  BASS_PARAM_SPECS,
  BASS_PRESETS,
  DEFAULT_BASS_PARAMS,
  type BassParamKey,
  type BassParamSpec,
  type BassParams,
} from '../lib/audio/synth/bass/bassParams';
import { getBassSettings, setBassSettings, subscribeBassSettings } from '../lib/audio/synth/bass/bassSettings';
import {
  SoundLabAudio,
  matchTrim,
  measureModelledBass,
  measureSynthBass,
  type LabLineName,
  type LabVoice,
  type Levels,
  type MatchMode,
} from './soundLabAudio';

const KEY_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const PRESET_NAMES = Object.keys(BASS_PRESETS);

function formatValue(spec: BassParamSpec, value: number): string {
  if (spec.unit === '') return String(Math.round(value * 100));
  if (spec.unit === 'Hz' || spec.unit === 'c') return `${Math.round(value)} ${spec.unit}`;
  if (spec.unit === 'cm') return `${value.toFixed(1)} cm`;
  return `${value.toFixed(2)} ${spec.unit}`;
}

function formatDb(value: number): string {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}` : '–';
}

/** The preset these parameters are, or "custom". */
function presetOf(params: BassParams): string {
  return (
    PRESET_NAMES.find((name) => {
      const preset = { ...DEFAULT_BASS_PARAMS, ...BASS_PRESETS[name] };
      return BASS_PARAM_SPECS.every((spec) => preset[spec.key] === params[spec.key]);
    }) ?? 'custom'
  );
}

/**
 * The bass page of the sound lab (docs/specs/S1-modelled-bass.md): the synth
 * bass (A) against the modelled bass (B) at matched loudness, with the
 * model's controls. `SoundLabPanel` supplies the panel around it.
 */
export default function BassLab() {
  const settings = useSyncExternalStore(subscribeBassSettings, getBassSettings);
  const { params } = settings;
  const voice: LabVoice = settings.jamBass === 'modelled' ? 'b' : 'a';

  const [playing, setPlaying] = useState<LabLineName | null>(null);
  const [tempo, setTempo] = useState(100);
  const [keyPc, setKeyPc] = useState(9);
  const [pad, setPad] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('rms');
  const [levelsA, setLevelsA] = useState<Levels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleRate] = useState(() => Tone.getContext().sampleRate);
  const audioRef = useRef<SoundLabAudio | null>(null);
  const startingRef = useRef<Promise<SoundLabAudio> | null>(null);
  const summaryRef = useRef<HTMLInputElement>(null);

  // B is measured by rendering the reference line through the model itself, a
  // moment after the dials stop moving, so the match follows every change.
  const measuredParams = useDeferredValue(params);
  const levelsB = useMemo(() => measureModelledBass(measuredParams, sampleRate), [measuredParams, sampleRate]);
  // The trim never lifts B's peaks past full scale: the limiter would squash them and spoil the comparison.
  const wantedTrim = levelsA ? matchTrim(levelsA, levelsB, matchMode) : settings.trimDb;
  const ceiling = Math.floor(-levelsB.peakDb * 10) / 10;
  const trimDb = levelsA ? Math.min(Math.round(wantedTrim * 10) / 10, ceiling) : settings.trimDb;
  const shortBy = levelsA ? Math.max(0, wantedTrim - trimDb) : 0;

  // A is the synth bass rendered off-line through Tone, once.
  useEffect(() => {
    let current = true;
    measureSynthBass(sampleRate)
      .then((levels) => {
        if (current) setLevelsA(levels);
      })
      .catch(() => {
        if (current) setError('Could not measure the synth bass, so the two are not matched.');
      });
    return () => {
      current = false;
    };
  }, [sampleRate]);

  // The match is saved with the settings, so the jam loop plays the model at the same level.
  useEffect(() => {
    audioRef.current?.setTrim(trimDb);
    setBassSettings((saved) => (saved.trimDb === trimDb ? saved : { ...saved, trimDb }));
  }, [trimDb]);

  useEffect(() => {
    audioRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    audioRef.current?.setVoice(voice);
  }, [voice]);

  // [ and ] choose A and B from anywhere while the panel is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const left = event.code === 'BracketLeft' || event.key === '[';
      const right = event.code === 'BracketRight' || event.key === ']';
      if (!left && !right) return;
      if (event.target instanceof HTMLInputElement && event.target.type === 'text') return;
      event.preventDefault();
      const jamBass = left ? 'synth' : 'modelled';
      setBassSettings((saved) => ({ ...saved, jamBass }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Closing the panel stops the lab's sound.
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

  const audio = async (): Promise<SoundLabAudio> => {
    if (audioRef.current) return audioRef.current;
    const starting = startingRef.current ?? SoundLabAudio.create({ params, trimDb, voice });
    startingRef.current = starting;
    try {
      const created = await starting;
      if (startingRef.current === starting) {
        audioRef.current = created;
        startingRef.current = null;
      }
      return created;
    } catch (failure) {
      if (startingRef.current === starting) startingRef.current = null;
      throw failure;
    }
  };

  const play = async (line: LabLineName, options: { tempo?: number; keyPc?: number; pad?: boolean } = {}) => {
    setError(null);
    try {
      const lab = await audio();
      if (audioRef.current !== lab) return; // the panel closed while the sound was starting
      lab.play(line, options.tempo ?? tempo, options.keyPc ?? keyPc, options.pad ?? pad);
      setPlaying(line);
    } catch {
      setPlaying(null);
      setError('The modelled bass could not start in this browser.');
    }
  };

  const stop = () => {
    audioRef.current?.stop();
    setPlaying(null);
  };

  /** A change to tempo, key or pad restarts the line that is playing. */
  const replay = (options: { tempo?: number; keyPc?: number; pad?: boolean }) => {
    if (playing) void play(playing, options);
  };

  const choose = (next: LabVoice) => {
    setBassSettings((saved) => ({ ...saved, jamBass: next === 'b' ? 'modelled' : 'synth' }));
  };

  const setParam = (key: BassParamKey, value: number) => {
    setBassSettings((saved) => ({ ...saved, params: { ...saved.params, [key]: value } }));
  };

  const applyPreset = (name: string) => {
    setBassSettings((saved) => ({ ...saved, params: { ...DEFAULT_BASS_PARAMS, ...BASS_PRESETS[name] } }));
  };

  const preset = presetOf(params);
  const summary = `bass ${voice === 'b' ? 'B modelled' : 'A synth'} · ${preset} · ${BASS_PARAM_SPECS.map(
    (spec) => `${spec.key} ${params[spec.key]}`,
  ).join(' · ')} · trim ${formatDb(trimDb)} dB (${matchMode})`;

  const copySummary = () => {
    summaryRef.current?.select();
    void navigator.clipboard?.writeText(summary).catch(() => {});
  };

  return (
    <>
      <div className="sound-ab" role="group" aria-label="Which bass">
        <button type="button" aria-pressed={voice === 'a'} onClick={() => choose('a')}>
          <b>A</b> Synth
        </button>
        <button type="button" aria-pressed={voice === 'b'} onClick={() => choose('b')}>
          <b>B</b> Modelled
        </button>
      </div>
      <p className="sound-note">The jam loop in Progressions plays this one too. The choice is kept on this computer.</p>

      <div className="sound-row">
        <button type="button" aria-pressed={playing === 'riff'} onClick={() => void play('riff')}>
          Line
        </button>
        <button type="button" aria-pressed={playing === 'blues'} onClick={() => void play('blues')}>
          12-bar blues
        </button>
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
            max={200}
            value={tempo}
            onChange={(event) => {
              const next = Math.min(200, Math.max(50, Number(event.target.value) || 100));
              setTempo(next);
              replay({ tempo: next });
            }}
          />
        </label>
        <label>
          <span>Key</span>
          <select
            value={keyPc}
            onChange={(event) => {
              const next = Number(event.target.value);
              setKeyPc(next);
              replay({ keyPc: next });
            }}
          >
            {KEY_NAMES.map((name, pc) => (
              <option key={name} value={pc}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="sound-check">
          <input
            type="checkbox"
            checked={pad}
            onChange={(event) => {
              setPad(event.target.checked);
              replay({ pad: event.target.checked });
            }}
          />
          <span>Pad</span>
        </label>
      </div>

      <div className="sound-levels">
        <div className="sound-row">
          <span className="sound-label">Match</span>
          <button type="button" aria-pressed={matchMode === 'rms'} onClick={() => setMatchMode('rms')}>
            RMS
          </button>
          <button type="button" aria-pressed={matchMode === 'loudness'} onClick={() => setMatchMode('loudness')}>
            Loudness
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th />
              <th>RMS</th>
              <th>Peak</th>
              <th>LKFS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>A</th>
              <td>{levelsA ? formatDb(levelsA.rmsDb) : '…'}</td>
              <td>{levelsA ? formatDb(levelsA.peakDb) : '…'}</td>
              <td>{levelsA ? formatDb(levelsA.loudness) : '…'}</td>
            </tr>
            <tr>
              <th>B</th>
              <td>{formatDb(levelsB.rmsDb + trimDb)}</td>
              <td>{formatDb(levelsB.peakDb + trimDb)}</td>
              <td>{formatDb(levelsB.loudness + trimDb)}</td>
            </tr>
          </tbody>
        </table>
        <p className="sound-note">
          {shortBy >= 0.5
            ? `B is trimmed ${formatDb(trimDb)} dB, ${shortBy.toFixed(1)} dB short of a match: its peaks are sharper than A's and would pass full scale.`
            : `B is trimmed ${formatDb(trimDb)} dB to match A${levelsA ? '' : ' (measuring A…)'}.`}{' '}
          Levels are for the same four bars, before the master volume.
        </p>
      </div>

      <div className="sound-presets">
        {PRESET_NAMES.map((name) => (
          <button key={name} type="button" aria-pressed={preset === name} onClick={() => applyPreset(name)}>
            {name}
          </button>
        ))}
      </div>
      {BASS_PARAM_SPECS.map((spec) => (
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
      <p className="sound-note">\ hides this · [ is A, ] is B</p>
    </>
  );
}
