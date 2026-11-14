import { describe, expect, it } from 'vitest';
import type { ChordQuality, NoteName } from '../../types/music';
import { nextChange } from '../audio/jamSchedule';
import { jamChordsOf } from '../../modes/progressions/jamChords';
import { getNoteAt } from './fretboard';
import {
  GUIDE_FOCUS,
  MELODY_STRINGS,
  ONE_STRING_TOP_FRET,
  chordTargetTones,
  landingCue,
  landingTargets,
  placeTargets,
  reachWindow,
  targetLeadBeats,
  targetPhase,
  targetTones,
  type CueClock,
  type FretWindow,
  type TargetChord,
  type TargetFocus,
} from './landingTargets';
import { noteToSemitone, semitoneToNote } from './notes';
import { buildClimbPlan, climbShapesAt } from './progressionClimb';
import { buildSavedProgressionChordViews } from './progressionChordViews';
import {
  PROGRESSION_LIBRARY,
  entryToProgressionDef,
  getProgressionLibraryEntry,
} from './progressionLibrary';
import { resolveProgression, type ResolvedProgressionStep } from './progressions';

const KEYS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const chord = (root: NoteName, quality: ChordQuality): TargetChord => ({ root, quality });
/** The note `semitones` above a key note. */
const up = (key: NoteName, semitones: number) => semitoneToNote(noteToSemitone(key) + semitones);
const stepsOf = (id: string, key: NoteName): ResolvedProgressionStep[] =>
  resolveProgression(key, entryToProgressionDef(getProgressionLibraryEntry(id)!), 'sharps');
const summary = (tones: { note: NoteName; label: string; held: boolean }[]) =>
  tones.map((tone) => `${tone.note} ${tone.label}${tone.held ? ' held' : ''}`);
const pcs = (c: TargetChord) => new Set(chordTargetTones(c).map((tone) => tone.pc));
/** Smallest distance between two pitch classes, in semitones. */
const apart = (a: number, b: number) => Math.min((a - b + 12) % 12, (b - a + 12) % 12);
const OPEN: FretWindow = { lo: 0, hi: 4 };

