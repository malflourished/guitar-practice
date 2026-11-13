/**
 * What the drummer plays, as plain data: one bar of a groove at a time, with
 * a fill at the end of a phrase and a crash at the top of the next. Pure, like
 * `buildJamBar`, so the engine only has to turn the strokes into sound.
 *
 * The feel is in three things (docs/sound/drums.md):
 * - Dynamics. Every stroke has a velocity, and the kits change tone with it:
 *   a strong and a weak hand on the hi-hat, ghost notes far under the backbeat.
 * - The swing. A swung note sits at `SWING_OFFSET`, the same two thirds of
 *   the beat that the bass and the guitar use, so the band swings together.
 * - A little humanizing. Each stroke's time is its place on the grid plus a
 *   small offset worked out from where it is in the piece: a slow wander
 *   shared by the kit, a backbeat a touch behind, a millisecond of difference
 *   between strokes. Nothing is added up from bar to bar, so the drums cannot
 *   drift away from the Transport, however long the loop runs.
 */
import { BEATS_PER_BAR, SWING_OFFSET } from './jamGrid';
import type { DrumPiece } from './synth/drums/drumParams';

/**
 * - `rock8`: straight eighths on the hi-hat, for rock and pop.
 * - `shuffle`: the swung pair on every beat with a backbeat, for the blues.
 * - `swing`: the jazz ride pattern, with the hi-hat's foot on 2 and 4.
 * - `pop16`: sixteenths on the hi-hat and a syncopated kick, for city pop and funk.
 */
export type DrumGroove = 'rock8' | 'shuffle' | 'swing' | 'pop16';

export const DRUM_GROOVES: readonly { id: DrumGroove; label: string; swung: boolean }[] = [
  { id: 'rock8', label: 'Straight 8ths', swung: false },
  { id: 'shuffle', label: 'Shuffle', swung: true },
  { id: 'swing', label: 'Swing', swung: true },
  { id: 'pop16', label: '16ths', swung: false },
];

export const isSwungGroove = (groove: DrumGroove): boolean => groove === 'shuffle' || groove === 'swing';

/**
 * The groove for a feel: the entry's own groove when it has that feel, and
 * otherwise the plain groove of that feel, so the Feel menu can swing a rock
 * entry (a shuffle) or straighten a blues (straight eighths).
 */
export function grooveForFeel(own: DrumGroove | undefined, feel: 'straight' | 'swing'): DrumGroove {
  if (own && isSwungGroove(own) === (feel === 'swing')) return own;
  return feel === 'swing' ? 'shuffle' : 'rock8';
}

/** One stroke of the kit. */
export interface DrumHit {
  /** Beats from the bar line, on the grid. */
  beat: number;
  piece: DrumPiece;
  /** 0 to 1. The kits change tone with it, not only level. */
  velocity: number;
  /** The humanizing shift from the grid, in milliseconds. Never more than `MAX_OFFSET_MS` either way. */
  offsetMs: number;
  /** For a brush sweep: how long it lasts, in beats. */
  beats?: number;
}

export interface DrumBarRequest {
  groove: DrumGroove;
  /** Bars since the count-in, from 0. Only the humanizing reads it, for its slow wander. */
  bar: number;
  /** The bar's place in the form, from 0. The grooves' two- and four-bar patterns follow it, so every pass starts alike. */
  stepIndex: number;
  /** Times round the loop, from 0: it picks which fill. */
  pass?: number;
  /** The form's length in bars: a long form gets the longer fills first. */
  steps?: number;
  /** The last bar of a phrase: end it with a fill. */
  fill?: boolean;
  /** The top of a phrase: a crash with the kick on beat 1. */
  crash?: boolean;
  /** How much the timing and dynamics wander, 0 (exactly as written) to 1. */
  humanize?: number;
  /** The kit is played with brushes: taps and sweeps on the snare take the place of the sticks. */
  brushes?: boolean;
}

/** The default amount of humanizing. */
export const DEFAULT_HUMANIZE = 0.5;
/** No stroke is ever moved further than this from the grid, in milliseconds. */
export const MAX_OFFSET_MS = 9;

