import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { NoteName } from '../types/music';
import type { UseInstrument } from '../hooks/useInstrument';
import { ALL_NOTES, NOTE_COLORS } from '../lib/colors';
import { noteToSemitone, semitoneToNote, formatNoteDisplay, formatSpelled, getKeySpellingMap, getSpelledScaleNotes, spelledRootFromNoteName, type NotationPreference } from '../lib/music';
import { spellOffsetFromKey } from '../lib/music/noteSpelling';
import { orderScalePositions } from '../lib/audio/pitch';
import { GUITAR_INSTRUMENTS, type GuitarInstrumentName } from '../lib/audio/instruments';
import { barsBeat, barsPattern, sequencePattern } from '../lib/audio/pattern';
import { sessionReducer, type SessionState } from '../lib/practice/reducer';
import { DEFAULT_BARS, barsLabel, boxFingers, boxRegion, changesChords, nextBars, validBars } from '../lib/practice/board';
import { EAR_NAMES, EAR_SET_SIZE, EAR_TOP, addDays, choiceOf, drawEar, earPool, earRound, earShorts, earWeights, localDay, pickedLine, planFor, stepKey, type KeyQuality, type PlanChoice } from '../lib/practice/plan';
import { BLOCK_LENGTH_CHOICES, DEFAULT_SECONDS, DRAFT_KEY, EAR_BLOCK, EAR_ROUND, HISTORY_KEY, PRACTICE_BLOCKS, blockDone, blockSeconds, dropHistory, earByCount, formatTime, loadDraft, loadHistory, saveHistory, finishSession, validSeconds, type Rating } from '../lib/practice/session';
import { isNumber, oneOf, usePersistentState } from '../hooks/usePersistentState';
import { Fretboard } from './Fretboard';
import { Deck, DeckRow, Neck, SidePanel } from './Frame';
import styles from './PracticeSession.module.css';

/**
 * `root` and `keyMode` are the app's key, and Practice plays in it: the plan
 * only suggests a key. Changing the key here (`onKeyChange`) changes it for
 * every mode.
 */
