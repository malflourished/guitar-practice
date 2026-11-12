import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChordQuality, FretPosition, NoteName } from '../types/music';
import type { UseInstrument } from '../hooks/useInstrument';
import type { NotationPreference } from '../lib/music';
import {
  CHANGES_PROGRESSIONS,
  FORMULA_TARGETS,
  INTERVALS,
  SHELL_QUALITIES,
  buildChangesProgression,
  buildFormulaSpec,
  getChangesProgression,
  getDirectedTargets,
  getDyadRelationshipLabel,
  getFormulaTarget,
  getGuideToneMotion,
  getLeapCaption,
  planGuideTones,
  pickShellRoot,
  getIntervalColor,
  getIntervalDef,
  getIntervalDyadShapes,
  getNoteAt,
  getOneStringShapes,
  getPlayableAnchors,
  getPositionsForIntervals,
  getRootAnchors,
  getShellDef,
  crossesGtoB,
  noteToSemitone,
  type DrillScope,
} from '../lib/music';
import { ALL_NOTES } from '../lib/colors';
import { fretToMidi, positionToMidi } from '../lib/audio/pitch';
import {
  playInterval,
  rootReferenceMidi,
  type IntervalPlaybackDirection,
} from '../lib/audio/intervalPlayback';
import { Fretboard } from './Fretboard';
import { usePersistentState } from '../hooks/usePersistentState';
import { EMPTY_SCORE, validScore, recordResult } from '../lib/practice/score';
import styles from './IntervalTrainer.module.css';

type Drill =
  | 'learn'
  | 'find'
  | 'identify'
  | 'shell'
  | 'shapes'
  | 'build'
  | 'changes';
type LabelStyle = 'function' | 'degree';

interface IntervalTrainerProps {
  root: NoteName;
  notation: NotationPreference;
  noteColors: Record<NoteName, string>;
  audio: UseInstrument;
}

// Ordered to follow the two-point learning path: meet the interval, see its
// generic shapes, drill recognition, then apply it to chord tones, full
// formulas, and finally chord changes.
const DRILLS: { id: Drill; label: string; blurb: string }[] = [
  { id: 'learn', label: 'Learn', blurb: 'See and hear an interval everywhere it lives.' },
  { id: 'shapes', label: 'Shapes', blurb: 'The generic two-point shapes for one interval.' },
  { id: 'find', label: 'Find', blurb: 'Hear it, then find it on the neck.' },
  { id: 'identify', label: 'Identify', blurb: 'Hear it, then name it by ear.' },
  { id: 'shell', label: 'Shells', blurb: 'Build a chord from its 3rd and 7th.' },
  { id: 'build', label: 'Build', blurb: 'Assemble a scale or chord from interval functions.' },
  { id: 'changes', label: 'Changes', blurb: 'Outline a progression with its 3rds and 7ths.' },
];

const SCOPES: { id: DrillScope; label: string }[] = [
  { id: 'string', label: 'One string' },
  { id: 'position', label: 'In position' },
  { id: 'neck', label: 'Whole neck' },
];

/** Default quiz pool: the 3rd, 5th, and ♭7 (the MVP "money" intervals). */
const DEFAULT_ENABLED = [4, 7, 10];

/** Toggle-able intervals (1..12 — the unison is always the root). */
const TOGGLEABLE = INTERVALS.filter((i) => i.semitones > 0).map((i) => i.semitones);