/**
 * How many passes make a phrase. A drummer marks a form of four bars or
 * more every time round. A two- or three-bar vamp is marked every second
 * pass, and a one-bar loop every fourth, so that the fill and the crash come
 * no more often than every four bars.
 */
export function passesPerPhrase(steps: number): number {
  const length = Math.max(1, Math.floor(steps));
  return length >= 4 ? 1 : Math.ceil(4 / length);
}

/**
 * Where a bar is in the drummer's phrase: whether it ends with a fill, and
 * whether it starts with the crash. The crash comes from the second phrase
 * on, never at the very start. A fill leads to a crash, so the last pass of
 * a loop that is about to stop (`looping` false) has none.
 */
export function drumPhrase(
  position: { stepIndex: number; pass: number },
  steps: number,
  looping = true,
): { fill: boolean; crash: boolean } {
  const length = Math.max(1, Math.floor(steps));
  const every = passesPerPhrase(length);
  return {
    fill: looping && position.stepIndex === length - 1 && (position.pass + 1) % every === 0,
    crash: position.stepIndex === 0 && position.pass >= 1 && position.pass % every === 0,
  };
}

type Stroke = [beat: number, piece: DrumPiece, velocity: number, beats?: number];

const S = SWING_OFFSET;
/** A third of a beat: the first step of a triplet. The second is `SWING_OFFSET`. */
const T = SWING_OFFSET / 2;

/* --------------------------------------------------------------- grooves */

/**
 * Straight eighths. The hi-hat's strong hand is on the beat and its weak
 * hand on the "and". The kick alternates two bars: 1, 3 and the "and" of 3,
 * then 1, the "and" of 2 and 3. A ghost note leads into beat 3 of the first.
 * Every fourth bar opens the hi-hat on its last eighth.
 */
function rock8(step: number): Stroke[] {
  const second = step % 2 === 1;
  const lift = step % 4 === 3;
  const strokes: Stroke[] = [];
  for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
    strokes.push([beat, 'hatClosed', beat === 0 ? 0.8 : 0.74]);
    if (beat === 3 && lift) strokes.push([beat + 0.5, 'hatOpen', 0.62]);
    else strokes.push([beat + 0.5, 'hatClosed', 0.48]);
  }
  strokes.push([1, 'snare', 0.9], [3, 'snare', 0.92]);
  if (second) strokes.push([0, 'kick', 0.95], [1.5, 'kick', 0.66], [2, 'kick', 0.84]);
  else strokes.push([0, 'kick', 0.95], [2, 'kick', 0.84], [2.5, 'kick', 0.7], [1.75, 'snare', 0.2]);
  return strokes;
}

/**
 * A blues shuffle. The hi-hat plays every beat and its swung "and". The
 * snare is on 2 and 4, the kick on 1 and 3. The first bar of each pair has a
 * ghost note after beat 2; the second has a kick on the last swung "and",
 * with the bass's pickup.
 */
function shuffle(step: number): Stroke[] {
  const second = step % 2 === 1;
  const strokes: Stroke[] = [];
  for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
    strokes.push([beat, 'hatClosed', beat === 0 ? 0.8 : 0.76]);
    strokes.push([beat + S, 'hatClosed', 0.44]);
  }
  strokes.push([1, 'snare', 0.9], [3, 'snare', 0.92], [0, 'kick', 0.95], [2, 'kick', 0.84]);
  if (second) strokes.push([3 + S, 'kick', 0.6]);
  else strokes.push([1 + S, 'snare', 0.2]);
  return strokes;
}

/**
 * Jazz time. The ride plays 1, 2, the swung "and" of 2, 3, 4 and the swung
 * "and" of 4, leaning on 2 and 4, where the hi-hat's foot closes. The kick
 * is feathered on every beat: felt more than heard. The other hand comps
 * over four bars: a cross-stick on 4, a soft snare after 2, a cross-stick on
 * 4, a snare on the last swung "and".
 */
