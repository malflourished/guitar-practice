import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { NoteName } from '../types/music';
import type { UseInstrument } from '../hooks/useInstrument';
import { ALL_NOTES, NOTE_COLORS } from '../lib/colors';
import { noteToSemitone, semitoneToNote, formatNoteDisplay, formatSpelled, getKeySpellingMap, getSpelledScaleNotes, spelledRootFromNoteName, type NotationPreference } from '../lib/music';
import { spellOffsetFromKey } from '../lib/music/noteSpelling';
import { orderScalePositions } from '../lib/audio/pitch';
import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/instruments';
import { chordPattern, sequencePattern } from '../lib/audio/pattern';
import { sessionReducer, type SessionState } from '../lib/practice/reducer';
import { boxRegion, changesChords } from '../lib/practice/board';
import { EAR_NAMES, EAR_SET_SIZE, addDays, choiceOf, earShorts, localDay, planFor, type KeyQuality, type PlanChoice } from '../lib/practice/plan';
import { DRAFT_KEY, HISTORY_KEY, PRACTICE_BLOCKS, SESSION_SECONDS, formatTime, loadDraft, loadHistory, saveHistory, finishSession, type Rating } from '../lib/practice/session';
import { Fretboard } from './Fretboard';
import { Deck, DeckRow, Neck, SidePanel } from './Frame';
import styles from './PracticeSession.module.css';

/** `root` is the app's key. Practice follows its own plan, and sets the app's key on Start. */
interface Props { root: NoteName; notation: NotationPreference; audio: UseInstrument; onRootChange: (root: NoteName) => void }
const RATINGS: { id: Rating; label: string }[] = [{ id: 'clean', label: 'Felt clean' }, { id: 'working', label: 'Getting there' }, { id: 'revisit', label: 'Revisit this' }];
function initialState(): SessionState {
  const data = loadDraft();
  return { data, status: data ? (data.elapsed[data.block] >= PRACTICE_BLOCKS[data.block].seconds ? 'review' : 'paused') : 'ready' };
}

