import { describe, expect, it } from 'vitest';
import { PROGRESSION_LIBRARY, getProgressionLibraryEntry, progressionFeel, progressionGroove } from '../music';
import {
  DEFAULT_HUMANIZE,
  DRUM_GROOVES,
  MAX_OFFSET_MS,
  buildDrumBar,
  drumPhrase,
  grooveForFeel,
  isSwungGroove,
  passesPerPhrase,
  type DrumBarRequest,
  type DrumGroove,
  type DrumHit,
} from './drumGrooves';
import { BEATS_PER_BAR, SWING_OFFSET, buildJamBar, jamPosition, type JamEvent } from './jamSchedule';
import { DRUM_PIECES, type DrumPiece } from './synth/drums/drumParams';

const GROOVES = DRUM_GROOVES.map((groove) => groove.id);
/** A bar exactly as written: no humanizing. */
const written = (groove: DrumGroove, stepIndex = 0, extra: Partial<DrumBarRequest> = {}) =>
  buildDrumBar({ groove, bar: stepIndex, stepIndex, humanize: 0, ...extra });
const beatsOf = (hits: DrumHit[], piece: DrumPiece) => hits.filter((hit) => hit.piece === piece).map((hit) => hit.beat);
const at = (hits: DrumHit[], piece: DrumPiece, beat: number) => hits.find((hit) => hit.piece === piece && Math.abs(hit.beat - beat) < 1e-9);
const S = SWING_OFFSET;

describe('the grid the drums share with the band', () => {
  it('the swung note is at SWING_OFFSET, two thirds of the beat: the very number the bass and guitar use', () => {
    expect(SWING_OFFSET).toBe(2 / 3);
    // the bass's pickup and the swung grooves' last note are the same moment, to the last bit
    const band = buildJamBar({ rootPc: 0 }, { guitar: 'quarter', pad: false, feel: 'swing', click: false });
    const pickup = band.find((event) => event.kind === 'bass' && event.beat > 3)!;
    const upStrum = band.find((event) => event.kind === 'strum' && event.up && event.beat > 3)!;
    expect(pickup.beat).toBe(3 + SWING_OFFSET);
    expect(upStrum.beat).toBe(3 + SWING_OFFSET);
    expect(beatsOf(written('shuffle'), 'hatClosed')).toContain(pickup.beat);
    expect(beatsOf(written('swing'), 'ride')).toContain(pickup.beat);
  });

  it('swung grooves put every off-beat on a third of a beat, straight grooves on a quarter', () => {
    for (const groove of GROOVES) {
      for (let step = 0; step < 4; step++) {
        for (const fill of [false, true]) {
          for (const hit of written(groove, step, { fill, pass: step, steps: 4 })) {
            const within = hit.beat % 1;
            const allowed = isSwungGroove(groove) ? [0, S / 2, S] : [0, 0.25, 0.5, 0.75];
            expect(allowed.some((value) => Math.abs(value - within) < 1e-9), `${groove} at ${hit.beat}`).toBe(true);
            // the swung "and" is exact, not close: the same float the rest of the jam computes
            if (isSwungGroove(groove) && Math.abs(within - S) < 1e-9) expect(hit.beat).toBe(Math.floor(hit.beat) + SWING_OFFSET);
          }
        }
      }
    }
  });

  it('every stroke is inside its bar, on a piece the kits know, at a velocity from 0 to 1', () => {
    for (const groove of GROOVES) {
      for (let bar = 0; bar < 24; bar++) {
        const hits = buildDrumBar({ groove, bar, stepIndex: bar % 12, pass: Math.floor(bar / 12), steps: 12, fill: bar % 12 === 11, crash: bar === 12, humanize: 1 });
        expect(hits.length).toBeGreaterThan(4);
        for (const hit of hits) {
          expect(hit.beat).toBeGreaterThanOrEqual(0);
          expect(hit.beat).toBeLessThan(BEATS_PER_BAR);
          expect(DRUM_PIECES).toContain(hit.piece);
          expect(hit.velocity).toBeGreaterThan(0);
          expect(hit.velocity).toBeLessThanOrEqual(1);
        }
        // in order, as the engine expects
        expect(hits.map((hit) => hit.beat)).toEqual([...hits.map((hit) => hit.beat)].sort((a, b) => a - b));
      }
    }
  });
});