// Presets follow Quayle's curriculum order: the money intervals first, then
// the full chord-tone set, the chromatic-completion tensions, and everything.
const ENABLED_PRESETS: { label: string; semitones: number[] }[] = [
  { label: '3 · 5 · ♭7', semitones: [4, 7, 10] },
  { label: '3rds & 7ths', semitones: [3, 4, 10, 11] },
  { label: 'Chord tones', semitones: [3, 4, 6, 7, 10, 11] },
  { label: 'Tensions', semitones: [1, 2, 5, 8, 9] },
  { label: 'Diatonic', semitones: [2, 4, 5, 7, 9, 11] },
  { label: 'All 12', semitones: TOGGLEABLE },
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function samePosition(a: FretPosition, b: FretPosition): boolean {
  return a.string === b.string && a.fret === b.fret;
}

interface Question {
  root: NoteName;
  semitones: number;
  anchor: FretPosition | null;
  targets: FretPosition[];
}

export function IntervalTrainer({
  root,
  notation,
  noteColors,
  audio,
}: IntervalTrainerProps) {
  const [drill, setDrill] = useState<Drill>('find');
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('function');
  const [scope, setScope] = useState<DrillScope>('position');
  const [direction, setDirection] = useState<IntervalPlaybackDirection>('ascending');
  const [randomRoot, setRandomRoot] = useState(false);
  const [enabled, setEnabled] = useState<number[]>(DEFAULT_ENABLED);
  const [shellQuality, setShellQuality] = useState<ChordQuality>('maj7');
  const [shapeSemitones, setShapeSemitones] = useState(4);
  const [formulaTargetId, setFormulaTargetId] = useState('scale:major');
  const [buildStep, setBuildStep] = useState(1);
  const [changesId, setChangesId] = useState('major-251');
  const [changesStep, setChangesStep] = useState(0);

  const [question, setQuestion] = useState<Question | null>(null);
  const [found, setFound] = useState<FretPosition[]>([]);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [guessLabel, setGuessLabel] = useState<string | null>(null);
  const [score, setScore] = usePersistentState('interval-score-v1', EMPTY_SCORE, validScore);
  const resultRegistered = useRef(false);

  const playTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearPlayTimers = useCallback(() => {
    playTimers.current.forEach(clearTimeout);
    playTimers.current = [];
  }, []);
  useEffect(() => () => clearPlayTimers(), [clearPlayTimers]);

  const playNote = useCallback(
    (midi: number) => {
      if (!audio.muted) audio.playNote(midi);
    },
    [audio],
  );

  const playPromptInterval = useCallback(
    (q: Question) => {
      clearPlayTimers();
      const rootMidi = q.anchor ? positionToMidi(q.anchor) : rootReferenceMidi(q.root);
      playTimers.current = playInterval(playNote, rootMidi, q.semitones, direction);
    },
    [clearPlayTimers, playNote, direction],
  );

  const enabledArray = enabled.length > 0 ? enabled : DEFAULT_ENABLED;

  const nextQuestion = useCallback(() => {
    // Shapes, Build, and Changes are exploratory views, not graded questions.
    if (drill === 'shapes' || drill === 'build' || drill === 'changes') return;

    resultRegistered.current = false;
    const qRoot = randomRoot ? pick(ALL_NOTES) : root;
    setFound([]);
    setSolved(false);
    setRevealed(false);
    setGuessLabel(null);

    if (drill === 'identify') {
      const semitones = pick(enabledArray);
      const q: Question = { root: qRoot, semitones, anchor: null, targets: [] };
      setQuestion(q);
      playPromptInterval(q);
      return;
    }

    if (drill === 'shell') {
      const shell = getShellDef(shellQuality);
      const anchors = getRootAnchors(qRoot).filter((a) => a.fret <= 17);
      const anchor = anchors.length ? pick(anchors) : getRootAnchors(qRoot)[0];
      const thirds = getDirectedTargets(anchor, shell.third, 'position');
      const sevenths = getDirectedTargets(anchor, shell.seventh, 'position');
      const q: Question = {
        root: qRoot,
        semitones: shell.third,
        anchor,
        targets: [...thirds, ...sevenths],
      };
      setQuestion(q);
      return;
    }

    // learn / find — Learn is deterministic (stable) so it never reshuffles
    // strings when you re-pick the same interval; Find randomizes the anchor.
    const semitones =
      drill === 'learn' && question && enabledArray.includes(question.semitones) ? question.semitones : pick(enabledArray);
    const anchors = getPlayableAnchors(qRoot, semitones, scope);
    const anchor = anchors.length
      ? drill === 'learn'
        ? anchors[0]
        : pick(anchors)
      : getRootAnchors(qRoot)[0];
    const targets = getDirectedTargets(anchor, semitones, scope);
    const q: Question = { root: qRoot, semitones, anchor, targets };
    setQuestion(q);
    if (drill === 'find') playPromptInterval(q);
  }, [
    randomRoot,
    root,
    drill,
    enabledArray,
    scope,
    shellQuality,
    question,
    playPromptInterval,
  ]);

  // Start a fresh question when the drill, scope, root context, or shell changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (re)generate a question when the drill knobs change
    nextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate on these knobs only
  }, [drill, scope, shellQuality, randomRoot, root, enabled]);

  const learnSemitones = question?.semitones ?? 4;

  const setLearnInterval = (semitones: number) => {
    const qRoot = randomRoot ? question?.root ?? root : root;
    const anchors = getPlayableAnchors(qRoot, semitones, scope);
    const anchor = anchors.length ? anchors[0] : getRootAnchors(qRoot)[0];
    const targets = getDirectedTargets(anchor, semitones, scope);
    const q: Question = { root: qRoot, semitones, anchor, targets };
    setQuestion(q);
    playPromptInterval(q);
  };

  // Learn: clicking a marker plays the interval example (root → interval) on
  // that string, honoring the melodic/harmonic direction.
  const handleLearnPlay = (pos: FretPosition) => {
    if (!question || audio.muted) return;
    clearPlayTimers();
    const semisFromRoot =
      (noteToSemitone(pos.note) - noteToSemitone(question.root) + 12) % 12;
    const rootFret =
      semisFromRoot === 0 ? pos.fret : pos.fret - question.semitones;
    const safeRootFret = rootFret >= 0 ? rootFret : pos.fret;
    const rootMidi = fretToMidi(pos.string, safeRootFret);
    playTimers.current = playInterval(
      playNote,
      rootMidi,
      question.semitones,
      direction,
    );
  };

  const registerResult = (correct: boolean) => {
    if (resultRegistered.current) return;
    resultRegistered.current = true;
    setScore(previous => recordResult(previous, correct));
  };

  const handleFindClick = (stringIndex: number, fret: number) => {
    if (!question || solved || revealed) return;
    const note = getNoteAt(stringIndex, fret);
    const pos: FretPosition = { string: stringIndex, fret, note };
    playNote(positionToMidi(pos));
    setFound((prev) =>
      prev.some((p) => samePosition(p, pos)) ? prev : [...prev, pos],
    );
    const hit = question.targets.some((t) => samePosition(t, pos));
    const semis = (noteToSemitone(note) - noteToSemitone(question.root) + 12) % 12;
    setGuessLabel(getIntervalDef(semis).functionLabel);
    registerResult(hit);
    if (hit) setSolved(true);
  };

  const handleShellClick = (stringIndex: number, fret: number) => {
    if (!question || solved || revealed) return;
    const note = getNoteAt(stringIndex, fret);
    const pos: FretPosition = { string: stringIndex, fret, note };
    const shell = getShellDef(shellQuality);
    const rootPc = noteToSemitone(question.root);
    const thirdPc = (rootPc + shell.third) % 12;
    const seventhPc = (rootPc + shell.seventh) % 12;
    const notePc = noteToSemitone(note);
    const semis = (notePc - rootPc + 12) % 12;
    setGuessLabel(getIntervalDef(semis).functionLabel);

    if (notePc !== thirdPc && notePc !== seventhPc) {
      registerResult(false);
      playNote(positionToMidi(pos));
      return;
    }
    playNote(positionToMidi(pos));
    if (found.some(p => samePosition(p, pos))) return;
    const next = [...found, pos];
    setFound(next);
    const pcs = new Set(next.map(p => noteToSemitone(p.note)));
    if (pcs.has(thirdPc) && pcs.has(seventhPc)) {
      setSolved(true);
      registerResult(true);
      if (question.anchor && !audio.muted) audio.strum([question.anchor, ...next]);
    }
  };

  const handleReveal = () => {
    if (!question || solved || revealed) return;
    setRevealed(true);
    registerResult(false);
  };

  const handleIdentifyChoice = (semitones: number) => {
    if (!question || solved || revealed) return;
    const correct = semitones === question.semitones;
    setGuessLabel(getIntervalDef(semitones).functionLabel);
    if (correct) {
      setSolved(true);
      registerResult(true);
    } else {
      setRevealed(true);
      registerResult(false);
    }
  };

  // Shapes drill: a comfortable low root anchor and its generic dyad shapes.
  const shapeAnchor = useMemo<FretPosition | null>(() => {
    const anchors = getRootAnchors(root);
    if (anchors.length === 0) return null;
    const comfy = anchors.filter((a) => a.fret >= 2 && a.fret <= 9);
    const pool = comfy.length ? comfy : anchors;
    // Prefer the lowest-pitched string (highest index) so the higher strings
    // needed for adjacent / string-skip shapes exist above the root.
    return [...pool].sort((a, b) => b.string - a.string || a.fret - b.fret)[0];
  }, [root]);

  const dyadShapes = useMemo(
    () => (shapeAnchor ? getIntervalDyadShapes(shapeAnchor, shapeSemitones) : []),
    [shapeAnchor, shapeSemitones],
  );

  // Build drill: the chosen target's formula and how many tones are revealed.
  const formulaSpec = useMemo(
    () => buildFormulaSpec(getFormulaTarget(formulaTargetId)),
    [formulaTargetId],
  );
  const revealedCount = Math.min(Math.max(1, buildStep), formulaSpec.tones.length);
  const revealedTones = formulaSpec.tones.slice(0, revealedCount);

  // Reset the reveal to the full shape whenever the build target changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reveal count to the new target
    setBuildStep(buildFormulaSpec(getFormulaTarget(formulaTargetId)).tones.length);
  }, [formulaTargetId]);

  const handleShapePlay = useCallback(() => {
    if (!shapeAnchor || audio.muted) return;
    clearPlayTimers();
    playTimers.current = playInterval(
      playNote,
      positionToMidi(shapeAnchor),
      shapeSemitones,
      direction,
    );
  }, [shapeAnchor, shapeSemitones, audio.muted, clearPlayTimers, playNote, direction]);

  const handleBuildPlay = (pos: FretPosition) => {
    if (!audio.muted) playNote(positionToMidi(pos));
  };

  // Changes drill: resolve the chosen progression and walk its guide tones.
  const changesSteps = useMemo(
    () => buildChangesProgression(root, getChangesProgression(changesId)),
    [root, changesId],
  );
  const changeIndex = Math.min(changesStep, changesSteps.length - 1);
  const changeStep = changesSteps[changeIndex] ?? null;

  // Guide tones for the whole progression, on the D and G strings, so each
  // chord's 3rd and 7th sit next to the previous chord's.
  const guidePlan = useMemo(() => {
    const first = changesSteps[0];
    if (!first) return [];
    const anchors = getRootAnchors(first.root);
    const comfy = anchors.filter((a) => a.fret >= 3 && a.fret <= 12);
    const pool = comfy.length ? comfy : anchors;
    const anchorFret = pool.length
      ? [...pool].sort((a, b) => b.string - a.string || a.fret - b.fret)[0].fret
      : 5;
    return planGuideTones(changesSteps, anchorFret);
  }, [changesSteps]);

  // Each chord's root sits under its guide tones, on the low E or A string, so
  // the three notes make a shell voicing a hand can hold.
  const changeAnchor = useMemo<FretPosition | null>(() => {
    const placement = guidePlan[changeIndex];
    if (!changeStep || !placement) return null;
    return pickShellRoot(changeStep.root, placement);
  }, [changeStep, guidePlan, changeIndex]);

  const changesPositions = useMemo<FretPosition[]>(() => {
    const placement = guidePlan[changeIndex];
    if (!changeStep || !changeAnchor || !placement) return [];
    return dedupe(
      [changeAnchor, placement.third, placement.seventh].filter(
        Boolean,
      ) as FretPosition[],
    );
  }, [changeStep, changeAnchor, guidePlan, changeIndex]);

  // Keep the step index in range when the progression or key changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the walk on a new progression
    setChangesStep(0);
  }, [changesId, root]);

  const handleChangesPlay = () => {
    if (!audio.muted && changesPositions.length) audio.strum(changesPositions);
  };

  // Positions drawn on the board for the current drill + state.
  const boardPositions = useMemo<FretPosition[]>(() => {
    if (drill === 'shapes') {
      if (!shapeAnchor) return [];
      return dedupe([shapeAnchor, ...dyadShapes.map((s) => s.target)]);
    }
    if (drill === 'build') {
      const intervals = revealedTones.map((t) => t.interval);
      return getPositionsForIntervals(root, intervals);
    }
    if (drill === 'changes') {
      return changesPositions;
    }
    if (!question) return [];
    if (drill === 'learn') {
      if (scope === 'string') {
        return getOneStringShapes(question.root, question.semitones);
      }
      if (scope === 'neck') {
        return dedupe([
          ...getRootAnchors(question.root),
          ...(question.anchor
            ? getDirectedTargets(question.anchor, question.semitones, 'neck')
            : []),
        ]);
      }
      const base = question.anchor ? [question.anchor] : [];
      return dedupe([...base, ...question.targets]);
    }
    if (drill === 'find') {
      const base = question.anchor ? [question.anchor] : [];
      const reveal = revealed ? question.targets : [];
      return dedupe([...base, ...found, ...reveal]);
    }
    if (drill === 'shell') {
      const base = question.anchor ? [question.anchor] : [];
      const reveal = revealed ? question.targets : [];
      return dedupe([...base, ...found, ...reveal]);
    }
    return [];
  }, [
    question,
    drill,
    scope,
    found,
    revealed,
    shapeAnchor,
    dyadShapes,
    revealedTones,
    changesPositions,
    root,
  ]);

  const showBoard = drill !== 'identify';
  const showScope = drill === 'find' || drill === 'learn';
  const boardRoot =
    drill === 'shapes' || drill === 'build'
      ? root
      : drill === 'changes'
        ? changeStep?.root ?? root
        : question?.root ?? root;
  const guideMotion =
    drill === 'changes' && changeIndex > 0 && changeStep
      ? getGuideToneMotion(
          changesSteps[changeIndex - 1],
          changeStep,
          guidePlan[changeIndex - 1],
          guidePlan[changeIndex],
        )
      : null;
  const leapCaption =
    guideMotion && guidePlan[changeIndex - 1] && guidePlan[changeIndex]
      ? getLeapCaption(
          changesSteps[changeIndex - 1],
          changesSteps[changeIndex],
          guidePlan[changeIndex - 1],
          guidePlan[changeIndex],
        )
      : null;
  const intervalDef = question ? getIntervalDef(question.semitones) : null;
  const gbWarning =
    showScope &&
    scope !== 'neck' &&
    question?.anchor != null &&
    crossesGtoB(question.anchor, question.targets);

  const promptText = (() => {
    if (drill === 'shapes') {
      const def = getIntervalDef(shapeSemitones);
      return `${def.name} — its generic two-point shapes from ${root}`;
    }
    if (drill === 'build') {
      const built = revealedCount >= formulaSpec.tones.length;
      return built
        ? `${root} ${formulaSpec.label} — ${formulaSpec.tones.map((t) => t.label).join(' ')}`
        : `Building ${root} ${formulaSpec.label} — ${revealedTones
            .map((t) => t.label)
            .join(' ')}`;
    }
    if (drill === 'changes') {
      if (!changeStep) return '';
      return `${changeStep.numeral} on ${changeStep.root} — guide tones ${changeStep.thirdLabel} (${changeStep.thirdNote}) and ${changeStep.seventhLabel} (${changeStep.seventhNote})`;
    }
    if (!question || !intervalDef) return '';
    const target =
      labelStyle === 'degree' ? intervalDef.degreeLabel : intervalDef.functionLabel;
    if (drill === 'learn') {
      return `${intervalDef.name} — ${intervalDef.character}`;
    }
    if (drill === 'identify') {
      return solved
        ? `Correct — ${intervalDef.name}`
        : revealed
          ? `It was the ${intervalDef.name}`
          : 'Name the interval you heard';
    }
    if (drill === 'shell') {
      const shell = getShellDef(shellQuality);
      return solved
        ? `${question.root} ${shell.label} shell complete`
        : `Build the ${question.root} ${shell.label} shell — find the 3rd and the ${shell.seventh === 11 ? '7th' : '♭7'}`;
    }
    return solved
      ? `Correct — that's the ${intervalDef.name}`
      : revealed
        ? `It was the ${intervalDef.name}`
        : `Find the ${target} above ${question.root}`;
  })();

  return (
    <div className={styles.panel}>
      <div className={styles.tabs} role="group" aria-label="Interval drill">
        {DRILLS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={drill === id ? styles.tabActive : styles.tab}
            aria-pressed={drill === id}
            onClick={() => setDrill(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.options}>
        {showScope && (
          <div className={styles.segment} role="group" aria-label="Search scope">
            {SCOPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={scope === id ? styles.segmentBtnActive : styles.segmentBtn}
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {drill === 'shell' && (
          <div className={styles.segment} role="group" aria-label="Shell quality">
            {SHELL_QUALITIES.map((quality) => (
              <button
                key={quality}
                type="button"
                className={
                  shellQuality === quality ? styles.segmentBtnActive : styles.segmentBtn
                }
                aria-pressed={shellQuality === quality}
                onClick={() => setShellQuality(quality)}
              >
                {getShellDef(quality).label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.segment} role="group" aria-label="Label style">
          <button
            type="button"
            className={labelStyle === 'function' ? styles.segmentBtnActive : styles.segmentBtn}
            aria-pressed={labelStyle === 'function'}
            onClick={() => setLabelStyle('function')}
          >
            R 3 ♭7
          </button>
          <button
            type="button"
            className={labelStyle === 'degree' ? styles.segmentBtnActive : styles.segmentBtn}
            aria-pressed={labelStyle === 'degree'}
            onClick={() => setLabelStyle('degree')}
          >
            1 3 ♭7
          </button>
        </div>

        {(drill === 'find' || drill === 'identify' || drill === 'learn') && (
          <div className={styles.segment} role="group" aria-label="Playback direction">
            {(['ascending', 'harmonic'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                className={direction === dir ? styles.segmentBtnActive : styles.segmentBtn}
                aria-pressed={direction === dir}
                onClick={() => setDirection(dir)}
              >
                {dir === 'ascending' ? 'Melodic' : 'Harmonic'}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={randomRoot ? styles.toggleActive : styles.toggle}
          aria-pressed={randomRoot}
          onClick={() => setRandomRoot((prev) => !prev)}
          title="Pick a random root each question instead of the app key"
        >
          Random root
        </button>
      </div>

      {(drill === 'find' || drill === 'identify') && (
        <div className={styles.poolRow}>
          <span className={styles.poolLabel}>Pool</span>
          <div className={styles.presets}>
            {ENABLED_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={styles.preset}
                onClick={() => setEnabled(preset.semitones)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className={styles.chips}>
            {TOGGLEABLE.map((semitones) => {
              const on = enabledArray.includes(semitones);
              const def = getIntervalDef(semitones);
              return (
                <button
                  key={semitones}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  style={on ? { borderColor: getIntervalColor(semitones) } : undefined}
                  onClick={() =>
                    setEnabled((prev) =>
                      prev.includes(semitones)
                        ? prev.filter((s) => s !== semitones)
                        : [...prev, semitones].sort((a, b) => a - b),
                    )
                  }
                  title={def.name}
                >
                  {labelStyle === 'degree' ? def.degreeLabel : def.functionLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {drill === 'learn' && (
        <div className={styles.chips} role="group" aria-label="Interval">
          {INTERVALS.filter((i) => i.semitones > 0).map((def) => {
            const on = learnSemitones === def.semitones;
            return (
              <button
                key={def.semitones}
                type="button"
                className={on ? styles.chipOn : styles.chip}
                aria-pressed={on}
                style={on ? { borderColor: getIntervalColor(def.semitones) } : undefined}
                onClick={() => setLearnInterval(def.semitones)}
                title={def.name}
              >
                {labelStyle === 'degree' ? def.degreeLabel : def.functionLabel}
              </button>
            );
          })}
        </div>
      )}

      {drill === 'shapes' && (
        <>
          <div className={styles.chips} role="group" aria-label="Interval">
            {INTERVALS.filter((i) => i.semitones > 0 && i.semitones < 12).map((def) => {
              const on = shapeSemitones === def.semitones;
              return (
                <button
                  key={def.semitones}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  style={on ? { borderColor: getIntervalColor(def.semitones) } : undefined}
                  onClick={() => setShapeSemitones(def.semitones)}
                  title={def.name}
                >
                  {labelStyle === 'degree' ? def.degreeLabel : def.functionLabel}
                </button>
              );
            })}
          </div>
          <ul className={styles.legend} aria-label="Shape relationships">
            {dyadShapes.map((shape) => (
              <li key={shape.relationship} className={styles.legendItem}>
                <span className={styles.legendName}>
                  {getDyadRelationshipLabel(shape.relationship)}
                </span>
                <span className={styles.legendDetail}>
                  {shape.fretOffset === 0
                    ? 'same fret'
                    : `${shape.fretOffset > 0 ? '+' : ''}${shape.fretOffset} fret${
                        Math.abs(shape.fretOffset) === 1 ? '' : 's'
                      }`}
                  {shape.crossesGB && ' · crosses G→B'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {drill === 'build' && (
        <>
          <div className={styles.presets} role="group" aria-label="Build target">
            {FORMULA_TARGETS.map((target) => (
              <button
                key={target.id}
                type="button"
                className={formulaTargetId === target.id ? styles.chipOn : styles.preset}
                aria-pressed={formulaTargetId === target.id}
                onClick={() => setFormulaTargetId(target.id)}
              >
                {target.label}
              </button>
            ))}
          </div>
          <div className={styles.chips} role="group" aria-label="Formula">
            {formulaSpec.tones.map((tone, index) => {
              const shown = index < revealedCount;
              const cls = !shown
                ? styles.chip
                : tone.altered
                  ? styles.chipAltered
                  : styles.chipOn;
              return (
                <button
                  key={`${tone.interval}-${index}`}
                  type="button"
                  className={cls}
                  style={shown ? { borderColor: getIntervalColor(tone.interval) } : undefined}
                  onClick={() => setBuildStep(index + 1)}
                  title={
                    tone.altered ? `${tone.label} — altered from major` : tone.label
                  }
                >
                  {tone.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {drill === 'changes' && (
        <>
          <div className={styles.presets} role="group" aria-label="Progression">
            {CHANGES_PROGRESSIONS.map((prog) => (
              <button
                key={prog.id}
                type="button"
                className={changesId === prog.id ? styles.chipOn : styles.preset}
                aria-pressed={changesId === prog.id}
                onClick={() => setChangesId(prog.id)}
              >
                {prog.label}
              </button>
            ))}
          </div>
          <div className={styles.chips} role="group" aria-label="Chords">
            {changesSteps.map((step, index) => (
              <button
                key={`${step.numeral}-${index}`}
                type="button"
                className={index === changeIndex ? styles.chipOn : styles.chip}
                aria-pressed={index === changeIndex}
                onClick={() => setChangesStep(index)}
                title={`${step.numeral} on ${step.root}`}
              >
                {step.numeral}
              </button>
            ))}
          </div>
        </>
      )}

      <div className={styles.promptRow}>
        <div className={styles.promptMain}>
          <p
            className={
              solved ? styles.promptDone : revealed ? styles.promptReveal : styles.prompt
            }
          >
            {promptText}
          </p>
          {gbWarning && (
            <p className={styles.gbBadge}>
              G→B shift: this shape spans the only string pair tuned a major 3rd
              apart, so the geometry differs here.
            </p>
          )}
          {guideMotion && (
            <p className={styles.guess}>
              {leapCaption ??
                (guideMotion.held
                ? `Common tone held: ${guideMotion.fromLabel} → ${guideMotion.toLabel}`
                : guideMotion.semitones === 0
                  ? `Same note, new spot: ${guideMotion.fromLabel} → ${guideMotion.toLabel}`
                  : `Voice-leading: ${guideMotion.fromLabel} → ${guideMotion.toLabel} moves ${guideMotion.semitones} semitone${
                    guideMotion.semitones === 1 ? '' : 's'
                  }`)}
            </p>
          )}
          {guessLabel && !solved && drill !== 'identify' && !revealed && (
            <p className={styles.guess}>Last note: {guessLabel}</p>
          )}
        </div>

        <div className={styles.controls}>
          {(drill === 'find' || drill === 'identify' || drill === 'learn') && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => question && playPromptInterval(question)}
              disabled={audio.muted}
              title={audio.muted ? 'Unmute to hear the interval' : 'Replay the interval'}
            >
              Play
            </button>
          )}
          {drill === 'shapes' && (
            <button
              type="button"
              className={styles.btn}
              onClick={handleShapePlay}
              disabled={audio.muted}
              title={audio.muted ? 'Unmute to hear the interval' : 'Hear the interval'}
            >
              Play
            </button>
          )}
          {drill === 'build' && (
            <>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setBuildStep((s) => Math.max(1, s - 1))}
                disabled={revealedCount <= 1}
                title="Remove the last tone"
              >
                Peel
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() =>
                  setBuildStep((s) => Math.min(formulaSpec.tones.length, s + 1))
                }
                disabled={revealedCount >= formulaSpec.tones.length}
                title="Add the next interval"
              >
                Add tone
              </button>
            </>
          )}
          {drill === 'changes' && (
            <>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setChangesStep((s) => Math.max(0, s - 1))}
                disabled={changeIndex <= 0}
                title="Previous chord"
              >
                Prev
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={handleChangesPlay}
                disabled={audio.muted}
                title={audio.muted ? 'Unmute to hear the shell' : 'Hear the guide tones'}
              >
                Hear
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() =>
                  setChangesStep((s) => Math.min(changesSteps.length - 1, s + 1))
                }
                disabled={changeIndex >= changesSteps.length - 1}
                title="Next chord"
              >
                Next
              </button>
            </>
          )}
          {drill === 'shell' && question?.anchor && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                const shell = getShellDef(shellQuality);
                const a = question.anchor!;
                const third = getDirectedTargets(a, shell.third, 'position')[0];
                const seventh = getDirectedTargets(a, shell.seventh, 'position')[0];
                const voicing = [a, third, seventh].filter(Boolean) as FretPosition[];
                if (!audio.muted) audio.strum(voicing);
              }}
              disabled={audio.muted}
            >
              Hear shell
            </button>
          )}
          {(drill === 'find' || drill === 'shell') && !solved && !revealed && (
            <button type="button" className={styles.btn} onClick={handleReveal}>
              Reveal
            </button>
          )}
          {(drill === 'find' || drill === 'identify' || drill === 'shell') && (
            <button type="button" className={styles.btnPrimary} onClick={nextQuestion}>
              Next
            </button>
          )}
        </div>
      </div>

      {drill === 'identify' && (
        <div className={styles.choices} role="group" aria-label="Interval choices">
          {enabledArray
            .slice()
            .sort((a, b) => a - b)
            .map((semitones) => {
              const def = getIntervalDef(semitones);
              const isAnswer = question?.semitones === semitones;
              const cls =
                (solved || revealed) && isAnswer
                  ? styles.choiceCorrect
                  : styles.choiceBtn;
              return (
                <button
                  key={semitones}
                  type="button"
                  className={cls}
                  disabled={solved || revealed}
                  onClick={() => handleIdentifyChoice(semitones)}
                >
                  {def.name}
                </button>
              );
            })}
        </div>
      )}

      {(drill === 'find' || drill === 'shell' || drill === 'identify') && (
        <div className={styles.scoreRow}>
          <span className={styles.scoreItem}>
            First answers {score.correct}/{score.total}
          </span>
          <span className={styles.scoreItem}>Streak {score.streak}</span>
          <span className={styles.scoreItem}>Best {score.best}</span>
        </div>
      )}

      {showBoard &&
        (question ||
          drill === 'shapes' ||
          drill === 'build' ||
          drill === 'changes') && (
          <Fretboard
            positions={boardPositions}
            title={promptText}
            notation={notation}
            noteColors={noteColors}
            showNoteLabels
            intervalLabeling={{ root: boardRoot, style: labelStyle }}
            onCellClick={
              drill === 'find'
                ? handleFindClick
                : drill === 'shell'
                  ? handleShellClick
                  : undefined
            }
            onPlayNote={
              drill === 'learn'
                ? handleLearnPlay
                : drill === 'shapes'
                  ? handleShapePlay
                  : drill === 'build' || drill === 'changes'
                    ? handleBuildPlay
                    : undefined
            }
          />
        )}
    </div>
  );
}

function dedupe(positions: FretPosition[]): FretPosition[] {
  const seen = new Set<string>();
  const out: FretPosition[] = [];
  for (const p of positions) {
    const key = `${p.string}:${p.fret}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
