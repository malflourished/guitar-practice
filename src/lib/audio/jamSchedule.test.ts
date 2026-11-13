import { describe, expect, it } from 'vitest';
import type { NoteName } from '../../types/music';
import {
  PROGRESSION_LIBRARY,
  entryToProgressionDef,
  getChordIntervals,
  getProgressionLibraryEntry,
  noteToSemitone,
  progressionFeel,
  resolveProgression,
} from '../music';
import {
  BASS_LOW,
  SWING_OFFSET,
  buildJamBar,
  chordFifthPc,
  jamBarStep,
  jamPosition,
  bassMidi,
  isTopOfForm,
  nextChange,
  type GuitarRhythm,
  type JamChord,
  type JamEvent,
} from './jamSchedule';
import { PAD_HIGH, PAD_LOW, chordPitchClasses, leadPadVoicings, voiceMoves } from './padVoicing';

const KEYS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const bar = { guitar: 'quarter', pad: false, feel: 'straight', click: false } as const;

type Strum = Extract<JamEvent, { kind: 'strum' }>;
type Bass = Extract<JamEvent, { kind: 'bass' }>;
const strumsOf = (events: JamEvent[]) => events.filter((e): e is Strum => e.kind === 'strum');
const bassOf = (events: JamEvent[]) => events.filter((e): e is Bass => e.kind === 'bass');

const resolved = (id: string, key: NoteName) =>
  resolveProgression(key, entryToProgressionDef(getProgressionLibraryEntry(id)!), 'sharps');
const pitchClassesOf = (id: string, key: NoteName) =>
  resolved(id, key).map((step) =>
    chordPitchClasses(noteToSemitone(step.root), getChordIntervals(step.quality)),
  );

describe('buildJamBar: the guitar', () => {
  it('Whole is one strum at beat 0; Half is strums at 0 and 2; Quarter is 0 to 3', () => {
    const beats = (guitar: GuitarRhythm) =>
      strumsOf(buildJamBar({ rootPc: 0 }, { ...bar, guitar })).map((s) => s.beat);
    expect(beats('whole')).toEqual([0]);
    expect(beats('half')).toEqual([0, 2]);
    expect(beats('quarter')).toEqual([0, 1, 2, 3]);
  });

  it('Off has no strums, in any feel', () => {
    for (const feel of ['straight', 'swing'] as const) {
      expect(strumsOf(buildJamBar({ rootPc: 0 }, { ...bar, guitar: 'off', feel }))).toHaveLength(0);
    }
  });

  it('accents: beat 0 loudest, beat 2 at 0.8 in Half, the other down-strums softer', () => {
    const half = strumsOf(buildJamBar({ rootPc: 0 }, { ...bar, guitar: 'half' }));
    expect(half.map((s) => s.velocity)).toEqual([1, 0.8]);
    const quarter = strumsOf(buildJamBar({ rootPc: 0 }, bar));
    expect(quarter.every((s) => !s.up)).toBe(true);
    for (const other of quarter.slice(1)) expect(other.velocity).toBeLessThan(quarter[0].velocity);
  });

  it('Swing adds an up-strum 2/3 after each down-strum on Quarter, softer than the downs', () => {
    const strums = strumsOf(buildJamBar({ rootPc: 0 }, { ...bar, feel: 'swing' }));
    const downs = strums.filter((s) => !s.up);
    const ups = strums.filter((s) => s.up);
    expect(downs.map((s) => s.beat)).toEqual([0, 1, 2, 3]);
    expect(ups.map((s) => s.beat)).toEqual(downs.map((s) => s.beat + SWING_OFFSET));
    for (const up of ups) for (const down of downs) expect(up.velocity).toBeLessThan(down.velocity);
    // Whole and Half keep their strums; the swing is in the bass
    expect(strumsOf(buildJamBar({ rootPc: 0 }, { ...bar, guitar: 'half', feel: 'swing' }))).toHaveLength(2);
  });

  it('Pad On adds one pad event for the bar, Pad Off none', () => {
    const on = buildJamBar({ rootPc: 0, padMidis: [55, 59, 62] }, { ...bar, pad: true });
    expect(on.filter((e) => e.kind === 'pad')).toEqual([{ kind: 'pad', beat: 0, midis: [55, 59, 62], duration: 4 }]);
    expect(buildJamBar({ rootPc: 0, padMidis: [55, 59, 62] }, bar).some((e) => e.kind === 'pad')).toBe(false);
    // the pad sounds alone when the guitar is off
    const alone = buildJamBar({ rootPc: 0, padMidis: [55] }, { ...bar, guitar: 'off', pad: true });
    expect(alone.map((e) => e.kind)).toContain('pad');
    expect(alone.map((e) => e.kind)).not.toContain('strum');
  });

  it('the click is on every beat when asked, with beat 0 accented', () => {
    const clicks = buildJamBar({ rootPc: 0 }, { ...bar, click: true }).filter((e) => e.kind === 'click');
    expect(clicks.map((e) => e.kind === 'click' && e.accent)).toEqual([true, false, false, false]);
    expect(buildJamBar({ rootPc: 0 }, bar).some((e) => e.kind === 'click')).toBe(false);
  });

  it('the top of the form adds one cymbal on beat 0, whether or not the click is on', () => {
    const cymbals = (options: { click: boolean; cymbal?: boolean }) =>
      buildJamBar({ rootPc: 0 }, { ...bar, ...options }).filter((e) => e.kind === 'cymbal');
    expect(cymbals({ click: false, cymbal: true })).toEqual([{ kind: 'cymbal', beat: 0 }]);
    expect(cymbals({ click: true, cymbal: true })).toEqual([{ kind: 'cymbal', beat: 0 }]);
    expect(cymbals({ click: false })).toHaveLength(0);
    expect(cymbals({ click: false, cymbal: false })).toHaveLength(0);
  });
});

