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
  bassMidi,
  buildJamBar,
  jamPosition,
  type JamChord,
  type JamEvent,
} from './jamSchedule';
import { PAD_HIGH, PAD_LOW, chordPitchClasses, leadPadVoicings, voiceMoves } from './padVoicing';

const KEYS: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const strumBar = { backing: 'strum', feel: 'straight', click: false } as const;

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

describe('buildJamBar', () => {
  it('straight: four down-strums on beats 0 to 3, beat 0 louder than the rest', () => {
    const strums = strumsOf(buildJamBar({ rootPc: 0 }, strumBar));
    expect(strums.map((s) => s.beat)).toEqual([0, 1, 2, 3]);
    expect(strums.every((s) => !s.up)).toBe(true);
    for (const other of strums.slice(1)) expect(other.velocity).toBeLessThan(strums[0].velocity);
  });

  it('swing: also an up-strum 2/3 of the way after each down-strum, softer than the downs', () => {
    const strums = strumsOf(buildJamBar({ rootPc: 0 }, { ...strumBar, feel: 'swing' }));
    const downs = strums.filter((s) => !s.up);
    const ups = strums.filter((s) => s.up);
    expect(downs.map((s) => s.beat)).toEqual([0, 1, 2, 3]);
    expect(ups.map((s) => s.beat)).toEqual(downs.map((s) => s.beat + SWING_OFFSET));
    for (const up of ups) {
      for (const down of downs) expect(up.velocity).toBeLessThan(down.velocity);
    }
  });

  it('bass on beats 0 and 2, inside MIDI 40 to 52, in all 12 keys', () => {
    for (let pc = 0; pc < 12; pc++) {
      const bass = bassOf(buildJamBar({ rootPc: pc }, strumBar));
      expect(bass.map((b) => b.beat)).toEqual([0, 2]);
      for (const note of bass) {
        expect(note.midi).toBeGreaterThanOrEqual(BASS_LOW);
        expect(note.midi).toBeLessThanOrEqual(52);
        expect(note.midi % 12).toBe(pc);
      }
    }
  });

  it('a step with a bass plays it, not the root (the Lydian float’s II/I)', () => {
    for (const key of KEYS) {
      const step = resolved('lydian-float', key)[1];
      expect(step.bass).toBe(key);
      const rootPc = noteToSemitone(step.root);
      const bassPc = noteToSemitone(step.bass!);
      expect(bassPc).not.toBe(rootPc);
      const notes = bassOf(buildJamBar({ rootPc, bassPc }, strumBar));
      expect(notes.map((b) => b.midi % 12)).toEqual([bassPc, bassPc]);
    }
    expect(bassMidi(0)).toBe(48);
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