describe('which notes are targets', () => {
  it('names a chord’s notes by their job', () => {
    expect(summary(chordTargetTones(chord('C', 'dom7')))).toEqual(['C R', 'E 3', 'G 5', 'A# ♭7']);
    expect(chordTargetTones(chord('A', 'min7')).map((tone) => tone.role)).toEqual([
      'root',
      'third',
      'fifth',
      'seventh',
    ]);
  });

  it('the blues in every key: each change aims at the next chord’s 3rd and ♭7, all of them new', () => {
    for (const key of KEYS) {
      const I7 = chord(key, 'dom7');
      const IV7 = chord(up(key, 5), 'dom7');
      const V7 = chord(up(key, 7), 'dom7');
      // I7 to IV7: the 3rd and ♭7 of IV7, each a half step under one of I7's guide tones
      const toFour = targetTones(IV7, I7);
      expect(summary(toFour)).toEqual([`${up(key, 9)} 3`, `${up(key, 3)} ♭7`]);
      const guideOfOne = [noteToSemitone(up(key, 4)), noteToSemitone(up(key, 10))];
      for (const tone of toFour) {
        expect(guideOfOne.some((pc) => (pc - tone.pc + 12) % 12 === 1)).toBe(true);
      }
      // IV7 back to I7, I7 to V7, V7 to IV7, and V7 round the top to I7
      expect(summary(targetTones(I7, IV7))).toEqual([`${up(key, 4)} 3`, `${up(key, 10)} ♭7`]);
      expect(summary(targetTones(V7, I7))).toEqual([`${up(key, 11)} 3`, `${up(key, 5)} ♭7`]);
      expect(summary(targetTones(IV7, V7))).toEqual([`${up(key, 9)} 3`, `${up(key, 3)} ♭7`]);
      expect(summary(targetTones(I7, V7))).toEqual([`${up(key, 4)} 3`, `${up(key, 10)} ♭7`]);
    }
  });

  it('ii–V–I in every key: the 3rd is new and the 7th is held from the chord before', () => {
    for (const key of KEYS) {
      const ii = chord(up(key, 2), 'min7');
      const V = chord(up(key, 7), 'dom7');
      const I = chord(key, 'maj7');
      // G7 from Dm7: B is new, F was Dm7's 3rd
      expect(summary(targetTones(V, ii))).toEqual([`${up(key, 11)} 3`, `${up(key, 5)} ♭7 held`]);
      // Cmaj7 from G7: E is new, B was G7's 3rd
      expect(summary(targetTones(I, V))).toEqual([`${up(key, 4)} 3`, `${up(key, 11)} 7 held`]);
      // and the new 3rd is a half step under the old 7th both times
      expect(apart(noteToSemitone(up(key, 11)), noteToSemitone(up(key, 0)))).toBe(1);
      expect(apart(noteToSemitone(up(key, 4)), noteToSemitone(up(key, 5)))).toBe(1);
    }
  });

  it('when no guide tone is new, the notes that change are added (I to vi, in every key)', () => {
    for (const key of KEYS) {
      const I = chord(key, 'major');
      const vi = chord(up(key, 9), 'minor');
      // A minor from C: its 3rd is C, which C major has; the A is what changes
      expect(summary(targetTones(vi, I))).toEqual([`${key} ♭3 held`, `${up(key, 9)} R`]);
      // C from A minor: E is held, the G is new
      expect(summary(targetTones(I, vi))).toEqual([`${up(key, 4)} 3 held`, `${up(key, 7)} 5`]);
    }
    // the major-3rd cycle: both guide tones of A♭maj7 are in Cmaj7, so its root and 5th are added
    expect(summary(targetTones(chord('G#', 'maj7'), chord('C', 'maj7')))).toEqual([
      'C 3 held',
      'G 7 held',
      'G# R',
      'D# 5',
    ]);
  });

  it('a triad has one guide tone, and the count-in (no chord yet) holds nothing', () => {
    for (const key of KEYS) {
      expect(summary(targetTones(chord(key, 'major'), chord(up(key, 7), 'major')))).toEqual([
        `${up(key, 4)} 3`,
      ]);
      expect(summary(targetTones(chord(key, 'minor'), null))).toEqual([`${up(key, 3)} ♭3`]);
      expect(summary(targetTones(chord(key, 'dom7'), null))).toEqual([
        `${up(key, 4)} 3`,
        `${up(key, 10)} ♭7`,
      ]);
    }
  });

  it('a prompt’s focus picks among them', () => {
    const C7 = chord('C', 'dom7');
    const F7 = chord('F', 'dom7');
    expect(summary(targetTones(F7, C7, { kind: 'thirds' }))).toEqual(['A 3']);
    expect(summary(targetTones(F7, C7, { kind: 'sevenths' }))).toEqual(['D# ♭7']);
    // only the notes that change: F7 has C already
    expect(summary(targetTones(F7, C7, { kind: 'changes' }))).toEqual(['F R', 'A 3', 'D# ♭7']);
    expect(targetTones(F7, C7, { kind: 'none' })).toEqual([]);
    // a triad has no 7th: its 3rd stands in
    expect(summary(targetTones(chord('F', 'major'), C7, { kind: 'sevenths' }))).toEqual(['A 3']);
    // nothing changes into a chord whose notes are all here: the guide tones, held
    expect(summary(targetTones(chord('E', 'minor'), chord('C', 'maj7'), { kind: 'changes' }))).toEqual([
      'G ♭3 held',
    ]);
    // one string keeps the guide tones; the string is the placing's business
    expect(summary(targetTones(F7, C7, { kind: 'string', string: 1 }))).toEqual(
      summary(targetTones(F7, C7, GUIDE_FOCUS)),
    );
  });
});