describe('buildJamBar: the bass', () => {
  it('the root on beat 0 and the 5th on beat 2, inside MIDI 27 to 39, in all 12 keys', () => {
    for (let pc = 0; pc < 12; pc++) {
      const notes = bassOf(buildJamBar({ rootPc: pc }, bar));
      expect(notes.map((b) => b.beat)).toEqual([0, 2]);
      expect(notes[0].midi % 12).toBe(pc);
      expect(notes[1].midi % 12).toBe((pc + 7) % 12);
      for (const note of notes) {
        expect(note.midi).toBeGreaterThanOrEqual(27);
        expect(note.midi).toBeLessThanOrEqual(39);
      }
    }
  });

  it('a chord’s own 5th: a diminished chord plays its ♭5', () => {
    const fifth = chordFifthPc(2, getChordIntervals('m7b5'));
    expect(fifth).toBe(8);
    const notes = bassOf(buildJamBar({ rootPc: 2, fifthPc: fifth }, bar));
    expect(notes[1].midi % 12).toBe(8);
    expect(chordFifthPc(0, getChordIntervals('dom7'))).toBe(7);
  });

  it('a slash chord plays its bass on both beats (the Lydian float’s II/I)', () => {
    for (const key of KEYS) {
      const step = resolved('lydian-float', key)[1];
      const rootPc = noteToSemitone(step.root);
      const bassPc = noteToSemitone(step.bass!);
      expect(bassPc).not.toBe(rootPc);
      const notes = bassOf(buildJamBar({ rootPc, bassPc }, bar));
      expect(notes.map((b) => b.midi % 12)).toEqual([bassPc, bassPc]);
    }
  });

  it('Swing adds one pickup at 3 + 2/3, a half step below the next bar’s bass; Straight has none', () => {
    for (let pc = 0; pc < 12; pc++) {
      const nextBassPc = (pc + 5) % 12;
      const swung = bassOf(buildJamBar({ rootPc: pc, nextBassPc }, { ...bar, feel: 'swing' }));
      const pickups = swung.filter((b) => b.beat > 2);
      expect(pickups).toHaveLength(1);
      expect(pickups[0].beat).toBeCloseTo(3 + 2 / 3);
      expect(pickups[0].midi).toBe(bassMidi(nextBassPc) - 1);
      for (const note of swung) {
        expect(note.midi).toBeGreaterThanOrEqual(27);
        expect(note.midi).toBeLessThanOrEqual(39);
      }
      expect(bassOf(buildJamBar({ rootPc: pc, nextBassPc }, bar))).toHaveLength(2);
    }
  });

  it('the pickup leans into the next chord: jamBarStep hands it the next bar’s bass, wrapping', () => {
    const chords = [{ rootPc: 0, quality: 'major' }, { rootPc: 2, quality: 'major', bassPc: 0 }];
    expect(jamBarStep(chords, 0).nextBassPc).toBe(0);
    expect(jamBarStep(chords, 1).nextBassPc).toBe(0);
    const blues = [{ rootPc: 0, quality: 'dom7' }, { rootPc: 5, quality: 'dom7' }];
    expect(jamBarStep(blues, 0).nextBassPc).toBe(5);
    expect(jamBarStep(blues, 1).nextBassPc).toBe(0);
  });
});