describe('the grooves', () => {
  it('straight eighths: hi-hat on every eighth, strong then weak; snare on 2 and 4; kick on 1 and 3', () => {
    const first = written('rock8', 0);
    expect(beatsOf(first, 'hatClosed')).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    for (let beat = 0; beat < 4; beat++) {
      expect(at(first, 'hatClosed', beat)!.velocity).toBeGreaterThan(at(first, 'hatClosed', beat + 0.5)!.velocity + 0.2);
    }
    expect(beatsOf(first, 'snare').filter((beat) => at(first, 'snare', beat)!.velocity > 0.6)).toEqual([1, 3]);
    expect(beatsOf(first, 'kick')).toEqual([0, 2, 2.5]);
    // the second bar of the pair moves the extra kick, so two bars make one phrase
    expect(beatsOf(written('rock8', 1), 'kick')).toEqual([0, 1.5, 2]);
    expect(beatsOf(written('rock8', 2), 'kick')).toEqual(beatsOf(first, 'kick'));
    // every fourth bar opens the hi-hat on its last eighth
    expect(beatsOf(written('rock8', 3), 'hatOpen')).toEqual([3.5]);
    for (const step of [0, 1, 2]) expect(beatsOf(written('rock8', step), 'hatOpen')).toEqual([]);
  });

  it('shuffle: the swung pair on every beat, the backbeat on 2 and 4, the kick on 1 and 3', () => {
    const first = written('shuffle', 0);
    expect(beatsOf(first, 'hatClosed')).toEqual([0, S, 1, 1 + S, 2, 2 + S, 3, 3 + S]);
    for (let beat = 0; beat < 4; beat++) {
      expect(at(first, 'hatClosed', beat)!.velocity).toBeGreaterThan(at(first, 'hatClosed', beat + S)!.velocity + 0.2);
    }
    expect(beatsOf(first, 'snare').filter((beat) => at(first, 'snare', beat)!.velocity > 0.6)).toEqual([1, 3]);
    expect(beatsOf(first, 'kick')).toEqual([0, 2]);
    // every other bar the kick joins the bass's pickup into the next bar
    expect(beatsOf(written('shuffle', 1), 'kick')).toEqual([0, 2, 3 + S]);
  });

  it('swing: the ride pattern, the hi-hat’s foot on 2 and 4, a feathered kick, and comping that changes over four bars', () => {
    for (let step = 0; step < 4; step++) {
      const bar = written('swing', step);
      expect(beatsOf(bar, 'ride')).toEqual([0, 1, 1 + S, 2, 3, 3 + S]);
      expect(beatsOf(bar, 'hatFoot')).toEqual([1, 3]);
      expect(beatsOf(bar, 'hatClosed')).toEqual([]);
      // the ride leans on 2 and 4, and its skip note is the softest
      expect(at(bar, 'ride', 1)!.velocity).toBeGreaterThan(at(bar, 'ride', 0)!.velocity);
      expect(at(bar, 'ride', 1 + S)!.velocity).toBeLessThan(at(bar, 'ride', 0)!.velocity - 0.15);
      // felt more than heard
      expect(beatsOf(bar, 'kick')).toEqual([0, 1, 2, 3]);
      for (const beat of [0, 1, 2, 3]) expect(at(bar, 'kick', beat)!.velocity).toBeLessThanOrEqual(0.3);
    }
    expect(beatsOf(written('swing', 0), 'rim')).toEqual([3]);
    expect(beatsOf(written('swing', 1), 'snare')).toEqual([1 + S]);
    expect(beatsOf(written('swing', 2), 'rim')).toEqual([3]);
    expect(beatsOf(written('swing', 3), 'snare')).toEqual([3 + S]);
    // comping is quiet: nothing here is a backbeat
    for (let step = 0; step < 4; step++) {
      for (const hit of written('swing', step)) if (hit.piece === 'snare' || hit.piece === 'rim') expect(hit.velocity).toBeLessThanOrEqual(0.5);
    }
  });

  it('sixteenths: hi-hat on every sixteenth, strongest on the beat; a syncopated kick; snare on 2 and 4', () => {
    const first = written('pop16', 0);
    expect(beatsOf(first, 'hatClosed')).toHaveLength(16);
    for (let beat = 0; beat < 4; beat++) {
      const [on, e, and, a] = [0, 0.25, 0.5, 0.75].map((part) => at(first, 'hatClosed', beat + part)!.velocity);
      expect(on).toBeGreaterThan(and);
      expect(and).toBeGreaterThan(e);
      expect(e).toBe(a);
    }
    expect(beatsOf(first, 'kick')).toEqual([0, 1.75, 2.5]);
    expect(beatsOf(first, 'snare').filter((beat) => at(first, 'snare', beat)!.velocity > 0.6)).toEqual([1, 3]);
    // the second bar opens the hi-hat on the last "and" and pushes a kick before the bar line
    const second = written('pop16', 1);
    expect(beatsOf(second, 'hatOpen')).toEqual([3.5]);
    expect(beatsOf(second, 'kick')).toEqual([0, 1.75, 2.5, 3.75]);
  });

  it('ghost notes sit far under the backbeat', () => {
    for (const groove of ['rock8', 'shuffle', 'pop16'] as const) {
      const snares = [0, 1, 2, 3].flatMap((step) => written(groove, step)).filter((hit) => hit.piece === 'snare');
      const ghosts = snares.filter((hit) => hit.velocity < 0.5);
      const backbeats = snares.filter((hit) => hit.velocity >= 0.5);
      expect(ghosts.length, groove).toBeGreaterThan(0);
      expect(backbeats.length, groove).toBe(8);
      for (const ghost of ghosts) expect(ghost.velocity).toBeLessThanOrEqual(0.22);
      for (const backbeat of backbeats) expect(backbeat.velocity).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('every pass of the form starts alike: the pattern follows the bar’s place in the form, not the bar count', () => {
    for (const groove of GROOVES) {
      const firstPass = buildDrumBar({ groove, bar: 0, stepIndex: 0, humanize: 0 });
      const thirdPass = buildDrumBar({ groove, bar: 24, stepIndex: 0, pass: 2, humanize: 0 });
      expect(thirdPass).toEqual(firstPass);
    }
  });
});

describe('fills and the crash', () => {
  it('a fill takes over the end of the bar and leaves the start as the groove wrote it', () => {
    for (const groove of ['rock8', 'shuffle', 'pop16'] as const) {
      for (let pass = 0; pass < 4; pass++) {
        const plain = written(groove, 3);
        const filled = written(groove, 3, { fill: true, pass, steps: 4 });
        expect(filled).not.toEqual(plain);
        // beats 1 and 2 are untouched
        expect(filled.filter((hit) => hit.beat < 2)).toEqual(plain.filter((hit) => hit.beat < 2));
        // both hands are on the drums: no hi-hat once the fill has started
        const start = Math.min(...filled.filter((hit) => !plain.some((p) => p.piece === hit.piece && p.beat === hit.beat)).map((hit) => hit.beat));
        expect(start).toBeGreaterThanOrEqual(2);
        expect(filled.some((hit) => hit.beat >= start && (hit.piece === 'hatClosed' || hit.piece === 'hatOpen'))).toBe(false);
        // a fill is short: two beats at the most, and it drives to the bar line
        expect(Math.max(...filled.map((hit) => hit.beat))).toBeGreaterThanOrEqual(3.5);
      }
    }
  });

  it('fills change from pass to pass, and a long form starts with the longer one', () => {
    for (const groove of GROOVES) {
      const fills = [0, 1, 2, 3].map((pass) => JSON.stringify(written(groove, 3, { fill: true, pass, steps: 4 })));
      expect(new Set(fills).size, groove).toBeGreaterThanOrEqual(3);
    }
    const startOf = (steps: number) => {
      const plain = written('rock8', steps - 1);
      const filled = written('rock8', steps - 1, { fill: true, pass: 0, steps });
      return Math.min(...filled.filter((hit) => hit.piece !== 'kick' && !plain.some((p) => p.piece === hit.piece && p.beat === hit.beat && p.velocity === hit.velocity)).map((hit) => hit.beat));
    };
    expect(startOf(4)).toBe(3); // one beat
    expect(startOf(12)).toBe(2); // two beats
  });

  it('a jazz fill is comping turned up: the ride and the foot keep time under it', () => {
    for (let pass = 0; pass < 3; pass++) {
      const filled = written('swing', 3, { fill: true, pass, steps: 12 });
      expect(beatsOf(filled, 'ride')).toEqual([0, 1, 1 + S, 2, 3, 3 + S]);
      expect(beatsOf(filled, 'hatFoot')).toEqual([1, 3]);
      for (const hit of filled) if (hit.piece === 'snare' || hit.piece.startsWith('tom')) expect(hit.velocity).toBeLessThanOrEqual(0.7);
    }
  });

  it('the crash is on beat 1 with the kick, in place of the hi-hat or the ride', () => {
    for (const groove of GROOVES) {
      const top = written(groove, 0, { crash: true });
      expect(beatsOf(top, 'crash'), groove).toEqual([0]);
      expect(at(top, 'kick', 0)!.velocity, groove).toBeGreaterThanOrEqual(0.6);
      expect(at(top, 'hatClosed', 0), groove).toBeUndefined();
      expect(at(top, 'ride', 0), groove).toBeUndefined();
      // the rest of the bar is the groove
      const plain = written(groove, 0);
      expect(top.filter((hit) => hit.beat > 0)).toEqual(plain.filter((hit) => hit.beat > 0));
      expect(beatsOf(plain, 'crash')).toEqual([]);
    }
    // jazz crashes more gently than rock
    expect(at(written('swing', 0, { crash: true }), 'crash', 0)!.velocity).toBeLessThan(at(written('rock8', 0, { crash: true }), 'crash', 0)!.velocity);
  });
});

describe('the phrase: where fills and crashes go', () => {
  const phraseOf = (bar: number, steps: number, looping = true) => {
    const chords = Array.from({ length: steps }, (_, index) => ({ rootPc: index % 12, quality: 'major' }));
    return drumPhrase(jamPosition(bar, chords), steps, looping);
  };

  it('12-bar blues: a fill in bar 12 of every pass, and the crash on bar 1 from the second pass', () => {
    const fills: number[] = [];
    const crashes: number[] = [];
    for (let bar = 0; bar < 48; bar++) {
      const phrase = phraseOf(bar, 12);
      if (phrase.fill) fills.push(bar + 1);
      if (phrase.crash) crashes.push(bar + 1);
    }
    expect(fills).toEqual([12, 24, 36, 48]);
    expect(crashes).toEqual([13, 25, 37]); // never at the very start
  });

  it('a four-bar loop: a fill every fourth bar, a crash every fifth from the fifth', () => {
    const fills: number[] = [];
    const crashes: number[] = [];
    for (let bar = 0; bar < 12; bar++) {
      if (phraseOf(bar, 4).fill) fills.push(bar + 1);
      if (phraseOf(bar, 4).crash) crashes.push(bar + 1);
    }
    expect(fills).toEqual([4, 8, 12]);
    expect(crashes).toEqual([5, 9]);
  });

  it('a short vamp is marked every second pass, a one-bar loop every fourth: never more often than every four bars', () => {
    expect([1, 2, 3, 4, 5, 8, 12].map(passesPerPhrase)).toEqual([4, 2, 2, 1, 1, 1, 1]);
    for (const steps of [1, 2, 3]) {
      const fills: number[] = [];
      const crashes: number[] = [];
      for (let bar = 0; bar < 24; bar++) {
        if (phraseOf(bar, steps).fill) fills.push(bar);
        if (phraseOf(bar, steps).crash) crashes.push(bar);
      }
      const phrase = steps * passesPerPhrase(steps);
      expect(phrase).toBeGreaterThanOrEqual(4);
      expect(fills[0]).toBe(phrase - 1);
      expect(crashes[0]).toBe(phrase);
      for (let i = 1; i < fills.length; i++) expect(fills[i] - fills[i - 1]).toBe(phrase);
      // every crash follows a fill
      for (const crash of crashes) expect(fills).toContain(crash - 1);
    }
  });

  it('a loop that is about to stop gets no fill: a fill leads somewhere', () => {
    expect(phraseOf(11, 12, true).fill).toBe(true);
    expect(phraseOf(11, 12, false).fill).toBe(false);
  });
});

describe('humanizing', () => {
  const allBars = (groove: DrumGroove, humanize: number, bars = 96) =>
    Array.from({ length: bars }, (_, bar) =>
      buildDrumBar({ groove, bar, stepIndex: bar % 12, pass: Math.floor(bar / 12), steps: 12, fill: bar % 12 === 11, crash: bar % 12 === 0 && bar > 0, humanize }),
    );

  it('at 0, every stroke is exactly on the grid at its written velocity', () => {
    for (const groove of GROOVES) {
      for (const hit of allBars(groove, 0, 12).flat()) expect(hit.offsetMs).toBe(0);
    }
  });

  it('is bounded: no stroke is ever more than a few milliseconds from the grid, even at full', () => {
    expect(MAX_OFFSET_MS).toBeLessThanOrEqual(10);
    for (const groove of GROOVES) {
      for (const amount of [DEFAULT_HUMANIZE, 1]) {
        let widest = 0;
        for (const hit of allBars(groove, amount).flat()) widest = Math.max(widest, Math.abs(hit.offsetMs));
        expect(widest).toBeLessThanOrEqual(MAX_OFFSET_MS);
        expect(widest).toBeGreaterThan(1); // and it does something
      }
    }
  });

  it('never drifts: a stroke’s offset depends on where it is, not on how long the loop has run', () => {
    for (const groove of GROOVES) {
      // the average offset over any stretch of bars stays small: nothing accumulates
      for (const from of [0, 400, 4000, 40000]) {
        let sum = 0;
        let count = 0;
        let widest = 0;
        for (let bar = from; bar < from + 64; bar++) {
          for (const hit of buildDrumBar({ groove, bar, stepIndex: bar % 12, steps: 12, humanize: 1 })) {
            sum += hit.offsetMs;
            count++;
            widest = Math.max(widest, Math.abs(hit.offsetMs));
          }
        }
        expect(Math.abs(sum / count), `${groove} from bar ${from}`).toBeLessThan(3);
        expect(widest).toBeLessThanOrEqual(MAX_OFFSET_MS);
      }
    }
  });

  it('beat 1’s kick and the crash are the grid itself, at any amount', () => {
    for (const groove of GROOVES) {
      for (const bar of allBars(groove, 1)) {
        expect(at(bar, 'kick', 0)!.offsetMs).toBe(0);
        const crash = at(bar, 'crash', 0);
        if (crash) expect(crash.offsetMs).toBe(0);
      }
    }
  });

  it('the backbeat sits a touch behind the beat, on average', () => {
    for (const groove of ['rock8', 'shuffle', 'pop16'] as const) {
      const backbeats = allBars(groove, 1).flat().filter((hit) => hit.piece === 'snare' && hit.velocity > 0.6 && hit.beat % 1 === 0);
      const mean = backbeats.reduce((sum, hit) => sum + hit.offsetMs, 0) / backbeats.length;
      expect(mean).toBeGreaterThan(2.5);
      expect(mean).toBeLessThan(6.5);
    }
  });

  it('wanders slowly: neighbouring strokes move together, and bars differ', () => {
    const bars = allBars('rock8', 1, 64);
    const hats = bars.map((bar) => bar.filter((hit) => hit.piece === 'hatClosed' && hit.beat % 1 === 0));
    // within a bar, the hi-hat's four beats are within a few milliseconds of each other...
    for (const bar of hats) {
      const offsets = bar.map((hit) => hit.offsetMs);
      expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThan(5);
    }
    // ...while over the whole stretch the wander covers more ground than any one bar does
    const all = hats.flat().map((hit) => hit.offsetMs);
    expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(5);
    // one stroke to the next, the timing is correlated (a drift), not independent (a jitter)
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    let covariance = 0;
    let variance = 0;
    for (let i = 0; i < all.length - 1; i++) covariance += (all[i] - mean) * (all[i + 1] - mean);
    for (const value of all) variance += (value - mean) ** 2;
    expect(covariance / variance).toBeGreaterThan(0.5);
  });

  it('velocities breathe a little and stay where they belong', () => {
    const plain = allBars('rock8', 0, 24).flat();
    const human = allBars('rock8', 1, 24).flat();
    expect(human).toHaveLength(plain.length);
    let changed = 0;
    human.forEach((hit, index) => {
      expect(hit.piece).toBe(plain[index].piece);
      expect(hit.beat).toBe(plain[index].beat);
      expect(Math.abs(hit.velocity / plain[index].velocity - 1)).toBeLessThan(0.2);
      if (hit.velocity !== plain[index].velocity) changed++;
    });
    expect(changed).toBeGreaterThan(plain.length / 2);
  });

  it('is repeatable: the same bar is the same strokes every time', () => {
    for (const groove of GROOVES) {
      const request: DrumBarRequest = { groove, bar: 37, stepIndex: 1, pass: 3, steps: 12, humanize: 0.8 };
      expect(buildDrumBar(request)).toEqual(buildDrumBar(request));
      expect(buildDrumBar({ ...request, bar: 38 })).not.toEqual(buildDrumBar(request));
    }
  });
});

describe('brushes', () => {
  it('taps take the sticks’ rhythm on the snare, and a sweep on every beat keeps the hiss going', () => {
    const sticks = written('swing', 0);
    const brushes = written('swing', 0, { brushes: true });
    expect(beatsOf(brushes, 'brushTap')).toEqual(beatsOf(sticks, 'ride'));
    expect(beatsOf(brushes, 'ride')).toEqual([]);
    expect(beatsOf(brushes, 'rim')).toEqual([]);
    expect(beatsOf(brushes, 'brushSweep')).toEqual([0, 1, 2, 3]);
    for (const sweep of brushes.filter((hit) => hit.piece === 'brushSweep')) expect(sweep.beats).toBe(1);
    // the sweeps lean on 2 and 4
    expect(at(brushes, 'brushSweep', 1)!.velocity).toBeGreaterThan(at(brushes, 'brushSweep', 0)!.velocity);
    // the foot and the feathered kick carry on
    expect(beatsOf(brushes, 'hatFoot')).toEqual([1, 3]);
    expect(beatsOf(brushes, 'kick')).toEqual([0, 1, 2, 3]);
  });

  it('a backbeat is an accented tap, not a second stroke on top of the timekeeping tap', () => {
    const brushes = written('shuffle', 0, { brushes: true });
    const taps = brushes.filter((hit) => hit.piece === 'brushTap');
    // one tap a moment: where the hi-hat and the snare met, the stronger survives
    expect(new Set(taps.map((hit) => hit.beat)).size).toBe(taps.length);
    expect(at(brushes, 'brushTap', 1)!.velocity).toBeGreaterThan(at(brushes, 'brushTap', 0)!.velocity);
    expect(beatsOf(brushes, 'snare')).toEqual([]);
    expect(beatsOf(brushes, 'hatClosed')).toEqual([]);
  });
});

describe('each library entry’s groove', () => {
  it('the grooves the library names are the grooves the drummer knows', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      if (entry.groove !== undefined) expect(GROOVES).toContain(entry.groove);
      expect(GROOVES).toContain(progressionGroove(entry));
    }
  });

  it('blues entries shuffle, jazz entries swing on the ride, city pop and the Dorian vamp play sixteenths, the rest straight eighths', () => {
    const grooveOf = (id: string) => progressionGroove(getProgressionLibraryEntry(id));
    expect(grooveOf('blues-12')).toBe('shuffle');
    expect(grooveOf('blues-minor')).toBe('shuffle');
    for (const id of ['jazz-251', 'turnaround-1625', 'backdoor', 'tritone-sub']) expect(grooveOf(id), id).toBe('swing');
    expect(grooveOf('city-pop')).toBe('pop16');
    expect(grooveOf('vamp-dorian')).toBe('pop16');
    for (const id of ['pop-1564', 'rock-1465', 'andalusian', 'doo-wop', 'creep-lift']) expect(grooveOf(id), id).toBe('rock8');
  });

  it('a groove always has its entry’s feel: swung entries get swung grooves and straight ones straight', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      expect(isSwungGroove(progressionGroove(entry)), entry.id).toBe(progressionFeel(entry) === 'swing');
    }
  });

  it('the Feel menu still switches: Swing gives a straight entry a shuffle, Straight gives a swung one eighths', () => {
    for (const entry of PROGRESSION_LIBRARY) {
      expect(isSwungGroove(progressionGroove(entry, 'swing')), entry.id).toBe(true);
      expect(isSwungGroove(progressionGroove(entry, 'straight')), entry.id).toBe(false);
    }
    expect(progressionGroove(getProgressionLibraryEntry('blues-12'), 'straight')).toBe('rock8');
    expect(progressionGroove(getProgressionLibraryEntry('city-pop'), 'swing')).toBe('shuffle');
    expect(progressionGroove(getProgressionLibraryEntry('jazz-251'), 'swing')).toBe('swing');
    expect(progressionGroove(undefined)).toBe('rock8');
    // the audio side's own helper agrees with the library's
    for (const entry of PROGRESSION_LIBRARY) {
      for (const feel of ['straight', 'swing'] as const) {
        expect(grooveForFeel(progressionGroove(entry), feel)).toBe(progressionGroove(entry, feel));
      }
    }
  });
});