export function PracticeSession({ notation, audio, onRootChange }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialState);
  const [history, setHistory] = useState(loadHistory);
  const [tempo, setTempo] = useState(72);
  const [metronome, setMetronome] = useState(true);
  const [ramp, setRamp] = useState(false);
  const [beat, setBeat] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [liveTempo, setLiveTempo] = useState(72);
  const [chordIndex, setChordIndex] = useState(0);
  const [question, setQuestion] = useState(() => Math.floor(Math.random() * EAR_SET_SIZE));
  const [answer, setAnswer] = useState<number | null>(null);
  const answered = useRef(false);
  /** How many questions in a row have asked the current interval. */
  const sameInARow = useRef(1);
  // Today's plan: the box, the key and the ear set, from the days before today.
  const [today] = useState(() => localDay(new Date()));
  // A key's root by the name that needs fewer accidentals: B♭ major, not A# major.
  const name = useCallback((note: NoteName, q: KeyQuality) => formatSpelled(getSpelledScaleNotes(spelledRootFromNoteName(note, notation), q)[0]), [notation]);
  const plan = useMemo(() => planFor(today, history, name), [today, history, name]);
  const nextPlan = useMemo(() => planFor(addDays(today, 1), history, name), [today, history, name]);
  /** 'plan', or a key picked for today only, as "A:minor". */
  const [keyChoice, setKeyChoice] = useState('plan');
  const [storageError, setStorageError] = useState(false);
  const [ending, setEnding] = useState(false);
  const { data: session, status } = state;
  const blockIndex = session?.block ?? 0;
  const block = PRACTICE_BLOCKS[blockIndex];
  const active = ['loading', 'counting', 'running'].includes(status);
  const [pickedRoot, pickedQuality] = keyChoice === 'plan' ? [plan.root, plan.quality] : keyChoice.split(':') as [NoteName, KeyQuality];
  const planChoice = useMemo<PlanChoice>(() => ({ box: plan.box, quality: pickedQuality, ear: plan.ear, track: plan.track }), [plan, pickedQuality]);
  const choice = session ? choiceOf(session) : planChoice;
  const quality = choice.quality;
  const sessionRoot = session?.root ?? pickedRoot;
  const sessionTempo = session?.bpm ?? tempo;
  const rootLabel = name(sessionRoot, quality);
  const keySpelling = useMemo(() => getKeySpellingMap(sessionRoot, quality, notation), [sessionRoot, quality, notation]);
  const spell = (note: NoteName) => keySpelling.get(note) ?? formatNoteDisplay(note, notation);
  const keyLabel = `${rootLabel} ${quality}`;
  const rootPc = noteToSemitone(sessionRoot);
  const region = useMemo(() => boxRegion(sessionRoot, quality, choice.box), [sessionRoot, quality, choice.box]);
  const earIntervals = useMemo(() => choice.ear.map(semitones => ({ semitones, ...EAR_NAMES[semitones] })), [choice.ear]);
  const scaleRun = useMemo(() => {
    const ascending = orderScalePositions(region.positions, sessionRoot, 'ascending');
    return [...ascending, ...ascending.slice(1, -1).reverse()];
  }, [region, sessionRoot]);
  const roots = useMemo(() => region.positions.filter(p => [0, 7].includes((noteToSemitone(p.note) - rootPc + 12) % 12)), [region, rootPc]);
  // One window for the whole Changes block: each chord's tones inside the day's box.
  const chords = useMemo(() => changesChords(sessionRoot, quality, region), [sessionRoot, quality, region]);
  const pattern = useMemo(() => {
    if (blockIndex === 0) return sequencePattern(orderScalePositions(roots, sessionRoot, 'ascending'), 2);
    if (blockIndex === 1) return sequencePattern(scaleRun, 0.5);
    if (blockIndex === 2) return { events: [], beats: 4 };
    return chordPattern(chords.map(chord => chord.grip), 4);
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
    else dispatch({ type: 'start', root: sessionRoot, bpm: tempo, id: crypto.randomUUID(), now: new Date().toISOString(), plan: choice });
  };
  const asked = earIntervals[question];
  const hear = () => audio.hearInterval(48 + rootPc, asked.semitones);
  const choose = (semitones: number) => {
    if (answered.current || status !== 'running') return;
    answered.current = true;
    setAnswer(semitones);
    dispatch({ type: 'answer', attempt: { interval: asked.semitones, answer: semitones, correct: asked.semitones === semitones } });
  };
  const nextQuestion = () => {
    // A free draw, so the last answer says nothing about this one; at most two of the same in a row.
    let next = Math.floor(Math.random() * EAR_SET_SIZE);
    if (next === question && sameInARow.current >= 2) next = (question + 1 + Math.floor(Math.random() * (EAR_SET_SIZE - 1))) % EAR_SET_SIZE;
    sameInARow.current = next === question ? sameInARow.current + 1 : 1;
    setQuestion(next); setAnswer(null); answered.current = false;
    audio.hearInterval(48 + rootPc, earIntervals[next].semitones);
  };
  const elapsed = session?.elapsed.reduce((sum, seconds) => sum + seconds, 0) ?? 0;
  const correct = session?.attempts.filter(attempt => attempt.correct).length ?? 0;
  const attempts = session?.attempts.length ?? 0;
  const currentChord = chords[chordIndex];
  const boardPositions = blockIndex === 0 ? roots : blockIndex === 3 ? currentChord.tones : region.positions;
  const boardEnd = Math.max(region.endFret, region.startFret + 4);
  // Under the chord tones, the rest of the box, dimmed: the scale the chord sits in.
  const boxGhost = useMemo(() => {
    const tones = new Set(currentChord.tones.map(p => `${p.string}:${p.fret}`));
    return [{ positions: region.positions.filter(p => !tones.has(`${p.string}:${p.fret}`)), tier: 'near' as const }];
  }, [currentChord, region]);
  const boxName = choice.box ? `box ${choice.box}` : 'the lowest box';
  const boxTag = choice.box ? ` · BOX ${choice.box}` : '';
  const fretsText = region.startFret === 0 ? `open to fret ${region.endFret}` : `frets ${region.startFret}–${region.endFret}`;
  const numerals = chords.map(chord => chord.numeral).join('–');
  // What each block holds today, for the plan's cards.
  const todayDoes = [
    `Find ${rootLabel} and its 5th in ${boxName}, ${fretsText}.`,
    `Run ${boxName} of the ${quality} pentatonic up and down in eighth notes, in time.`,
    `Hear the ${earShorts(choice.ear, 'or')} above the root and name it.`,
    `Play over ${numerals} without leaving the box, landing on each new chord.`,
  ];
  const instructions = [
    `Play each highlighted ${rootLabel} root, then its fifth. Say the note names aloud. Let each note ring for two beats.`,
    'Follow the loop up and down the shape. Keep your pick motion small and even. One note per eighth note; relaxed hands before speed.',
    'Listen to the two notes, then name their distance. Each question counts your first answer. Replay as often as you need.',
    `One bar per chord, and the hand stays in the box. Play each chord’s root on beat one, then improvise with its tones; the dim dots are the scale. On the V, aim for its 3rd (${spellOffsetFromKey(sessionRoot, quality, 11, notation) ?? spell(semitoneToNote(rootPc + 11))}), a half step below the root. The pentatonic lacks it.`,
  ];

  const soundSettings = (withGuitar = true) => <div className={styles.soundSettings}>
    {withGuitar && <label>Guitar<select aria-label="Practice guitar sound" disabled={active} value={audio.instrument} onChange={e => audio.setInstrument(e.target.value as GuitarInstrumentName)}>{GUITAR_INSTRUMENTS.map(instrument => <option key={instrument.name} value={instrument.name}>{instrument.label}</option>)}</select></label>}
    <label>Volume<input aria-label="Practice volume" type="range" min="0" max="1" step="0.01" value={audio.volume} onChange={e => audio.setVolume(Number(e.target.value))} /></label>
    <label>Room<input aria-label="Room ambience" type="range" min="0" max="0.5" step="0.01" value={audio.room} onChange={e => audio.setRoom(Number(e.target.value))} /></label>
    <button type="button" className={styles.quietButton} aria-pressed={audio.muted} onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? 'Unmute' : 'Mute'}</button>
  </div>;

  // Alerts sit over the neck so they never move the layout.
  const notices = (storageError || audio.error) ? <div className={styles.notices}>
    {storageError && <p role="alert" className={styles.notice}>Your browser couldn’t save this practice. Keep this tab open; results may be lost when you close it.</p>}
    {audio.error && <p role="alert" className={styles.notice}>{audio.error} <button onClick={() => audio.setInstrument(audio.instrument)}>Retry sound</button></p>}
  </div> : null;

  const historySection = <section className={styles.history} aria-label="Practice history">
    <div className={styles.historyTitle}><h2>Your recent practice</h2><span>Saved on this device</span></div>
    {history.length === 0 ? <p className={styles.historyEmpty}>Finished sessions are listed here.</p> : history.slice(0, 5).map(item => <div className={styles.historyRow} key={item.id}><span>{new Date(item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><strong>{name(item.root, choiceOf(item).quality)} {choiceOf(item).quality}</strong><span>{formatTime(item.elapsed.reduce((sum, n) => sum + n, 0))}</span><span>{item.completed ? 'Complete' : 'Short session'}</span></div>)}
  </section>;

  const soundSection = <section className={styles.sideSection} aria-label="Practice sound">
    <h2 className={styles.sideTitle}>Sound</h2>
    {soundSettings()}
  </section>;

  if (status === 'ready') return <>
    <Neck className={styles.practice}>
      <div className={styles.landing} data-status={status}>
        <header className={styles.welcome}>
          <p className={styles.eyebrow}>YOUR DAILY PRACTICE · {SESSION_SECONDS / 60} MINUTES · {PRACTICE_BLOCKS.length} BLOCKS</p>
          <h1>Ten minutes in {keyLabel}</h1>
          <p className={styles.today}>{plan.line}</p>
        </header>
        <ol className={styles.plan} aria-label="Today’s practice plan">{PRACTICE_BLOCKS.map((item, index) => <li className={styles.planBlock} key={item.id} style={{ flexGrow: item.seconds }}><div className={styles.planTop}><span>0{index + 1}</span><span>{item.seconds / 60} MIN</span></div><h2>{item.title}</h2><p className={styles.planDoes}>{todayDoes[index]}</p><p className={styles.planWhy}>{item.why}</p></li>)}</ol>
      </div>
      {notices}
    </Neck>
    <Deck className={styles.practice} label="Start your practice">
      <div className={styles.startBar}><div className={styles.setup}>
        <label>KEY<select aria-label="Practice key" value={keyChoice} onChange={e => setKeyChoice(e.target.value)}><option value="plan">{name(plan.root, plan.quality)} {plan.quality} · today’s plan</option>{(['minor', 'major'] as const).map(q => <optgroup key={q} label={q === 'minor' ? 'Minor' : 'Major'}>{ALL_NOTES.map(note => <option key={note} value={`${note}:${q}`}>{name(note, q)} {q}</option>)}</optgroup>)}</select></label>
        <label>TEMPO<select aria-label="Practice tempo" value={tempo} onChange={e => setTempo(Number(e.target.value))}>{[48, 60, 72, 84, 96, 108].map(bpm => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label>
        <label>GUITAR<select aria-label="Practice guitar sound" value={audio.instrument} onChange={e => audio.setInstrument(e.target.value as GuitarInstrumentName)}>{GUITAR_INSTRUMENTS.map(instrument => <option key={instrument.name} value={instrument.name}>{instrument.label}</option>)}</select></label>
      </div><button className={styles.primary} onClick={start}>Start my practice <span aria-hidden="true">↗</span></button></div>
      <p className={styles.footnote}>Four beats to get ready. Pause whenever you need. Your place is saved on this device.</p>
      <DeckRow end className={styles.deckEnd}>{soundSettings(false)}</DeckRow>
    </Deck>
    <SidePanel className={styles.practice} label="Practice history">{historySection}</SidePanel>
  </>;

  if (status === 'finished' && session) return <>
    <Neck className={styles.practice}>
      <div className={styles.result}>
        <p className={styles.eyebrow}>{session.completed ? 'TEN MINUTES WELL SPENT' : 'EVERY MINUTE COUNTS'}</p>
        <h1>{storageError ? 'Practice finished.' : 'Practice, saved.'}</h1><p className={styles.intro}>{keyLabel} · {session.bpm} BPM · {session.completed ? 'Full session' : 'Short session'}</p>
        <div className={styles.stats}><div><strong>{formatTime(elapsed)}</strong><span>time practiced</span></div><div><strong>{attempts ? `${correct}/${attempts}` : '—'}</strong><span>intervals correct</span></div><div><strong>{Object.values(session.ratings).filter(r => r === 'clean').length}</strong><span>blocks felt clean</span></div></div>
        <p className={styles.resultTip}>{nextPlan.preview}</p>
      </div>
      {notices}
    </Neck>
    <Deck className={styles.practice} label="Practice saved">
      <DeckRow><button className={styles.primary} onClick={() => { dispatch({ type: 'reset' }); setAnswer(null); answered.current = false; }}>Back to my practice <span aria-hidden="true">↗</span></button></DeckRow>
      <DeckRow end className={styles.deckEnd}>{soundSettings()}</DeckRow>
    </Deck>
    <SidePanel className={styles.practice} label="Practice history">{historySection}</SidePanel>
  </>;

  if (!session) return null;

  return <>
    <Neck className={styles.practice} bar={<p className={styles.instruction}>{instructions[blockIndex]}</p>}>
      {blockIndex === 2 ? <div className={styles.earCard}>
        <p className={styles.eyebrow}>LISTEN FIRST. TRUST YOUR EAR.</p><h2>{answer === null ? 'What interval do you hear?' : answer === asked.semitones ? 'You’ve got it.' : `That was a ${asked.name.toLowerCase()}.`}</h2>
        <button className={styles.listen} onClick={hear} disabled={status !== 'running' || audio.muted}>♫ {answer === null ? 'Listen / replay' : 'Hear it again'}</button>
        <div className={styles.answers}>{earIntervals.map(interval => <button key={interval.semitones} disabled={status !== 'running' || answer !== null} className={answer !== null && interval.semitones === asked.semitones ? styles.correctAnswer : ''} onClick={() => choose(interval.semitones)}><strong>{interval.short}</strong>{interval.name}</button>)}</div>
        <div className={styles.earFooter}><span>{correct} / {attempts} correct · first answers</span><button disabled={answer === null || status !== 'running'} className={styles.quietButton} onClick={nextQuestion}>Next interval →</button></div>
      </div> : <>
        <Fretboard fill fretRange={[region.startFret, boardEnd]} positions={boardPositions} title={`${rootLabel} ${block.short} practice`} notation={notation} noteColors={NOTE_COLORS} rootNote={blockIndex === 3 ? currentChord.root : sessionRoot} intervalLabeling={{ root: blockIndex === 3 ? currentChord.root : sessionRoot, style: 'function' }} showNoteLabels fullDotOpacity onPlayNote={audio.muted ? undefined : audio.playPosition} activePosition={blockIndex === 3 ? null : audio.playingPosition} ghostLayers={blockIndex === 3 ? boxGhost : undefined} />
        <div className={styles.boardCaption}><span>{blockIndex === 0 ? 'ROOT + FIFTH' : blockIndex === 1 ? `${quality.toUpperCase()} PENTATONIC` : 'CHORD TONES'}{boxTag}</span><span>Frets {region.startFret === 0 ? 'open' : region.startFret}–{boardEnd} · tap a note to hear it</span></div>
      </>}
      {notices}
    </Neck>
    <Deck className={styles.practice} label="Practice block">
      <header className={styles.stageHeader}>
        <div><p className={styles.eyebrow}>{rootLabel} {quality.toUpperCase()} · BLOCK {blockIndex + 1} OF 4</p><h1>{block.title}</h1></div>
        {blockIndex === 3 && <div className={styles.chordStrip}>{chords.map((chord, index) => <div key={chord.numeral} className={index === chordIndex ? styles.activeChord : ''}><small>{chord.numeral} · 4 BEATS</small><strong>{spell(chord.root)}{chord.quality === 'minor' ? 'm' : ''}</strong></div>)}</div>}
        <div className={styles.timer}><strong>{formatTime(block.seconds - session.elapsed[blockIndex])}</strong><span>left in this block</span></div>
      </header>
      <div className={styles.transport}>
        {status === 'review' ? <button className={styles.primary} onClick={blockIndex === 3 ? finish : () => { setChordIndex(0); setCycle(0); dispatch({ type: 'next' }); }}>{blockIndex === 3 ? 'Save my session' : `Next: ${PRACTICE_BLOCKS[blockIndex + 1].short}`} <span aria-hidden="true">↗</span></button> : <button className={styles.primary} onClick={active ? () => dispatch({ type: 'pause' }) : start}>{status === 'loading' ? 'Cancel loading' : active ? 'Pause practice' : 'Resume practice'}</button>}
        <div className={styles.beatStatus} role="status">{status === 'loading' ? 'Getting your guitar ready…' : status === 'counting' ? `Count in · ${beat + 1} / 4` : status === 'review' ? 'Block complete. Take a breath.' : status === 'paused' ? 'Paused · your place is saved' : `${liveTempo} BPM${blockIndex === 2 ? ' · listen & answer' : ` · loop ${cycle + 1}`}`}</div>
        <div className={styles.beats} aria-hidden="true">{[0, 1, 2, 3].map(n => <i key={n} className={active && beat === n ? styles.litBeat : ''} />)}</div>
        <div className={styles.endRow}><span className={styles.spaceHint}>Space to pause / resume</span>{ending ? <><span>Save what you’ve practiced and finish early?</span><button className={styles.quietButton} onClick={finish}>Save & finish</button><button className={styles.quietButton} onClick={() => setEnding(false)}>Keep practicing</button></> : <button className={styles.textButton} onClick={() => { dispatch({ type: 'pause' }); setEnding(true); }}>Finish early</button>}</div>
      </div>
      <div className={styles.reflection}><span>How does it feel?</span>{RATINGS.map(rating => <button key={rating.id} aria-pressed={session.ratings[blockIndex] === rating.id} onClick={() => dispatch({ type: 'rate', rating: rating.id })}>{rating.label}</button>)}<small>Your assessment of your playing.</small></div>
    </Deck>
    <SidePanel className={styles.practice} label="This session">
      <section className={styles.sideSection} aria-label="Session blocks">
        <h2 className={styles.sideTitle}>This session</h2>
        <nav className={styles.steps} aria-label="Session blocks">{PRACTICE_BLOCKS.map((item, index) => <div key={item.id} className={index === blockIndex ? styles.currentStep : styles.step} aria-current={index === blockIndex ? 'step' : undefined}><span>{session.elapsed[index] >= item.seconds ? '✓' : `0${index + 1}`}</span>{item.short}<small>{item.seconds / 60}m</small></div>)}</nav>
        <div className={styles.sessionProgress} role="progressbar" aria-label="Practice progress" aria-valuenow={Math.floor(elapsed)} aria-valuemin={0} aria-valuemax={SESSION_SECONDS}><span style={{ width: `${elapsed / SESSION_SECONDS * 100}%` }} /></div>
      </section>
      <section className={styles.sideSection} aria-label="Practice options">
        <h2 className={styles.sideTitle}>Options</h2>
        <div className={styles.practiceOptions}><label><input type="checkbox" checked={metronome} disabled={active} onChange={e => setMetronome(e.target.checked)} /> Metronome</label><label><input type="checkbox" checked={ramp} disabled={active} onChange={e => setRamp(e.target.checked)} /> Scale: +4 BPM every 4 loops, up to 120</label></div>
      </section>
      {soundSection}
    </SidePanel>
  </>;
}