describe('pad voice-leading', () => {
  for (const id of ['turnaround-1625', 'blues-12']) {
    it(`${id}: every chord in MIDI ${PAD_LOW}–${PAD_HIGH}; no voice moves more than 5 semitones, wrap included`, () => {
      for (const key of KEYS) {
        const chords = pitchClassesOf(id, key);
        const voicings = leadPadVoicings(chords);
        expect(voicings).toHaveLength(chords.length);
        voicings.forEach((notes, i) => {
          expect(notes.map((m) => m % 12).sort((a, b) => a - b)).toEqual(
            [...chords[i]].sort((a, b) => a - b),
          );
          for (const midi of notes) {
            expect(midi).toBeGreaterThanOrEqual(PAD_LOW);
            expect(midi).toBeLessThanOrEqual(PAD_HIGH);
          }
          const next = voicings[(i + 1) % voicings.length];
          expect(Math.max(...voiceMoves(notes, next))).toBeLessThanOrEqual(5);
        });
      }
    });
  }
});

describe('jamPosition', () => {
  const chord = (rootPc: number, quality = 'dom7', bassPc?: number): JamChord => ({ rootPc, quality, bassPc });
  // C blues: I I I I IV IV I I V IV I V
  const blues = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((pc) => chord(pc));
  const turnaround = [chord(0, 'maj7'), chord(9, 'min7'), chord(2, 'min7'), chord(7)];

  it('12-bar blues: changeComing is false on bars 1 to 3 and true on bar 4', () => {
    const coming = Array.from({ length: 12 }, (_, bar) => jamPosition(bar, blues).changeComing);
    expect(coming.slice(0, 3)).toEqual([false, false, false]);
    expect(coming[3]).toBe(true);
    expect(coming).toEqual([false, false, false, true, false, true, false, true, true, true, true, true]);
  });

  it('12-bar blues: nextStepIndex follows the bar and wraps to 0 after bar 12', () => {
    const next = Array.from({ length: 13 }, (_, bar) => jamPosition(bar, blues).nextStepIndex);
    expect(next).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1]);
    expect(jamPosition(11, blues)).toMatchObject({ stepIndex: 11, nextStepIndex: 0, pass: 0 });
    expect(jamPosition(12, blues)).toMatchObject({ stepIndex: 0, nextStepIndex: 1, pass: 1 });
  });

  it('a four-bar loop: nextStepIndex wraps 3 to 0, and every bar leads to a new chord', () => {
    const positions = [0, 1, 2, 3, 4, 5].map((bar) => jamPosition(bar, turnaround));
    expect(positions.map((p) => p.stepIndex)).toEqual([0, 1, 2, 3, 0, 1]);
    expect(positions.map((p) => p.nextStepIndex)).toEqual([1, 2, 3, 0, 1, 2]);
    expect(positions.map((p) => p.pass)).toEqual([0, 0, 0, 0, 1, 1]);
    expect(positions.every((p) => p.changeComing)).toBe(true);
  });

  it('a slash bass counts as a change; a one-chord loop never changes', () => {
    expect(jamPosition(0, [chord(0, 'major'), chord(0, 'major', 7)]).changeComing).toBe(true);
    expect(jamPosition(0, [chord(0, 'major')]).changeComing).toBe(false);
  });
});