describe('buildJamBar with drums', () => {
  type Drum = Extract<JamEvent, { kind: 'drum' }>;
  const options = { guitar: 'half', pad: false, feel: 'swing', click: false } as const;

  it('adds the kit’s strokes when asked, and none when not: the other layers are as they were', () => {
    const without = buildJamBar({ rootPc: 0 }, options);
    const request: DrumBarRequest = { groove: 'shuffle', bar: 0, stepIndex: 0, humanize: 0 };
    const withDrums = buildJamBar({ rootPc: 0 }, { ...options, drums: request });
    expect(without.some((event) => event.kind === 'drum')).toBe(false);
    expect(withDrums.filter((event) => event.kind !== 'drum')).toEqual(without);
    const drums = withDrums.filter((event): event is Drum => event.kind === 'drum');
    expect(drums.map(({ beat, piece, velocity, offsetMs }) => ({ beat, piece, velocity, offsetMs }))).toEqual(buildDrumBar(request));
    // still in order of beat
    expect(withDrums.map((event) => event.beat)).toEqual([...withDrums.map((event) => event.beat)].sort((a, b) => a - b));
  });

  it('carries a brush sweep’s length', () => {
    const events = buildJamBar({ rootPc: 0 }, { ...options, drums: { groove: 'swing', bar: 0, stepIndex: 0, brushes: true } });
    const sweeps = events.filter((event): event is Drum => event.kind === 'drum' && event.piece === 'brushSweep');
    expect(sweeps).toHaveLength(4);
    for (const sweep of sweeps) expect(sweep.beats).toBe(1);
  });
});