function swing(step: number): Stroke[] {
  const strokes: Stroke[] = [
    [0, 'ride', 0.72],
    [1, 'ride', 0.82],
    [1 + S, 'ride', 0.5],
    [2, 'ride', 0.72],
    [3, 'ride', 0.82],
    [3 + S, 'ride', 0.5],
    [1, 'hatFoot', 0.6],
    [3, 'hatFoot', 0.6],
    [0, 'kick', 0.3],
    [1, 'kick', 0.2],
    [2, 'kick', 0.26],
    [3, 'kick', 0.2],
  ];
  const comp: Stroke[] = [
    [3, 'rim', 0.5],
    [1 + S, 'snare', 0.3],
    [3, 'rim', 0.5],
    [3 + S, 'snare', 0.36],
  ];
  strokes.push(comp[step % 4]);
  return strokes;
}

/**
 * Sixteenths on the hi-hat: strong on the beat, medium on the "and", soft
 * between. The kick is on 1, the last sixteenth of 2 and the "and" of 3; the
 * snare on 2 and 4, with a ghost note after 3. The second bar of each pair
 * adds a ghost, a kick before the bar line and an open hi-hat on the last "and".
 */
function pop16(step: number): Stroke[] {
  const second = step % 2 === 1;
  const strokes: Stroke[] = [];
  for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
    strokes.push([beat, 'hatClosed', beat === 0 ? 0.78 : 0.72], [beat + 0.25, 'hatClosed', 0.34]);
    if (beat === 3 && second) {
      strokes.push([beat + 0.5, 'hatOpen', 0.56]);
    } else {
      strokes.push([beat + 0.5, 'hatClosed', 0.52], [beat + 0.75, 'hatClosed', 0.34]);
    }
  }
  strokes.push([1, 'snare', 0.88], [3, 'snare', 0.9], [2.25, 'snare', 0.2]);
  strokes.push([0, 'kick', 0.95], [1.75, 'kick', 0.68], [2.5, 'kick', 0.8]);
  if (second) strokes.push([0.75, 'snare', 0.18], [3.75, 'kick', 0.55]);
  return strokes;
}

const GROOVES: Record<DrumGroove, (step: number) => Stroke[]> = { rock8, shuffle, swing, pop16 };

/* ----------------------------------------------------------------- fills */

interface Fill {
  /** The fill takes over from this beat. */
  from: number;
  strokes: Stroke[];
  /** Pieces that keep playing the groove under the fill: jazz time stays on the ride. */
  keep?: readonly DrumPiece[];
}

/** One beat, then two, then one, then two: sixteenths on the snare, and runs down the toms. */
const STRAIGHT_FILLS: readonly Fill[] = [
  { from: 3, strokes: [[3, 'snare', 0.55], [3.25, 'snare', 0.62], [3.5, 'snare', 0.74], [3.75, 'snare', 0.86]] },
  {
    from: 2,
    strokes: [[2, 'kick', 0.8], [2, 'snare', 0.8], [2.5, 'snare', 0.7], [3, 'tomHigh', 0.78], [3.25, 'tomHigh', 0.7], [3.5, 'tomMid', 0.82], [3.75, 'tomLow', 0.9]],
  },
  { from: 3, strokes: [[3, 'snare', 0.8], [3.5, 'tomLow', 0.88], [3.5, 'kick', 0.7]] },
  {
    from: 2,
    strokes: [[2, 'kick', 0.84], [2.5, 'snare', 0.72], [2.75, 'snare', 0.5], [3, 'tomMid', 0.8], [3.5, 'tomLow', 0.86], [3.75, 'snare', 0.6]],
  },
];

/** The same shapes in triplets, for the shuffle: every stroke sits on a third of a beat. */
const SHUFFLE_FILLS: readonly Fill[] = [
  { from: 3, strokes: [[3, 'snare', 0.6], [3 + T, 'snare', 0.68], [3 + S, 'snare', 0.84]] },
  {
    from: 2,
    strokes: [[2, 'kick', 0.8], [2, 'snare', 0.8], [2 + S, 'snare', 0.6], [3, 'tomHigh', 0.76], [3 + T, 'tomMid', 0.8], [3 + S, 'tomLow', 0.9]],
  },
  { from: 3, strokes: [[3, 'snare', 0.8], [3 + S, 'tomLow', 0.86]] },
  {
    from: 2,
    strokes: [[2, 'kick', 0.84], [2 + S, 'snare', 0.6], [3, 'snare', 0.7], [3 + T, 'tomMid', 0.76], [3 + S, 'tomLow', 0.88]],
  },
];