describe('nextChange', () => {
  const chord = (rootPc: number, quality = 'dom7', bassPc?: number): JamChord => ({ rootPc, quality, bassPc });
  // C blues: I I I I IV IV I I V IV I V
  const blues = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((pc) => chord(pc));

  it('12-bar blues: from bar 1 the next change is F7 in 4 bars, counting down to 1 on bar 4', () => {
    expect(nextChange(0, blues)).toEqual({ stepIndex: 4, bars: 4 });
    expect([0, 1, 2, 3].map((step) => nextChange(step, blues)!.bars)).toEqual([4, 3, 2, 1]);
    expect(nextChange(1, blues)).toEqual({ stepIndex: 4, bars: 3 });
  });

  it('12-bar blues: from bar 12 the next change is C7 next bar, wrapping round the top', () => {
    expect(nextChange(11, blues)).toEqual({ stepIndex: 0, bars: 1 });
  });

  it('12-bar blues, every bar: the step it names really is a different chord, `bars` away', () => {
    blues.forEach((here, step) => {
      const next = nextChange(step, blues)!;
      expect(next.stepIndex).toBe((step + next.bars) % blues.length);
      expect(blues[next.stepIndex].rootPc).not.toBe(here.rootPc);
      for (let skipped = 1; skipped < next.bars; skipped++) {
        expect(blues[(step + skipped) % blues.length].rootPc).toBe(here.rootPc);
      }
    });
    // after the V in bar 9 comes the IV; the I in bars 7 and 8 holds two bars
    expect(nextChange(8, blues)).toEqual({ stepIndex: 9, bars: 1 });
    expect(nextChange(6, blues)).toEqual({ stepIndex: 8, bars: 2 });
  });

  it('a four-bar loop: every bar leads straight to the next, and bar 4 wraps to bar 1', () => {
    const turnaround = [chord(0, 'maj7'), chord(9, 'min7'), chord(2, 'min7'), chord(7)];
    expect([0, 1, 2, 3].map((step) => nextChange(step, turnaround))).toEqual([
      { stepIndex: 1, bars: 1 },
      { stepIndex: 2, bars: 1 },
      { stepIndex: 3, bars: 1 },
      { stepIndex: 0, bars: 1 },
    ]);
  });

  it('ii–V–I: the I held two bars is two bars from the ii at the top', () => {
    const chords = [chord(2, 'min7'), chord(7), chord(0, 'maj7'), chord(0, 'maj7')];
    expect(nextChange(2, chords)).toEqual({ stepIndex: 0, bars: 2 });
    expect(nextChange(3, chords)).toEqual({ stepIndex: 0, bars: 1 });
  });

  it('a change of quality or of slash bass counts, as it does for changeComing', () => {
    expect(nextChange(0, [chord(0, 'major'), chord(0, 'dom7')])).toEqual({ stepIndex: 1, bars: 1 });
    expect(nextChange(0, [chord(0, 'major'), chord(0, 'major', 7)])).toEqual({ stepIndex: 1, bars: 1 });
  });

  it('a one-chord loop has no change to wait for, nor does an empty one', () => {
    expect(nextChange(0, [chord(0)])).toBeNull();
    expect(nextChange(1, [chord(0), chord(0), chord(0)])).toBeNull();
    expect(nextChange(0, [])).toBeNull();
  });

  it('a step past the end counts round the loop, as jamPosition does', () => {
    expect(nextChange(12, blues)).toEqual(nextChange(0, blues));
    expect(nextChange(23, blues)).toEqual(nextChange(11, blues));
  });

  it('agrees with jamPosition: a change is coming exactly when the next change is one bar away', () => {
    const library = ['blues-12', 'blues-minor', 'jazz-251', 'turnaround-1625'].map(
      (id) =>
        resolveProgression('C', entryToProgressionDef(getProgressionLibraryEntry(id)!), 'sharps').map(
          (step): JamChord => ({
            rootPc: noteToSemitone(step.root),
            quality: step.quality,
            bassPc: step.bass ? noteToSemitone(step.bass) : undefined,
          }),
        ),
    );
    for (const chords of library) {
      chords.forEach((_, step) => {
        expect(jamPosition(step, chords).changeComing).toBe(nextChange(step, chords)?.bars === 1);
      });
    }
  });
});

