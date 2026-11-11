import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { NoteName, ChordQuality } from '../types/music';
import type { UseInstrument } from '../hooks/useInstrument';
import { ALL_NOTES, NOTE_COLORS } from '../lib/colors';
import { buildScalePositions, buildChordPositions, noteToSemitone, semitoneToNote, formatNoteDisplay, type NotationPreference } from '../lib/music';
import { orderScalePositions } from '../lib/audio/pitch';
import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/instruments';
import { chordPattern, sequencePattern } from '../lib/audio/pattern';
import { sessionReducer, type SessionState } from '../lib/practice/reducer';
import { DRAFT_KEY, HISTORY_KEY, PRACTICE_BLOCKS, SESSION_SECONDS, formatTime, loadDraft, loadHistory, saveHistory, finishSession, type Rating } from '../lib/practice/session';
import { Fretboard } from './Fretboard';
import styles from './PracticeSession.module.css';

interface Props { root: NoteName; notation: NotationPreference; audio: UseInstrument; onRootChange: (root: NoteName) => void }
const EAR_INTERVALS = [{ semitones: 3, name: 'Minor third', short: '♭3' }, { semitones: 7, name: 'Perfect fifth', short: '5' }, { semitones: 10, name: 'Minor seventh', short: '♭7' }];
const RATINGS: { id: Rating; label: string }[] = [{ id: 'clean', label: 'Felt clean' }, { id: 'working', label: 'Getting there' }, { id: 'revisit', label: 'Revisit this' }];
function initialState(): SessionState {
  const data = loadDraft();
  return { data, status: data ? (data.elapsed[data.block] >= PRACTICE_BLOCKS[data.block].seconds ? 'review' : 'paused') : 'ready' };
}