describe('where they are', () => {
  it('the window is the shape’s frets and one more each side, at least four frets, stopped by the nut', () => {
    expect(reachWindow(5, 7)).toEqual({ lo: 4, hi: 8 });
    expect(reachWindow(0, 3)).toEqual({ lo: 0, hi: 4 });
    expect(reachWindow(0, 2)).toEqual({ lo: 0, hi: 3 });
    expect(reachWindow(1, 3)).toEqual({ lo: 0, hi: 4 });
    // a one-fret shape still gets four frets
    expect(reachWindow(0, 0)).toEqual({ lo: 0, hi: 3 });
    expect(reachWindow(24, 24)).toEqual({ lo: 21, hi: 24 });
  });

  it('C7 to F7 in the open position: E♭ on the B and D strings, A on the G string', () => {
    const targets = landingTargets({ next: chord('F', 'dom7'), current: chord('C', 'dom7'), window: OPEN });
    expect(targets.map((t) => `${t.label} ${t.string}:${t.fret}`)).toEqual(['♭7 1:4', '3 2:2', '♭7 3:1']);
    expect(targets.every((t) => !t.held)).toBe(true);
  });

  it('every place in the window is ringed, on the four melody strings only', () => {
    // G7 from Dm7 in frets 0 to 4: B on the open B string and G 4; F on e 1 and D 3
    const targets = landingTargets({ next: chord('G', 'dom7'), current: chord('D', 'min7'), window: OPEN });
    expect(targets.map((t) => `${t.note} ${t.string}:${t.fret}${t.held ? ' held' : ''}`)).toEqual([
      'F 0:1 held',
      'B 1:0',
      'B 2:4',
      'F 3:3 held',
    ]);
    expect(targets.every((t) => MELODY_STRINGS.includes(t.string))).toBe(true);
  });

  it('four frets on the melody strings hold every note, wherever the window is', () => {
    for (let lo = 0; lo <= 21; lo += 1) {
      for (let pc = 0; pc < 12; pc += 1) {
        const tone = { ...chordTargetTones(chord(semitoneToNote(pc), 'major'))[0], held: false };
        const placed = placeTargets([tone], { lo, hi: lo + 3 });
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.every((t) => t.fret >= lo && t.fret <= lo + 3)).toBe(true);
      }
    }
  });

  it('a note with no place in the window takes the nearest one outside it', () => {
    const [a] = chordTargetTones(chord('A', 'major'));
    // the B string between frets 3 and 5 has no A: fret 10 is the nearest
    expect(placeTargets([a], { lo: 3, hi: 5 }, [1]).map((t) => t.fret)).toEqual([10]);
    // on the G string A is at fret 2, one below the window, and at 14
    expect(placeTargets([a], { lo: 3, hi: 5 }, [2]).map((t) => t.fret)).toEqual([2]);
  });

  it('one string: the guide tones along it from the open string to fret 15', () => {
    for (const string of [1, 2]) {
      const targets = landingTargets({
        next: chord('F', 'dom7'),
        current: chord('C', 'dom7'),
        window: OPEN,
        focus: { kind: 'string', string },
      });
      expect(targets.every((t) => t.string === string && t.fret <= ONE_STRING_TOP_FRET)).toBe(true);
      expect(new Set(targets.map((t) => t.note))).toEqual(new Set(['A', 'D#']));
    }
    // B string: E♭ at 4, A at 10; G string: A at 2 and 14, E♭ at 8
    expect(
      landingTargets({ next: chord('F', 'dom7'), current: null, window: OPEN, focus: { kind: 'string', string: 1 } }).map((t) => t.fret),
    ).toEqual([4, 10]);
    expect(
      landingTargets({ next: chord('F', 'dom7'), current: null, window: OPEN, focus: { kind: 'string', string: 2 } }).map((t) => t.fret),
    ).toEqual([2, 8, 14]);
  });
});