interface Props {
  root: NoteName; keyMode: KeyQuality; notation: NotationPreference; audio: UseInstrument;
  onKeyChange: (root: NoteName, quality: KeyQuality) => void;
}
const RATINGS: { id: Rating; label: string }[] = [{ id: 'clean', label: 'Felt clean' }, { id: 'working', label: 'Getting there' }, { id: 'revisit', label: 'Revisit this' }];
function initialState(): SessionState {
  const data = loadDraft();
  return { data, status: data ? (blockDone(data, data.block) ? 'review' : 'paused') : 'ready' };
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
/** The Ear block's ladder stages offered as a place to start: five, seven or all nine intervals. */
const EAR_STARTS = [2, 4, EAR_TOP];
const wordFor = (n: number) => NUMBER_WORDS[n] ?? String(n);
/** What a dot on the practice board says: its interval, its note, or the finger that plays it. */
const LABEL_MODES = ['intervals', 'notes', 'fingers'] as const;
type LabelMode = (typeof LABEL_MODES)[number];
/** Scrolling over the plan's key steps through the keys: at most one this often, however long the swipe. */
const KEY_STEP_MS = 150;
/** A pause this long in the wheel's movement makes the next one a fresh movement: one wheel click, or a new swipe. */
const KEY_STEP_GAP_MS = 120;
/** A wheel movement smaller than this does not carry a swipe on: it is the tail of one that was let go. */
const KEY_STEP_MIN = 4;
/** How long an answer stays up before the next question: longer when it was wrong, to read the right one. */
const EAR_PAUSE_MS = { right: 1100, wrong: 2200 };
/** Roots and Scale: the app plays the notes once and again when asked, every time round, or not at all. */
const GUIDE_MODES = ['once', 'loop', 'off'] as const;
type GuideMode = (typeof GUIDE_MODES)[number];

export function PracticeSession({ root, keyMode, notation, audio, onKeyChange }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialState);
  const [history, setHistory] = useState(loadHistory);
  const [tempo, setTempo] = useState(72);
  const [metronome, setMetronome] = useState(true);
  const [ramp, setRamp] = useState(false);
  const [beat, setBeat] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [liveTempo, setLiveTempo] = useState(72);
  const [chordIndex, setChordIndex] = useState(0);
  /** How many bars each chord of the Changes block lasts: the player's to set, and remembered. */
  const [bars, setBars] = usePersistentState<number[]>('practice-changes-bars', DEFAULT_BARS, validBars);
  /** How long each block on the clock lasts, set on the plan before Start. The Ear block is a round of questions. */
  const [lengths, setLengths] = usePersistentState<number[]>('practice-block-seconds', DEFAULT_SECONDS, validSeconds);
  /** Where the player asked the ear ladder to start: 0 leaves it to the plan. Five intervals unless changed. */
  const [earStart, setEarStart] = usePersistentState<number>('practice-ear-level', 2, isNumber);
  const [guide, setGuide] = usePersistentState<GuideMode>('practice-guide', 'once', oneOf(GUIDE_MODES));
  /** Playing once: the key the notes have been played through in. Null, or another key than now, and they are still owed. */
  const heardRef = useRef<string | null>(null);
  /** The same, for the screen. */
  const [heardKey, setHeardKey] = useState<string | null>(null);
  /** Raised to start the loop again from a count-in ("Hear it again"). */
  const [take, setTake] = useState(0);
  /** The loop count that a "Hear it again" start carries on from. */
  const carriedCycle = useRef(0);
  const [labels, setLabels] = usePersistentState<LabelMode>('practice-dot-labels', 'intervals', oneOf(LABEL_MODES));
  const [question, setQuestion] = useState(() => Math.floor(Math.random() * EAR_SET_SIZE));
  const [answer, setAnswer] = useState<number | null>(null);
  const answered = useRef(false);
  /** How many questions in a row have asked the current interval. */
  const sameInARow = useRef(1);
  /** The rest of the round's questions, dealt when the Ear block starts. */
  const dealt = useRef<number[]>([]);
  // Today's plan: the box, the key and the ear set, from the days before today.
  const [today] = useState(() => localDay(new Date()));
  // A key's root by the name that needs fewer accidentals: B♭ major, not A# major.
  const name = useCallback((note: NoteName, q: KeyQuality) => formatSpelled(getSpelledScaleNotes(spelledRootFromNoteName(note, notation), q)[0]), [notation]);
  /** The plan before the player's own ear start, to say what the plan alone would ask. */
  const ownStage = useMemo(() => planFor(today, history, name).track.stage, [today, history, name]);
  const plan = useMemo(() => planFor(today, history, name, earStart), [today, history, name, earStart]);
  const nextPlan = useMemo(() => planFor(addDays(today, 1), history, name, earStart), [today, history, name, earStart]);
  const [storageError, setStorageError] = useState(false);
  const { data: session, status } = state;
  const blockIndex = session?.block ?? 0;
  const block = PRACTICE_BLOCKS[blockIndex];
  const active = ['loading', 'counting', 'running'].includes(status);
  // One key for the whole app. A session under way follows it; a finished one keeps the key it was logged in.
  const closed = status === 'finished' && session !== null;
  const sessionRoot = closed ? session.root : root;
  const quality = closed ? choiceOf(session).quality : keyMode;
  const keyId = `${sessionRoot}:${quality}`;
  const onPlanKey = root === plan.root && keyMode === plan.quality;
  useEffect(() => {
    if (session && status !== 'finished' && (session.root !== root || choiceOf(session).quality !== keyMode)) dispatch({ type: 'rekey', root, quality: keyMode });
  }, [session, status, root, keyMode]);
  // Over the key in the headline, the wheel or a two-finger swipe steps through the keys.
  const [keyEl, setKeyEl] = useState<HTMLSpanElement | null>(null);
  const turnKey = useRef((by: number) => { void by; });
  useEffect(() => {
    turnKey.current = by => {
      onKeyChange(...stepKey(root, keyMode, by));
    };
  });
  useEffect(() => {
    if (!keyEl) return undefined;
    let lastEvent = 0;
    let lastStep = 0;
    const wheel = (event: WheelEvent) => {
      // Not a pinch, and nothing else on the page should move.
      if (event.ctrlKey) return;
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const fresh = event.timeStamp - lastEvent > KEY_STEP_GAP_MS;
      lastEvent = event.timeStamp;
      if (delta === 0) return;
      // A fresh movement steps at once; one that carries on steps at a steady rate while it still has some push.
      if (!fresh && (event.timeStamp - lastStep < KEY_STEP_MS || Math.abs(delta) < KEY_STEP_MIN)) return;
      lastStep = event.timeStamp;
      turnKey.current(delta > 0 ? 1 : -1);
    };
    keyEl.addEventListener('wheel', wheel, { passive: false });
    return () => keyEl.removeEventListener('wheel', wheel);
  }, [keyEl]);
  const choice = useMemo<PlanChoice>(() => ({ ...(session ? choiceOf(session) : { box: plan.box, ear: plan.ear, track: plan.track }), quality }), [session, plan, quality]);
  const sessionTempo = session?.bpm ?? tempo;
  const rootLabel = name(sessionRoot, quality);
  const keySpelling = useMemo(() => getKeySpellingMap(sessionRoot, quality, notation), [sessionRoot, quality, notation]);
  const spell = (note: NoteName) => keySpelling.get(note) ?? formatNoteDisplay(note, notation);
  const keyLabel = `${rootLabel} ${quality}`;
  const planKeyLabel = `${name(plan.root, plan.quality)} ${plan.quality}`;
  const rootPc = noteToSemitone(sessionRoot);
  const region = useMemo(() => boxRegion(sessionRoot, quality, choice.box), [sessionRoot, quality, choice.box]);
  // The round asks every unlocked interval, the day's three twice as often.
  const earIntervals = useMemo(() => earPool(choice.track.stage).map(semitones => ({ semitones, ...EAR_NAMES[semitones] })), [choice.track.stage]);
  const weights = useMemo(() => earWeights(earIntervals.map(interval => interval.semitones), choice.ear), [earIntervals, choice.ear]);
  const scaleRun = useMemo(() => {
    const ascending = orderScalePositions(region.positions, sessionRoot, 'ascending');
    return [...ascending, ...ascending.slice(1, -1).reverse()];
  }, [region, sessionRoot]);
  const roots = useMemo(() => region.positions.filter(p => [0, 7].includes((noteToSemitone(p.note) - rootPc + 12) % 12)), [region, rootPc]);
  // One window for the whole Changes block: each chord's tones inside the day's box.
  const chords = useMemo(() => changesChords(sessionRoot, quality, region), [sessionRoot, quality, region]);
  const grips = useMemo(() => chords.map(chord => chord.grip), [chords]);
  /** The block's loop. The chords' lengths are read when it starts; a change while it plays is swapped in (see `cycleBars`). */
  const pattern = useMemo(() => {
    if (blockIndex === 0) return sequencePattern(orderScalePositions(roots, sessionRoot, 'ascending'), 2);
    if (blockIndex === 1) return sequencePattern(scaleRun, 0.5);
    if (blockIndex === 2) return { events: [], beats: 4 };
    return null;
  }, [blockIndex, roots, scaleRun, sessionRoot]);
  const barsNow = useRef(bars);
  useEffect(() => { barsNow.current = bars; });
  /** Roots and Scale are the blocks where the app plays the player's own notes. */
  const guided = blockIndex < 2;
  /** What the app does with the notes in this block; the other blocks always sound. */
  const guideHere: GuideMode = guided ? guide : 'loop';
  const playPattern = audio.playPattern;
  const swapPattern = audio.swapPattern;
  const stopAll = audio.stopAll;

  // One transport owns the count-in, notes, metronome, and visual beat cues.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const startCycle = carriedCycle.current;
    carriedCycle.current = 0;
    // Without the app's notes the loop still keeps the count, the click and the tempo ramp.
    const voicedPasses = guideHere === 'loop' ? undefined : guideHere === 'once' && heardRef.current !== keyId ? 1 : 0;
    void playPattern(pattern ?? barsPattern(grips, barsNow.current), {
      // Interval training is flashcards: nothing to count in to.
      bpm: sessionTempo, countIn: blockIndex === EAR_BLOCK ? 0 : 4, loop: true, startCycle, voicedPasses,
      metronome: blockIndex !== 2 && metronome,
      ramp: blockIndex === 1 && ramp,
      onBeat: (current, counting, currentCycle, bpm) => {
        setBeat(current % 4); setCycle(currentCycle); setLiveTempo(bpm);
        if (counting) return;
        dispatch({ type: 'running' });
        // Once round with the notes: from here the player has the loop to themselves.
        if (guided && currentCycle > startCycle) { heardRef.current = keyId; setHeardKey(keyId); }
      },
      onEvent: event => { if (blockIndex === 3) setChordIndex(event.index); },
    }).then(success => {
      if (!cancelled) dispatch({ type: success ? 'counting' : 'pause' });
    });
    return () => { cancelled = true; stopAll(); };
  }, [active, blockIndex, pattern, grips, guided, guideHere, keyId, take, playPattern, stopAll, sessionTempo, metronome, ramp]);

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
  };
  const last = blockIndex === PRACTICE_BLOCKS.length - 1;
  /** Playing a block again after it was played through: it runs until the player moves on. */
  const again = state.open === true;
  const nextShort = last ? '' : PRACTICE_BLOCKS[blockIndex + 1].short;
  const restartLoop = () => { setChordIndex(0); setCycle(0); heardRef.current = null; setHeardKey(null); };
  /** Playing once, and the notes have been played: the main button offers them again. */
  const canHearAgain = guideHere === 'once' && status === 'running' && heardKey === keyId;
  /** The notes once more, from a count-in. The loop count and the ramp carry on. */
  const hearAgain = () => { heardRef.current = null; setHeardKey(null); carriedCycle.current = cycle; setTake(n => n + 1); dispatch({ type: 'recount' }); };
  /** On to the next block: from the rest after a block, or straight out of one. */
  const goNext = () => { restartLoop(); if (blockIndex + 1 === EAR_BLOCK) freshQuestion(); dispatch({ type: status === 'review' ? 'next' : 'skip' }); };
  const playAgain = () => { restartLoop(); if (blockIndex === EAR_BLOCK) freshQuestion(); dispatch({ type: 'again' }); };
  /** A block's length on the plan goes 1, 2, 3, 5 minutes and round again. */
  const cycleLength = (index: number) => setLengths(current => current.map((seconds, i) => (i === index
    ? BLOCK_LENGTH_CHOICES[(BLOCK_LENGTH_CHOICES.indexOf(seconds) + 1) % BLOCK_LENGTH_CHOICES.length] : seconds)));
  const earCount = earIntervals.length;
  /** Take the ended session back out of the log. */
  const unlog = () => {
    if (!session) return;
    const kept = dropHistory(loadHistory(), session.id);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(kept)); } catch { setStorageError(true); }
    setHistory(kept);
  };
  const backToPlan = () => { dispatch({ type: 'reset' }); setAnswer(null); answered.current = false; };
  /** The summary's way out with nothing logged, so a trial run does not move the plan on. */
  const discard = () => { unlog(); backToPlan(); };
  /** The summary's way back into a session that was ended before its last block. */
  const keepPracticing = () => { unlog(); dispatch({ type: 'reopen' }); };
  const changeGuide = (mode: GuideMode) => { setGuide(mode); heardRef.current = null; setHeardKey(null); if (guided) dispatch({ type: 'recount' }); };
  /**
   * A chord's length goes 1, 2, 4 bars and round again. While playing, the loop
   * takes the change up where it is: no stop and no count-in.
   */
  const cycleBars = (index: number) => {
    const next = bars.map((count, i) => (i === index ? nextBars(count) : count));
    setBars(next);
    if (blockIndex === 3) swapPattern(barsPattern(grips, next), at => barsBeat(at, bars, next));
  };
  const start = () => {
    if (session) { dispatch({ type: 'resume' }); return; }
    restartLoop();
    dispatch({ type: 'start', root: sessionRoot, bpm: tempo, id: crypto.randomUUID(), now: new Date().toISOString(), plan: choice, lengths: { seconds: lengths, earGoal: EAR_ROUND } });
  };
  const asked = earIntervals[question] ?? earIntervals[0];
  const hear = () => audio.hearInterval(48 + rootPc, asked.semitones);
  const choose = (semitones: number) => {
    if (answered.current || status !== 'running') return;
    answered.current = true;
    setAnswer(semitones);
    dispatch({ type: 'answer', attempt: { interval: asked.semitones, answer: semitones, correct: asked.semitones === semitones } });
  };
  const nextQuestion = () => {
    const next = dealt.current.shift() ?? drawEar(weights, question, sameInARow.current);
    sameInARow.current = next === question ? sameInARow.current + 1 : 1;
    setQuestion(next); setAnswer(null); answered.current = false;
    audio.hearInterval(48 + rootPc, earIntervals[next].semitones);
  };
  // An answer stays up for a beat, then the next question plays by itself.
  const advance = useRef(nextQuestion);
  useEffect(() => { advance.current = nextQuestion; });
  const answeredRight = answer !== null && answer === asked.semitones;
  useEffect(() => {
    if (answer === null || status !== 'running' || blockIndex !== EAR_BLOCK) return undefined;
    const timer = window.setTimeout(() => advance.current(), answeredRight ? EAR_PAUSE_MS.right : EAR_PAUSE_MS.wrong);
    return () => window.clearTimeout(timer);
  }, [answer, answeredRight, status, blockIndex]);
  /** A new first question, for a block that is starting (or starting over). Not played until asked for. */
  const freshQuestion = () => {
    const [first, ...rest] = earRound(weights, session?.earGoal ?? EAR_ROUND);
    dealt.current = rest;
    sameInARow.current = 1; setQuestion(first ?? 0); setAnswer(null); answered.current = false;
  };
  const elapsed = session?.elapsed.reduce((sum, seconds) => sum + seconds, 0) ?? 0;
  /** The Ear block as a round of questions (not a draft from when it ran on the clock). */
  const byCount = session ? earByCount(session, blockIndex) : false;
  const length = session ? blockSeconds(session, blockIndex) : block.seconds;
  const bonus = state.bonus ?? 0;
  const earGoal = session?.earGoal ?? EAR_ROUND;
  /** How far through the session: each block is a quarter, by its time or its questions. */
  const progress = session ? PRACTICE_BLOCKS.reduce((sum, _, index) => sum + Math.min(1, earByCount(session, index)
    ? session.attempts.length / earGoal : session.elapsed[index] / blockSeconds(session, index)), 0) / PRACTICE_BLOCKS.length : 0;
  const correct = session?.attempts.filter(attempt => attempt.correct).length ?? 0;
  const attempts = session?.attempts.length ?? 0;
  const currentChord = chords[chordIndex];
  const boardPositions = blockIndex === 0 ? roots : blockIndex === 3 ? currentChord.tones : region.positions;
  const boardEnd = Math.max(region.endFret, region.startFret + 4);
  const fingers = useMemo(() => boxFingers(region), [region]);
  const shownPositions = useMemo(() => boardPositions.map(p => ({ ...p, finger: fingers.get(`${p.string}:${p.fret}`) })), [boardPositions, fingers]);
  const fifthLabel = spell(semitoneToNote(rootPc + 7));
  const inFrets = region.startFret === 0 ? `from the open strings to fret ${region.endFret}` : `between frets ${region.startFret} and ${region.endFret}`;
  // Under the chord tones, the rest of the box, dimmed: the scale the chord sits in.
  const boxGhost = useMemo(() => {
    const tones = new Set(currentChord.tones.map(p => `${p.string}:${p.fret}`));
    return [{ positions: region.positions.filter(p => !tones.has(`${p.string}:${p.fret}`)), tier: 'near' as const }];
  }, [currentChord, region]);
  const boxName = choice.box ? `box ${choice.box}` : 'the lowest box';
  const boxTag = choice.box ? ` · BOX ${choice.box}` : '';
  const numerals = chords.map(chord => chord.numeral).join('–');
  // What each block holds today, for the plan's cards.
  const todayDoes = [
    `Find the root (${rootLabel}) and its fifth (${fifthLabel}) ${inFrets}.`,
    `Run ${boxName} of the ${quality} pentatonic up and down in eighth notes, in time.`,
    earCount > EAR_SET_SIZE
      ? `${wordFor(EAR_ROUND)} questions on ${earCount} intervals above the root, most often ${earShorts(choice.ear, 'and')}.`
      : `${wordFor(EAR_ROUND)} questions: hear the ${earShorts(choice.ear, 'or')} above the root and name it.`,
    `Improvise over ${numerals} while the app plays it, landing on each new chord.`,
  ];
  const instructions = [
    `Play each highlighted ${rootLabel} root, then its fifth. Say the note names aloud. Let each note ring for two beats.`,
    'Play the shape up and down, in time. Keep your pick motion small and even. One note per eighth note; relaxed hands before speed.',
    `${byCount ? `${wordFor(earGoal)} questions. ` : ''}Listen to the two notes, then name their distance. Only your first answer counts; replay as often as you need. The next one plays by itself.`,
    `The app plays the chords. You improvise over them, staying in this box: start each chord on its root (R), then use its bright dots; the dim dots are the rest of the scale. On the V, aim for its 3rd (${spellOffsetFromKey(sessionRoot, quality, 11, notation) ?? spell(semitoneToNote(rootPc + 11))}), a half step below the root. The pentatonic lacks it.`,
  ];

  const soundSettings = <div className={styles.soundSettings}>
    {<label>Guitar<select aria-label="Practice guitar sound" disabled={active} value={audio.instrument} onChange={e => audio.setInstrument(e.target.value as GuitarInstrumentName)}>{GUITAR_INSTRUMENTS.map(instrument => <option key={instrument.name} value={instrument.name}>{instrument.label}</option>)}</select></label>}
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
    {soundSettings}
  </section>;

  if (status === 'ready') return <>
    <Neck className={styles.practice}>
      <div className={styles.landing} data-status={status}>
        <header className={styles.welcome}>
          <h1>Daily practice in <span className={styles.titleKey} ref={setKeyEl}>{keyLabel}<select aria-label="Practice key" title="Click to choose a key, or scroll over it to step through the keys" value={onPlanKey ? 'plan' : `${root}:${keyMode}`} onChange={e => { const [note, q] = e.target.value === 'plan' ? [plan.root, plan.quality] : e.target.value.split(':') as [NoteName, KeyQuality]; onKeyChange(note, q); }}><optgroup label="Today’s plan"><option value="plan">{name(plan.root, plan.quality)} {plan.quality}</option></optgroup>{(['minor', 'major'] as const).map(q => <optgroup key={q} label={q === 'minor' ? 'Minor' : 'Major'}>{ALL_NOTES.map(note => <option key={note} value={`${note}:${q}`}>{name(note, q)} {q}</option>)}</optgroup>)}</select></span></h1>
          <p className={styles.today}>{onPlanKey ? plan.line : <>{pickedLine(plan, keyLabel)} <button type="button" className={styles.useKey} title="Change the key to the one the plan has for this lap" onClick={() => onKeyChange(plan.root, plan.quality)}>Use the plan’s key, {planKeyLabel}</button></>}</p>
        </header>
        <ol className={styles.plan} aria-label="Today’s practice plan">{PRACTICE_BLOCKS.map((item, index) => <li className={styles.planBlock} key={item.id} style={{ flexGrow: item.seconds }}><div className={styles.planTop}><span>0{index + 1}</span>{index === EAR_BLOCK ? <span>{EAR_ROUND} QUESTIONS</span> : <button type="button" aria-label={`${item.short}: ${lengths[index] / 60} minutes. Change its length`} title="Click to change how long this block lasts: 1, 2, 3 or 5 minutes" onClick={() => cycleLength(index)}>{lengths[index] / 60} MIN</button>}</div><h2>{item.title}</h2><p className={styles.planDoes}>{todayDoes[index]}</p><p className={styles.planWhy}>{item.why}</p></li>)}</ol>
      </div>
      {notices}
    </Neck>
    <Deck className={styles.practice} label="Start your practice">
      <div className={styles.startBar}><div className={styles.setup}>
        <label>TEMPO<select aria-label="Practice tempo" value={tempo} onChange={e => setTempo(Number(e.target.value))}>{[48, 60, 72, 84, 96, 108].map(bpm => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label>
        <label>EAR INTERVALS<select aria-label="Ear intervals" title="How many intervals the ear round draws from. The plan adds one each day you score 9 in 10." value={earStart > ownStage ? String(earStart) : 'plan'} onChange={e => setEarStart(e.target.value === 'plan' ? 0 : Number(e.target.value))}><option value="plan">{ownStage + EAR_SET_SIZE} · plan</option>{EAR_STARTS.filter(stage => stage > ownStage).map(stage => <option key={stage} value={stage}>{stage === EAR_TOP ? 'All 9' : stage + EAR_SET_SIZE}</option>)}</select></label>
      </div><button className={styles.primary} onClick={start}>Start my practice <span aria-hidden="true">↗</span></button></div>
      <p className={styles.footnote}>Four beats to get ready. Pause whenever you need. Your place is saved on this device.</p>
    </Deck>
    <SidePanel className={styles.practice} label="Practice history">{historySection}</SidePanel>
  </>;

  if (status === 'finished' && session) return <>
    <Neck className={styles.practice}>
      <div className={styles.result}>
        <p className={styles.eyebrow}>{session.completed ? 'TIME WELL SPENT' : 'EVERY MINUTE COUNTS'}</p>
        <h1>{storageError ? 'Practice finished.' : 'Practice, saved.'}</h1><p className={styles.intro}>{keyLabel} · {session.bpm} BPM · {session.completed ? 'Full session' : 'Short session'}</p>
        <div className={styles.stats}><div><strong>{formatTime(elapsed)}</strong><span>time practiced</span></div><div><strong>{attempts ? `${correct}/${attempts}` : '—'}</strong><span>intervals correct</span></div><div><strong>{Object.values(session.ratings).filter(r => r === 'clean').length}</strong><span>blocks felt clean</span></div></div>
        <p className={styles.resultTip}>{nextPlan.preview}</p>
      </div>
      {notices}
    </Neck>
    <Deck className={`${styles.practice} ${styles.plainDeck}`} label="Practice saved">
      <DeckRow className={styles.resultRow}>
        <button className={styles.primary} onClick={backToPlan}>Back to my practice <span aria-hidden="true">↗</span></button>
        {!session.completed && <button className={styles.quietButton} title="Open this session again where you stopped" onClick={keepPracticing}>Keep practicing</button>}
        <button className={styles.quietButton} title="Take this session out of your log" onClick={discard}>Discard this session</button>
      </DeckRow>
    </Deck>
    <SidePanel className={styles.practice} label="Practice history">{historySection}</SidePanel>
  </>;

  if (!session) return null;

  return <>
    <Neck className={styles.practice} bar={<p className={styles.instruction}>{instructions[blockIndex]}</p>}>
      {blockIndex === 2 ? <div className={styles.earCard}>
        <p className={styles.eyebrow}>LISTEN FIRST. TRUST YOUR EAR.</p><h2>{answer === null ? 'What interval do you hear?' : answer === asked.semitones ? 'You’ve got it.' : `That was a ${asked.name.toLowerCase()}.`}</h2>
        <button className={styles.listen} onClick={hear} disabled={status !== 'running' || audio.muted}>♫ {answer === null ? 'Listen / replay' : 'Hear it again'}</button>
        <div className={styles.answers} data-many={earCount > 5 ? 'true' : undefined} style={{ gridTemplateColumns: `repeat(${earCount}, minmax(0, 1fr))` }}>{earIntervals.map(interval => <button key={interval.semitones} aria-label={interval.name} title={interval.name} disabled={status !== 'running' || answer !== null} className={answer !== null && interval.semitones === asked.semitones ? styles.correctAnswer : ''} onClick={() => choose(interval.semitones)}><strong>{interval.short}</strong><span>{interval.name}</span></button>)}</div>
        <div className={styles.earFooter}><span>{!byCount ? `${correct} / ${attempts} correct · first answers` : status === 'review' ? `Round complete: ${correct} of ${attempts} on the first try` : again ? `Question ${attempts + (answer === null ? 1 : 0)} · extra` : `Question ${Math.min(earGoal, attempts + (answer === null ? 1 : 0))} of ${earGoal}`}</span><span>{answer !== null && status === 'running' ? 'Next one coming…' : ''}</span></div>
      </div> : <>
        <Fretboard fill fretRange={[region.startFret, boardEnd]} positions={shownPositions} title={`${rootLabel} ${block.short} practice`} notation={notation} noteColors={NOTE_COLORS} rootNote={blockIndex === 3 ? currentChord.root : sessionRoot} intervalLabeling={{ root: blockIndex === 3 ? currentChord.root : sessionRoot, style: 'function', text: labels === 'notes' ? 'note' : 'interval' }} noteLabels={keySpelling} showFingers={labels === 'fingers'} showNoteLabels fullDotOpacity onPlayNote={audio.muted ? undefined : audio.playPosition} activePosition={blockIndex === 3 ? null : audio.playingPosition} ghostLayers={blockIndex === 3 ? boxGhost : undefined} />
        <div className={styles.boardCaption}><span>{blockIndex === 0 ? 'ROOT + FIFTH' : blockIndex === 1 ? `${quality.toUpperCase()} PENTATONIC` : 'CHORD TONES'}{boxTag}</span><span>Frets {region.startFret === 0 ? 'open' : region.startFret}–{boardEnd} · {blockIndex === 3 ? 'click a chord to change its length' : 'tap a note to hear it'}</span><span className={styles.labelSwitch} role="group" aria-label="What the dots say">{LABEL_MODES.map(mode => <button type="button" key={mode} aria-pressed={labels === mode} onClick={() => setLabels(mode)}>{mode}</button>)}</span></div>
      </>}
      {notices}
    </Neck>
    <Deck className={styles.practice} label="Practice block">
      <header className={styles.stageHeader}>
        <div><p className={styles.eyebrow}>{rootLabel} {quality.toUpperCase()} · BLOCK {blockIndex + 1} OF 4</p><h1>{block.title}</h1></div>
        {blockIndex === 3 && <div className={styles.chordStrip} role="group" aria-label="Chords and how long each lasts">{chords.map((chord, index) => { const chordName = `${spell(chord.root)}${chord.quality === 'minor' ? 'm' : ''}`; return <button type="button" key={chord.numeral} className={index === chordIndex ? styles.activeChord : ''} aria-label={`${chordName}, ${barsLabel(bars[index])}. Change its length`} title="Click to change how long this chord lasts: 1, 2 or 4 bars" onClick={() => cycleBars(index)}><small>{chord.numeral} · {barsLabel(bars[index]).toUpperCase()}</small><strong>{chordName}</strong></button>; })}</div>}
        <div className={styles.timer}>{byCount
          ? <><strong>{again ? attempts : `${Math.min(attempts, earGoal)} / ${earGoal}`}</strong><span>{again ? 'answered' : 'questions'}</span></>
          : again ? <><strong>+{formatTime(Math.floor(Math.max(0, session.elapsed[blockIndex] - length)))}</strong><span>extra time</span></>
          : <><strong>{formatTime(length + bonus - session.elapsed[blockIndex])}</strong><span>left in this block</span></>}</div>
      </header>
      <div className={styles.transport}>
        {status === 'review'
          ? <button className={styles.primary} onClick={last ? finish : goNext}>{last ? 'Finish session' : `Next: ${nextShort}`} <span aria-hidden="true">↗</span></button>
          : canHearAgain ? <button className={`${styles.primary} ${styles.hearAgain}`} title="The app plays the notes once more, after a count-in" onClick={hearAgain}><span aria-hidden="true">▶</span> Hear it again</button>
          : <button className={styles.primary} title="Space does this too" onClick={active ? () => dispatch({ type: 'pause' }) : start}>{status === 'loading' ? 'Cancel loading' : active ? 'Pause practice' : 'Resume practice'}</button>}
        {canHearAgain && <button className={styles.quietButton} title="Space does this too" onClick={() => dispatch({ type: 'pause' })}>Pause</button>}
        {status === 'review'
          ? <button className={styles.quietButton} onClick={playAgain}>Play this block again</button>
          : !last && <button className={styles.quietButton} title={again ? undefined : 'Leave this block now. A session with a skipped block is logged as a short session.'} onClick={goNext}>{again ? `Next: ${nextShort}` : `Skip to ${nextShort}`}</button>}
        <div className={styles.beatStatus} role="status">{status === 'loading' ? 'Getting your guitar ready…' : blockIndex === EAR_BLOCK && active ? '' : status === 'counting' ? `Count in · ${beat + 1} / 4` : status === 'review' ? (last ? 'Session complete.' : 'Block complete. Take a breath.') : status === 'paused' ? 'Paused · your place is saved' : `${liveTempo} BPM · loop ${cycle + 1}${canHearAgain ? ' · your turn' : ''}`}</div>
        {blockIndex !== EAR_BLOCK && <div className={styles.beats} aria-hidden="true">{[0, 1, 2, 3].map(n => <i key={n} className={active && beat === n ? styles.litBeat : ''} />)}</div>}
        <div className={styles.endRow}>
          {status !== 'review' && !byCount && !again && <button className={styles.quietButton} title="One more minute on this block" onClick={() => dispatch({ type: 'extend' })}>+1 min</button>}
          {!(status === 'review' && last) && <button className={styles.quietButton} title="Stop here and see your summary. You can carry on or discard it from there." onClick={finish}>End session</button>}
        </div>
      </div>
    </Deck>
    <SidePanel className={styles.practice} label="This session">
      <section className={styles.sideSection} aria-label="Session blocks">
        <h2 className={styles.sideTitle}>This session</h2>
        <nav className={styles.steps} aria-label="Session blocks">{PRACTICE_BLOCKS.map((item, index) => <div key={item.id} className={index === blockIndex ? styles.currentStep : styles.step} aria-current={index === blockIndex ? 'step' : undefined}><span>{blockDone(session, index) ? '✓' : index < blockIndex ? '–' : `0${index + 1}`}</span>{item.short}<small>{earByCount(session, index) ? `${earGoal} q` : `${blockSeconds(session, index) / 60}m`}</small></div>)}</nav>
        <div className={styles.sessionProgress} role="progressbar" aria-label="Practice progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }} /></div>
      </section>
      <section className={styles.sideSection} aria-label="Practice options">
        <h2 className={styles.sideTitle}>Options</h2>
        <div className={styles.practiceOptions}><label title="Roots and Scale: the app plays the notes once and then leaves you the click, or plays them every time round, or not at all">App plays the notes <select aria-label="App plays the notes (Roots, Scale)" value={guide} onChange={e => changeGuide(e.target.value as GuideMode)}><option value="once">Once</option><option value="loop">Every loop</option><option value="off">Never</option></select></label><label><input type="checkbox" checked={metronome} disabled={active} onChange={e => setMetronome(e.target.checked)} /> Metronome</label><label><input type="checkbox" checked={ramp} disabled={active} onChange={e => setRamp(e.target.checked)} /> Scale: +4 BPM every 4 loops, up to 120</label></div>
      </section>
      {soundSection}
      <section className={styles.sideSection} aria-label="How this block feels">
        <h2 className={styles.sideTitle}>How does it feel?</h2>
        <div className={styles.reflection}>{RATINGS.map(rating => <button key={rating.id} aria-pressed={session.ratings[blockIndex] === rating.id} onClick={() => dispatch({ type: 'rate', rating: rating.id })}>{rating.label}</button>)}<small>Your assessment of your playing in this block.</small></div>
      </section>
    </SidePanel>
  </>;
}
