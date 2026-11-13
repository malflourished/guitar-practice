/**
 * Voice-leading for the pad: each chord takes the inversion that moves the
 * least from the one before, and the last chord leads back to the first so a
 * loop has no jump at the wrap. Pure; the sound is `PadVoice`.
 */

/** The pad sits in this MIDI range (E3 to G4). */
export const PAD_LOW = 52;
export const PAD_HIGH = 67;
/** Beyond a 4th a voice has leapt: the cost grows steeply. */
const BIG_LEAP = 5;

/** Pitch classes of a chord from its root and intervals, root first, no repeats. */
export function chordPitchClasses(rootPc: number, intervals: readonly number[]): number[] {
  const pcs = intervals.map((interval) => (((rootPc + interval) % 12) + 12) % 12);
  return pcs.filter((pc, index) => pcs.indexOf(pc) === index);
}

/** Every close-position voicing of these pitch classes that fits the pad's range. */
export function padCandidates(pcs: readonly number[]): number[][] {
  const found: number[][] = [];
  for (let rotation = 0; rotation < pcs.length; rotation++) {
    const order = [...pcs.slice(rotation), ...pcs.slice(0, rotation)];
    for (let low = PAD_LOW; low <= PAD_HIGH; low++) {
      if ((((low - order[0]) % 12) + 12) % 12 !== 0) continue;
      const notes = [low];
      for (const pc of order.slice(1)) {
        let next = notes[notes.length - 1] + 1;
        while ((((next - pc) % 12) + 12) % 12 !== 0) next++;
        notes.push(next);
      }
      if (notes[notes.length - 1] <= PAD_HIGH) found.push(notes);
    }
  }
  return found;
}

/** How far each voice travels from one chord to the next. */
export function voiceMoves(from: readonly number[], to: readonly number[]): number[] {
  if (from.length === to.length) return to.map((note, index) => Math.abs(note - from[index]));
  const [longer, shorter] = to.length > from.length ? [to, from] : [from, to];
  return longer.map((note) => Math.min(...shorter.map((other) => Math.abs(note - other))));
}

function moveCost(from: readonly number[], to: readonly number[]): number {
  const moves = voiceMoves(from, to);
  const sum = moves.reduce((total, move) => total + move, 0);
  return sum + moves.reduce((total, move) => total + (move > BIG_LEAP ? 20 * (move - BIG_LEAP) : 0), 0);
}

/**
 * One voicing per chord (each chord given as pitch classes, root first),
 * chosen so the whole loop, including the wrap, moves as little as it can.
 */
export function leadPadVoicings(chords: readonly (readonly number[])[]): number[][] {
  if (chords.length === 0) return [];
  const candidates = chords.map(padCandidates);
  if (candidates.some((list) => list.length === 0)) return chords.map(() => []);
  let best: { cost: number; path: number[][] } | null = null;
  for (const start of candidates[0]) {
    // cheapest way to reach each candidate of each chord, from this start
    let layer = candidates[0].map((candidate) => ({
      cost: candidate === start ? 0 : Infinity,
      path: [candidate],
    }));
    for (let i = 1; i < chords.length; i++) {
      layer = candidates[i].map((candidate) => {
        let top = { cost: Infinity, path: [] as number[][] };
        candidates[i - 1].forEach((previous, index) => {
          const reach = layer[index];
          if (!Number.isFinite(reach.cost)) return;
          const cost = reach.cost + moveCost(previous, candidate);
          if (cost < top.cost) top = { cost, path: [...reach.path, candidate] };
        });
        return top;
      });
    }
    for (const end of layer) {
      if (!Number.isFinite(end.cost)) continue;
      const cost = end.cost + (chords.length > 1 ? moveCost(end.path[end.path.length - 1], start) : 0);
      if (!best || cost < best.cost) best = { cost, path: end.path };
    }
  }
  return best?.path ?? chords.map(() => []);
}