/** Jazz fills are comping turned up: the ride and the foot keep time under them. */
const JAZZ_KEEP: readonly DrumPiece[] = ['ride', 'hatFoot', 'kick'];
const SWING_FILLS: readonly Fill[] = [
  { from: 3, keep: JAZZ_KEEP, strokes: [[3, 'snare', 0.4], [3 + T, 'snare', 0.5], [3 + S, 'snare', 0.66]] },
  { from: 2, keep: JAZZ_KEEP, strokes: [[2 + S, 'snare', 0.45], [3, 'tomHigh', 0.5], [3 + T, 'snare', 0.5], [3 + S, 'tomLow', 0.64]] },
  { from: 3, keep: JAZZ_KEEP, strokes: [[3, 'snare', 0.5], [3 + S, 'kick', 0.62]] },
];

const FILLS: Record<DrumGroove, readonly Fill[]> = {
  rock8: STRAIGHT_FILLS,
  pop16: STRAIGHT_FILLS,
  shuffle: SHUFFLE_FILLS,
  swing: SWING_FILLS,
};

/** The fill for this pass. A form of eight bars or more starts with the two-beat fill, a shorter one with the one-beat. */
function fillFor(groove: DrumGroove, pass: number, steps: number): Fill {
  const fills = FILLS[groove];
  const first = steps >= 8 ? 1 : 0;
  return fills[(((pass + first) % fills.length) + fills.length) % fills.length];
}

/* ------------------------------------------------------------ humanizing */

/** A repeatable number from -1 to 1 for three whole numbers: the same stroke always gets the same one. */
function scatter(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 2147483648 - 1;
}

/**
 * The kit's slow wander, from -1 to 1, as a function of how far into the
 * piece a stroke is, in beats. Three slow waves of unrelated lengths: each
 * stroke's value is close to its neighbours' and differs from one bar to the
 * next, the way a drummer's time breathes. It is a function of position, not
 * a running sum, so it is always within its bounds.
 */
function wander(position: number, phase: number): number {
  return (
    0.45 * Math.sin((2 * Math.PI * position) / 9.7 + phase) +
    0.33 * Math.sin((2 * Math.PI * position) / 23.3 + 1.7 * phase + 1) +
    0.22 * Math.sin((2 * Math.PI * position) / 61.1 + 2.3 * phase + 2)
  );
}

const PIECE_NUMBER: Record<DrumPiece, number> = {
  kick: 1,
  snare: 2,
  rim: 3,
  hatClosed: 4,
  hatOpen: 5,
  hatFoot: 6,
  ride: 7,
  crash: 8,
  tomHigh: 9,
  tomMid: 10,
  tomLow: 11,
  brushTap: 12,
  brushSweep: 13,
};

/** The stroke's shift from the grid, in milliseconds, at full humanizing. */
function timingOffset(bar: number, beat: number, piece: DrumPiece, velocity: number): number {
  // Beat 1's kick is the grid: the bass lands there too, and the band needs one fixed point.
  if (piece === 'kick' && beat === 0) return 0;
  if (piece === 'crash') return 0;
  const position = bar * BEATS_PER_BAR + beat;
  let offset = 3.6 * wander(position, 0);
  // The backbeat sits a little behind; so do the hi-hat's and the ride's off-beats.
  if ((piece === 'snare' || piece === 'brushTap' || piece === 'rim') && velocity >= 0.6) offset += 4.5;
  else if ((piece === 'hatClosed' || piece === 'hatOpen' || piece === 'ride') && beat % 1 !== 0) offset += 1.5;
  // The kick stays closest to the grid.
  if (piece === 'kick') offset *= 0.5;
  offset += 1.2 * scatter(bar, Math.round(beat * 48), PIECE_NUMBER[piece]);
  return offset;
}