describe('every library entry in all 12 keys', () => {
  const FOCI: TargetFocus[] = [GUIDE_FOCUS, { kind: 'thirds' }, { kind: 'changes' }];

  /** Each change that is one bar away, with the windows it is looked for in: in place, and each Climb region. */
  const changes = (id: string, key: NoteName) => {
    const steps = stepsOf(id, key);
    const chords = jamChordsOf(steps);
    const saved = buildSavedProgressionChordViews(steps, id, {}, 'sharps');
    const plan = buildClimbPlan(steps, { direction: 'up', start: 0 });
    const out: { current: TargetChord; next: TargetChord; windows: FretWindow[] }[] = [];
    steps.forEach((current, index) => {
      const change = nextChange(index, chords);
      if (!change || change.bars !== 1) return;
      const at = change.stepIndex;
      const windows = [reachWindow(saved[at].startFret, saved[at].endFret)];
      for (let region = 0; plan && region < plan.regions.length; region += 1) {
        const shape = climbShapesAt(plan, region * plan.passesPerRegion)[at];
        windows.push(reachWindow(shape.startFret, shape.endFret));
      }
      out.push({ current, next: steps[at], windows });
    });
    return out;
  };

  it('every target is a note of the next chord, on a melody string, inside the window', () => {
    let checked = 0;
    for (const entry of PROGRESSION_LIBRARY) {
      for (const key of KEYS) {
        for (const { current, next, windows } of changes(entry.id, key)) {
          const nextPcs = pcs(next);
          const nowPcs = pcs(current);
          for (const window of windows) {
            expect(window.hi - window.lo).toBeGreaterThanOrEqual(3);
            expect(window.hi - window.lo).toBeLessThanOrEqual(4);
            for (const focus of FOCI) {
              const tones = targetTones(next, current, focus);
              const targets = landingTargets({ next, current, window, focus });
              expect(targets.length).toBeGreaterThan(0);
              expect(targets.length).toBeLessThanOrEqual(8);
              for (const target of targets) {
                const pc = noteToSemitone(target.note);
                expect(target.note).toBe(getNoteAt(target.string, target.fret));
                expect(nextPcs.has(pc)).toBe(true);
                expect(MELODY_STRINGS.includes(target.string)).toBe(true);
                expect(target.fret >= window.lo && target.fret <= window.hi).toBe(true);
                // held means the chord now has it too; new means it does not
                expect(target.held).toBe(nowPcs.has(pc));
              }
              // every note that was picked is somewhere in the window
              expect(new Set(targets.map((t) => noteToSemitone(t.note)))).toEqual(
                new Set(tones.map((tone) => tone.pc)),
              );
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it('a change you can hear: at least one target is new, unless the next chord’s notes are all here', () => {
    let noneNew = 0;
    let total = 0;
    for (const entry of PROGRESSION_LIBRARY) {
      for (const key of KEYS) {
        for (const { current, next } of changes(entry.id, key)) {
          total += 1;
          const tones = targetTones(next, current);
          const guide = tones.filter((tone) => tone.role === 'third' || tone.role === 'seventh');
          expect(guide.length).toBeGreaterThanOrEqual(1);
          expect(guide.length).toBeLessThanOrEqual(2);
          if (guide.every((tone) => tone.held)) noneNew += 1;
          const subset = [...pcs(next)].every((pc) => pcs(current).has(pc));
          expect(tones.some((tone) => !tone.held)).toBe(!subset);
        }
      }
    }
    // the spec's count: 156 of the 996 changes move neither guide tone
    expect([total, noneNew]).toEqual([996, 156]);
  });
});

describe('when they show', () => {
  it('a whole bar before the change, and at least two seconds at fast tempos, up to two bars', () => {
    expect([60, 90, 120, 150, 180, 200, 240, 300].map((bpm) => targetLeadBeats(bpm))).toEqual([
      4, 4, 4, 5, 6, 7, 8, 8,
    ]);
  });

  it('coming through the lead, arriving on the last beat, hidden before and after', () => {
    expect([5, 4, 3, 2, 1, 0].map((beats) => targetPhase(beats, 90))).toEqual([
      'hidden',
      'coming',
      'coming',
      'coming',
      'arriving',
      'hidden',
    ]);
    expect(targetPhase(7, 200)).toBe('coming');
    expect(targetPhase(8, 200)).toBe('hidden');
  });
});

describe('the cue from the loop’s clock', () => {
  const blues = stepsOf('blues-12', 'C');
  const chords = jamChordsOf(blues);
  const windowAt = () => OPEN;
  const at = (bar: number, beat: number, extra: Partial<CueClock> = {}): CueClock => {
    const stepIndex = bar % blues.length;
    return {
      playing: true,
      countIn: false,
      stepIndex,
      beat,
      pass: Math.floor(bar / blues.length),
      next: nextChange(stepIndex, chords),
      ...extra,
    };
  };
  const cue = (clock: CueClock, bpm = 90, loop = true, focusAt?: (pass: number) => TargetFocus) =>
    landingCue({ clock, chords: blues, loop, bpm, windowAt, focusAt });

  it('the count-in aims at the first chord, for the whole bar, and arrives on its last beat', () => {
    const counting = (beat: number) =>
      cue({ playing: true, countIn: true, stepIndex: 0, beat, pass: 0, next: null });
    expect(counting(0)?.phase).toBe('coming');
    expect(counting(3)?.phase).toBe('arriving');
    expect(counting(0)?.stepIndex).toBe(0);
    expect(new Set(counting(0)?.targets.map((t) => t.note))).toEqual(new Set(['E', 'A#']));
    expect(counting(0)?.targets.every((t) => !t.held)).toBe(true);
  });

  it('four bars of I7: nothing to aim for until the fourth', () => {
    for (const bar of [0, 1, 2]) {
      for (const beat of [0, 1, 2, 3]) expect(cue(at(bar, beat))).toBeNull();
    }
    expect(cue(at(3, 0))?.phase).toBe('coming');
    expect(cue(at(3, 2))?.phase).toBe('coming');
    expect(cue(at(3, 3))?.phase).toBe('arriving');
    expect(cue(at(3, 0))?.stepIndex).toBe(4);
    expect(new Set(cue(at(3, 0))?.targets.map((t) => t.note))).toEqual(new Set(['A', 'D#']));
  });

  it('at 200 BPM the rings come seven beats early: from beat 2 of the bar before', () => {
    expect(cue(at(2, 0), 200)).toBeNull();
    expect(cue(at(2, 1), 200)?.phase).toBe('coming');
    expect(cue(at(3, 3), 200)?.phase).toBe('arriving');
    // but never before the chord now has begun: bar 9 (G7) only has its own bar
    expect(cue(at(8, 0), 200)?.stepIndex).toBe(9);
  });

  it('the last bar aims at the next pass: its window and its prompt', () => {
    const asked: [number, number][] = [];
    const turnaround = landingCue({
      clock: at(11, 0),
      chords: blues,
      loop: true,
      bpm: 90,
      windowAt: (pass, stepIndex) => {
        asked.push([pass, stepIndex]);
        return OPEN;
      },
      focusAt: (pass) => (pass === 1 ? { kind: 'thirds' } : GUIDE_FOCUS),
    });
    expect(asked).toEqual([[1, 0]]);
    expect(turnaround?.pass).toBe(1);
    expect(turnaround?.stepIndex).toBe(0);
    // pass 2's prompt is the 3rds, so only E is ringed
    expect(new Set(turnaround?.targets.map((t) => t.note))).toEqual(new Set(['E']));
    // inside a pass the window and the prompt are this pass's
    expect(cue(at(3, 0), 90, true, (pass) => (pass === 1 ? { kind: 'thirds' } : GUIDE_FOCUS))?.pass).toBe(0);
  });

  it('with Loop off the last bar has no cue, and a one-chord loop never has one', () => {
    expect(cue(at(11, 3), 90, false)).toBeNull();
    expect(cue(at(10, 3), 90, false)?.stepIndex).toBe(11);
    const vamp = [blues[0], blues[0]];
    expect(
      landingCue({
        clock: { playing: true, countIn: false, stepIndex: 1, beat: 3, pass: 0, next: nextChange(1, jamChordsOf(vamp)) },
        chords: vamp,
        loop: true,
        bpm: 90,
        windowAt,
      }),
    ).toBeNull();
  });

  it('stopped, a chord with no shape, and "by ear" all show nothing', () => {
    expect(cue({ ...at(3, 3), playing: false })).toBeNull();
    expect(landingCue({ clock: at(3, 3), chords: blues, loop: true, bpm: 90, windowAt: () => null })).toBeNull();
    expect(cue(at(3, 3), 90, true, () => ({ kind: 'none' }))).toBeNull();
  });

  it('Climb: at the end of a pass that moves, the rings are in the next region (the blues in D)', () => {
    const steps = stepsOf('blues-12', 'D');
    const plan = buildClimbPlan(steps, { direction: 'up', start: 0 })!;
    const climbWindow = (pass: number, stepIndex: number) => {
      const shape = climbShapesAt(plan, pass)[stepIndex];
      return reachWindow(shape.startFret, shape.endFret);
    };
    const clock = { playing: true, countIn: false, stepIndex: 11, beat: 0, pass: 0, next: nextChange(11, jamChordsOf(steps)) };
    const moved = landingCue({ clock, chords: steps, loop: true, bpm: 90, windowAt: climbWindow });
    // pass 1 is at frets 0 to 3; D7's targets for pass 2 are at frets 4 to 8
    expect(moved?.targets.map((t) => `${t.note} ${t.string}:${t.fret}`)).toEqual([
      'C 0:8',
      'F# 1:7',
      'C 2:5',
      'F# 3:4',
    ]);
    // a change inside the pass stays in the pass's own region
    const inside = landingCue({
      clock: { ...clock, stepIndex: 3, next: nextChange(3, jamChordsOf(steps)) },
      chords: steps,
      loop: true,
      bpm: 90,
      windowAt: climbWindow,
    });
    expect(inside?.targets.every((t) => t.fret <= 4)).toBe(true);
  });
});