export function PracticeSession({ root, notation, audio, onRootChange }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialState);
  const [history, setHistory] = useState(loadHistory);
  const [tempo, setTempo] = useState(72);
  const [metronome, setMetronome] = useState(true);
  const [ramp, setRamp] = useState(false);
  const [beat, setBeat] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [liveTempo, setLiveTempo] = useState(72);
  const [chordIndex, setChordIndex] = useState(0);
  const [question, setQuestion] = useState(() => Math.floor(Math.random() * EAR_INTERVALS.length));
  const [answer, setAnswer] = useState<number | null>(null);
  const answered = useRef(false);
  const [storageError, setStorageError] = useState(false);
  const [ending, setEnding] = useState(false);
  const { data: session, status } = state;
  const blockIndex = session?.block ?? 0;
  const block = PRACTICE_BLOCKS[blockIndex];
  const active = ['loading', 'counting', 'running'].includes(status);
  const sessionRoot = session?.root ?? root;
  const sessionTempo = session?.bpm ?? tempo;
  const rootLabel = formatNoteDisplay(sessionRoot, notation);
  const rootPc = noteToSemitone(sessionRoot);
  const region = useMemo(() => buildScalePositions(sessionRoot, 'minorPentatonic')[0], [sessionRoot]);
  const scaleRun = useMemo(() => {
    const ascending = orderScalePositions(region.positions, sessionRoot, 'ascending');
    return [...ascending, ...ascending.slice(1, -1).reverse()];
  }, [region, sessionRoot]);
  const roots = useMemo(() => region.positions.filter(p => [0, 7].includes((noteToSemitone(p.note) - rootPc + 12) % 12)), [region, rootPc]);
  const chords = useMemo(() => [
    { root: sessionRoot, quality: 'minor' as ChordQuality, numeral: 'i' },
    { root: semitoneToNote(rootPc + 5), quality: 'minor' as ChordQuality, numeral: 'iv' },
    { root: semitoneToNote(rootPc + 7), quality: 'major' as ChordQuality, numeral: 'V' },
  ].map(chord => ({ ...chord, region: buildChordPositions(chord.root, chord.quality)[0] })), [sessionRoot, rootPc]);
  const pattern = useMemo(() => {
    if (blockIndex === 0) return sequencePattern(orderScalePositions(roots, sessionRoot, 'ascending'), 2);
    if (blockIndex === 1) return sequencePattern(scaleRun, 0.5);
    if (blockIndex === 2) return { events: [], beats: 4 };
    return chordPattern(chords.map(chord => chord.region.positions), 4);
  }, [blockIndex, chords, roots, scaleRun, sessionRoot]);
  const playPattern = audio.playPattern;
  const stopAll = audio.stopAll;

  // One transport owns the count-in, notes, metronome, and visual beat cues.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void playPattern(pattern, {
      bpm: sessionTempo, countIn: 4, loop: true,
      metronome: blockIndex !== 2 && metronome,
      ramp: blockIndex === 1 && ramp,
      onBeat: (current, counting, currentCycle, bpm) => {
        setBeat(current % 4); setCycle(currentCycle); setLiveTempo(bpm);
        if (!counting) dispatch({ type: 'running' });
      },
      onEvent: event => { if (blockIndex === 3) setChordIndex(event.index); },
    }).then(success => {
      if (!cancelled) dispatch({ type: success ? 'counting' : 'pause' });
    });
    return () => { cancelled = true; stopAll(); };
  }, [active, blockIndex, pattern, playPattern, stopAll, sessionTempo, metronome, ramp]);

  useEffect(() => {
    if (status !== 'running') return;
    let previous = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'tick', seconds: Math.min((now - previous) / 1000, 1) });
      previous = now;
    }, 250);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const pause = () => { if (document.hidden) dispatch({ type: 'pause' }); };
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('pagehide', pause);
    return () => { document.removeEventListener('visibilitychange', pause); window.removeEventListener('pagehide', pause); };
  }, []);

  useEffect(() => {
    try {
      if (session && !session.finishedAt) localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report failure of this external storage write.
      setStorageError(true);
    }
  }, [session]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.isContentEditable) return;
      if (event.code === 'Space' && (active || status === 'paused')) {
        event.preventDefault(); dispatch({ type: active ? 'pause' : 'resume' });
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [active, status]);

  const finish = () => {
    if (!session) return;
    stopAll();
    const now = new Date().toISOString();
    const result = finishSession(session, now);
    const saved = saveHistory(loadHistory(), result);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(saved)); } catch { setStorageError(true); }
    setHistory(saved);
    dispatch({ type: 'finish', now });
    setEnding(false);
  };
  const start = () => {
    onRootChange(sessionRoot);
    if (session) dispatch({ type: 'resume' });
    else dispatch({ type: 'start', root, bpm: tempo, id: crypto.randomUUID(), now: new Date().toISOString() });
  };
  const hear = () => audio.hearInterval(48 + rootPc, EAR_INTERVALS[question].semitones);
  const choose = (semitones: number) => {
    if (answered.current || status !== 'running') return;
    answered.current = true;
    setAnswer(semitones);
    dispatch({ type: 'answer', attempt: { interval: EAR_INTERVALS[question].semitones, answer: semitones, correct: EAR_INTERVALS[question].semitones === semitones } });
  };
  const nextQuestion = () => {
    const next = (question + 1 + Math.floor(Math.random() * 2)) % EAR_INTERVALS.length;
    setQuestion(next); setAnswer(null); answered.current = false;
    audio.hearInterval(48 + rootPc, EAR_INTERVALS[next].semitones);
  };
  const elapsed = session?.elapsed.reduce((sum, seconds) => sum + seconds, 0) ?? 0;
  const correct = session?.attempts.filter(attempt => attempt.correct).length ?? 0;
  const attempts = session?.attempts.length ?? 0;
  const currentChord = chords[chordIndex];
  const boardRegion = blockIndex === 3 ? currentChord.region : region;
  const boardPositions = blockIndex === 0 ? roots : boardRegion.positions;
  const boardEnd = Math.max(boardRegion.endFret, boardRegion.startFret + 4);
  const instructions = [
    `Play each highlighted ${rootLabel} root, then its fifth. Say the note names aloud. Let each note ring for two beats.`,
    'Follow the loop up and down the shape. Keep your pick motion small and even. One note per eighth note; relaxed hands before speed.',
    'Listen to the two notes, then name their distance. Each question counts your first answer. Replay as often as you need.',
    'One bar per chord. Start by playing the root on beat one, then improvise with the highlighted chord tones. Let the major V pull you home.',
  ];

  const soundSettings = <div className={styles.soundSettings}>
    <label>Guitar<select aria-label="Practice guitar sound" disabled={active} value={audio.instrument} onChange={e => audio.setInstrument(e.target.value as GuitarInstrumentName)}>{GUITAR_INSTRUMENTS.map(instrument => <option key={instrument.name} value={instrument.name}>{instrument.label}</option>)}</select></label>
    <label>Volume<input aria-label="Practice volume" type="range" min="0" max="1" step="0.01" value={audio.volume} onChange={e => audio.setVolume(Number(e.target.value))} /></label>
    <label>Room<input aria-label="Room ambience" type="range" min="0" max="0.5" step="0.01" value={audio.room} onChange={e => audio.setRoom(Number(e.target.value))} /></label>
    <button type="button" className={styles.quietButton} aria-pressed={audio.muted} onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? 'Unmute' : 'Mute'}</button>
  </div>;

  return <section className={styles.practice} aria-label="Daily practice" data-status={status}>
    {storageError && <p role="alert" className={styles.notice}>Your browser couldn’t save this practice. Keep this tab open; results may be lost when you close it.</p>}
    {audio.error && <p role="alert" className={styles.notice}>{audio.error} <button onClick={() => audio.setInstrument(audio.instrument)}>Retry sound</button></p>}
    {status === 'ready' ? <>
      <header className={styles.welcome}>
        <div><p className={styles.eyebrow}>YOUR DAILY PRACTICE · 10 MINUTES</p><h1>Find your flow.</h1><p className={styles.intro}>A little focus. A few good repetitions.<br />Take what you know and turn it into music.</p></div>
        <div className={styles.duration} aria-label="10 minutes"><span>10</span><small>MINUTES, JUST FOR YOU</small></div>
      </header>
      <div className={styles.plan}>{PRACTICE_BLOCKS.map((item, index) => <div className={styles.planBlock} key={item.id}><div className={styles.planTop}><span>0{index + 1}</span><span>{item.seconds / 60} MIN</span></div><h2>{item.title}</h2><p>{item.detail}</p></div>)}</div>
      <div className={styles.startBar}><div className={styles.setup}>
        <label>KEY<select aria-label="Practice key" value={root} onChange={e => onRootChange(e.target.value as NoteName)}>{ALL_NOTES.map(note => <option key={note} value={note}>{formatNoteDisplay(note, notation)} minor</option>)}</select></label>
        <label>TEMPO<select aria-label="Practice tempo" value={tempo} onChange={e => setTempo(Number(e.target.value))}>{[48, 60, 72, 84, 96, 108].map(bpm => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label>
      </div><button className={styles.primary} onClick={start}>Start my practice <span aria-hidden="true">↗</span></button></div>
      <p className={styles.footnote}>Four beats to get ready. Pause whenever you need. Your place is saved on this device.</p>
      {soundSettings}
    </> : status === 'finished' && session ? <div className={styles.result}>
      <p className={styles.eyebrow}>{session.completed ? 'TEN MINUTES WELL SPENT' : 'EVERY MINUTE COUNTS'}</p>
      <h1>{storageError ? 'Practice finished.' : 'Practice, saved.'}</h1><p className={styles.intro}>{rootLabel} minor · {session.bpm} BPM · {session.completed ? 'Full session' : 'Short session'}</p>
      <div className={styles.stats}><div><strong>{formatTime(elapsed)}</strong><span>time practiced</span></div><div><strong>{attempts ? `${correct}/${attempts}` : '—'}</strong><span>intervals correct</span></div><div><strong>{Object.values(session.ratings).filter(r => r === 'clean').length}</strong><span>blocks felt clean</span></div></div>
      <p className={styles.resultTip}>{Object.values(session.ratings).includes('revisit') ? 'Next time, start with the blocks you marked to revisit. Stay at a comfortable tempo.' : 'Come back to the same key next time. Aim for a relaxed, even sound before increasing the tempo.'}</p>
      <button className={styles.primary} onClick={() => { dispatch({ type: 'reset' }); setAnswer(null); answered.current = false; }}>Back to my practice <span aria-hidden="true">↗</span></button>
    </div> : session ? <>
      <nav className={styles.steps} aria-label="Session blocks">{PRACTICE_BLOCKS.map((item, index) => <div key={item.id} className={index === blockIndex ? styles.currentStep : styles.step} aria-current={index === blockIndex ? 'step' : undefined}><span>{session.elapsed[index] >= item.seconds ? '✓' : `0${index + 1}`}</span>{item.short}<small>{item.seconds / 60}m</small></div>)}</nav>
      <div className={styles.sessionProgress} role="progressbar" aria-label="Practice progress" aria-valuenow={Math.floor(elapsed)} aria-valuemin={0} aria-valuemax={SESSION_SECONDS}><span style={{ width: `${elapsed / SESSION_SECONDS * 100}%` }} /></div>
      <header className={styles.stageHeader}><div><p className={styles.eyebrow}>{rootLabel.toUpperCase()} MINOR · BLOCK {blockIndex + 1} OF 4</p><h1>{block.title}</h1></div><div className={styles.timer}><strong>{formatTime(block.seconds - session.elapsed[blockIndex])}</strong><span>left in this block</span></div></header>
      <p className={styles.instruction}>{instructions[blockIndex]}</p>
      <div className={styles.transport}>
        {status === 'review' ? <button className={styles.primary} onClick={blockIndex === 3 ? finish : () => { setChordIndex(0); setCycle(0); dispatch({ type: 'next' }); }}>{blockIndex === 3 ? 'Save my session' : `Next: ${PRACTICE_BLOCKS[blockIndex + 1].short}`} <span aria-hidden="true">↗</span></button> : <button className={styles.primary} onClick={active ? () => dispatch({ type: 'pause' }) : start}>{status === 'loading' ? 'Cancel loading' : active ? 'Pause practice' : 'Resume practice'}</button>}
        <div className={styles.beatStatus} role="status">{status === 'loading' ? 'Getting your guitar ready…' : status === 'counting' ? `Count in · ${beat + 1} / 4` : status === 'review' ? 'Block complete. Take a breath.' : status === 'paused' ? 'Paused · your place is saved' : `${liveTempo} BPM${blockIndex === 2 ? ' · listen & answer' : ` · loop ${cycle + 1}`}`}</div>
        <div className={styles.beats} aria-hidden="true">{[0, 1, 2, 3].map(n => <i key={n} className={active && beat === n ? styles.litBeat : ''} />)}</div>
      </div>
      {blockIndex === 2 ? <div className={styles.earCard}>
        <p className={styles.eyebrow}>LISTEN FIRST. TRUST YOUR EAR.</p><h2>{answer === null ? 'What interval do you hear?' : answer === EAR_INTERVALS[question].semitones ? 'You’ve got it.' : `That was a ${EAR_INTERVALS[question].name.toLowerCase()}.`}</h2>
        <button className={styles.listen} onClick={hear} disabled={status !== 'running' || audio.muted}>♫ {answer === null ? 'Listen / replay' : 'Hear it again'}</button>
        <div className={styles.answers}>{EAR_INTERVALS.map(interval => <button key={interval.semitones} disabled={status !== 'running' || answer !== null} className={answer !== null && interval.semitones === EAR_INTERVALS[question].semitones ? styles.correctAnswer : ''} onClick={() => choose(interval.semitones)}><strong>{interval.short}</strong>{interval.name}</button>)}</div>
        <div className={styles.earFooter}><span>{correct} / {attempts} correct · first answers</span><button disabled={answer === null || status !== 'running'} className={styles.quietButton} onClick={nextQuestion}>Next interval →</button></div>
      </div> : <div className={styles.boardCard}>
        {blockIndex === 3 && <div className={styles.chordStrip}>{chords.map((chord, index) => <div key={chord.numeral} className={index === chordIndex ? styles.activeChord : ''}><small>{chord.numeral} · 4 BEATS</small><strong>{formatNoteDisplay(chord.root, notation)}{chord.quality === 'minor' ? 'm' : ''}</strong></div>)}</div>}
        <div className={styles.boardCaption}><span>{blockIndex === 0 ? 'ROOT + FIFTH' : blockIndex === 1 ? 'MINOR PENTATONIC' : 'CHORD TONES'}</span><span>Frets {boardRegion.startFret === 0 ? 'open' : boardRegion.startFret}–{boardEnd} · tap a note to hear it</span></div>
        <Fretboard fretRange={[boardRegion.startFret, boardEnd]} positions={boardPositions} title={`${rootLabel} ${block.short} practice`} notation={notation} noteColors={NOTE_COLORS} rootNote={blockIndex === 3 ? currentChord.root : sessionRoot} intervalLabeling={{ root: blockIndex === 3 ? currentChord.root : sessionRoot, style: 'function' }} showNoteLabels fullDotOpacity onPlayNote={audio.muted ? undefined : audio.playPosition} activePosition={audio.playingPosition} mutedStrings={blockIndex === 3 ? currentChord.region.mutedStrings : []} />
      </div>}
      <div className={styles.reflection}><span>How does it feel?</span>{RATINGS.map(rating => <button key={rating.id} aria-pressed={session.ratings[blockIndex] === rating.id} onClick={() => dispatch({ type: 'rate', rating: rating.id })}>{rating.label}</button>)}<small>Your assessment of your playing.</small></div>
      <div className={styles.practiceOptions}><label><input type="checkbox" checked={metronome} disabled={active} onChange={e => setMetronome(e.target.checked)} /> Metronome</label><label><input type="checkbox" checked={ramp} disabled={active} onChange={e => setRamp(e.target.checked)} /> Scale: +4 BPM every 4 loops, up to 120</label><span>Space to pause / resume</span></div>
      {soundSettings}
      <div className={styles.endRow}>{ending ? <><span>Save what you’ve practiced and finish early?</span><button className={styles.quietButton} onClick={finish}>Save & finish</button><button className={styles.quietButton} onClick={() => setEnding(false)}>Keep practicing</button></> : <button className={styles.textButton} onClick={() => { dispatch({ type: 'pause' }); setEnding(true); }}>Finish early</button>}</div>
    </> : null}
    {(status === 'ready' || status === 'finished') && history.length > 0 && <section className={styles.history} aria-label="Practice history"><div className={styles.historyTitle}><h2>Your recent practice</h2><span>Saved on this device</span></div>{history.slice(0, 5).map(item => <div className={styles.historyRow} key={item.id}><span>{new Date(item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><strong>{formatNoteDisplay(item.root, notation)} minor</strong><span>{formatTime(item.elapsed.reduce((sum, n) => sum + n, 0))}</span><span>{item.completed ? 'Complete' : 'Short session'}</span></div>)}</section>}
  </section>;
}