describe('isTopOfForm: where the cymbal goes', () => {
  const chord = (rootPc: number, quality = 'dom7'): JamChord => ({ rootPc, quality });
  const blues = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((pc) => chord(pc));
  const barsWithCymbal = (chords: JamChord[], bars: number) =>
    Array.from({ length: bars }, (_, bar) => bar).filter((bar) => isTopOfForm(jamPosition(bar, chords)));

  it('12-bar blues: nothing in the first pass, then bar 1 of every pass: bars 13, 25, 37 (counting from 1)', () => {
    expect(barsWithCymbal(blues, 48).map((bar) => bar + 1)).toEqual([13, 25, 37]);
  });

  it('never in the first pass, not even on its first bar', () => {
    expect(isTopOfForm(jamPosition(0, blues))).toBe(false);
    for (let bar = 0; bar < 12; bar++) expect(isTopOfForm(jamPosition(bar, blues))).toBe(false);
  });

  it('only on the first bar of a pass, never the other eleven', () => {
    for (let bar = 12; bar < 24; bar++) {
      expect(isTopOfForm(jamPosition(bar, blues)), `bar ${bar + 1}`).toBe(bar === 12);
    }
  });

  it('a four-bar loop crashes on every fifth bar from the fifth, a two-bar vamp every other bar', () => {
    const turnaround = [chord(0, 'maj7'), chord(9, 'min7'), chord(2, 'min7'), chord(7)];
    expect(barsWithCymbal(turnaround, 13).map((bar) => bar + 1)).toEqual([5, 9, 13]);
    const vamp = [chord(0), chord(5)];
    expect(barsWithCymbal(vamp, 8).map((bar) => bar + 1)).toEqual([3, 5, 7]);
  });
});

describe('library feel', () => {
  it('every entry’s feel is undefined, straight or swing', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      expect([undefined, 'straight', 'swing']).toContain(entry.feel);
    }
  });

  it('the six swing entries swing; every other entry is straight', () => {
    const swing = ['blues-12', 'blues-minor', 'jazz-251', 'turnaround-1625', 'backdoor', 'tritone-sub'];
    for (const id of swing) expect(getProgressionLibraryEntry(id)!.feel).toBe('swing');
    for (const entry of PROGRESSION_LIBRARY) {
      expect(progressionFeel(entry)).toBe(swing.includes(entry.id) ? 'swing' : 'straight');
    }
  });
});

describe('the spec’s numbers', () => {
  it('swing lands 2/3 through the beat; the bass starts at MIDI 28; the pad stays in MIDI 52 to 67', () => {
    expect(SWING_OFFSET).toBeCloseTo(2 / 3);
    expect(BASS_LOW).toBe(28);
    expect(bassMidi(0)).toBe(36);
    expect([PAD_LOW, PAD_HIGH]).toEqual([52, 67]);
  });
});