/** The stroke's velocity at full humanizing: a slow swell per piece, and a little chance. */
function velocityScale(bar: number, beat: number, piece: DrumPiece): number {
  const position = bar * BEATS_PER_BAR + beat;
  const number = PIECE_NUMBER[piece];
  return 1 + 0.1 * wander(position * 1.3, number) + 0.07 * scatter(bar + 7919, Math.round(beat * 48), number);
}

/* ------------------------------------------------------------------- bar */

/** Brushes: taps on the snare take the sticks' rhythm, and a sweep on every beat keeps the hiss going. */
function withBrushes(strokes: Stroke[]): Stroke[] {
  const played: Stroke[] = [];
  for (const [beat, piece, velocity, beats] of strokes) {
    if (piece === 'hatClosed' || piece === 'hatOpen') played.push([beat, 'brushTap', velocity * 0.8]);
    else if (piece === 'ride') played.push([beat, 'brushTap', velocity * 0.9]);
    else if (piece === 'snare') played.push([beat, 'brushTap', velocity]);
    else if (piece === 'rim') continue; // that hand is sweeping
    else if (piece === 'crash') played.push([beat, 'crash', velocity * 0.8]);
    else played.push([beat, piece, velocity, beats]);
  }
  for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
    played.push([beat, 'brushSweep', beat % 2 === 1 ? 0.7 : 0.5, 1]);
  }
  return played;
}

/** Two strokes on the same piece at the same moment are one stroke: keep the stronger. */
function mergeDoubles(strokes: Stroke[]): Stroke[] {
  const kept: Stroke[] = [];
  for (const stroke of strokes) {
    const twin = kept.find((other) => other[1] === stroke[1] && Math.abs(other[0] - stroke[0]) < 1e-9);
    if (!twin) kept.push([...stroke] as Stroke);
    else if (stroke[2] > twin[2]) twin[2] = stroke[2];
  }
  return kept;
}

/** The pieces a hand leaves when it goes to the crash. */
const TIMEKEEPERS: readonly DrumPiece[] = ['hatClosed', 'hatOpen', 'ride'];

/**
 * One bar of the kit: the groove's pattern for this bar of the form, the
 * fill if the phrase ends here, the crash if it starts here, then the
 * humanizing. Strokes come back in order of their place on the grid.
 */
export function buildDrumBar(request: DrumBarRequest): DrumHit[] {
  const { groove, bar, stepIndex } = request;
  const pass = request.pass ?? 0;
  const humanize = Math.min(1, Math.max(0, request.humanize ?? DEFAULT_HUMANIZE));
  let strokes = GROOVES[groove](Math.max(0, Math.floor(stepIndex)));

  if (request.fill) {
    const fill = fillFor(groove, pass, request.steps ?? BEATS_PER_BAR);
    strokes = strokes.filter(([beat, piece]) => beat < fill.from || (fill.keep?.includes(piece) ?? false));
    strokes.push(...fill.strokes);
  }

  if (request.crash) {
    // The hand that keeps time goes to the crash, and the kick lands with it.
    strokes = strokes.filter(([beat, piece]) => !(beat === 0 && TIMEKEEPERS.includes(piece)));
    const jazz = groove === 'swing';
    strokes.push([0, 'crash', jazz ? 0.72 : 0.86], [0, 'kick', jazz ? 0.62 : 0.95]);
    // The foot closes the hi-hat, in case the bar before left it open.
    if (!jazz) strokes.push([0, 'hatFoot', 0.25]);
  }

  if (request.brushes) strokes = withBrushes(strokes);
  strokes = mergeDoubles(strokes);

  const hits: DrumHit[] = strokes.map(([beat, piece, velocity, beats]) => {
    const shift = humanize * timingOffset(bar, beat, piece, velocity);
    const scaled = velocity * (1 + humanize * (velocityScale(bar, beat, piece) - 1));
    const hit: DrumHit = {
      beat,
      piece,
      velocity: Math.round(Math.min(1, Math.max(0.03, scaled)) * 1000) / 1000,
      offsetMs: Math.round(Math.min(MAX_OFFSET_MS, Math.max(-MAX_OFFSET_MS, shift)) * 100) / 100,
    };
    if (beats !== undefined) hit.beats = beats;
    return hit;
  });
  return hits.sort((a, b) => a.beat - b.beat);
}
