/**
 * The jam loop's grid: the two numbers every layer of the backing agrees on.
 * They live here, apart from the score (`jamSchedule.ts`) and the drum
 * grooves (`drumGrooves.ts`), so that both can use them without importing
 * each other.
 */

/** Beats per bar. The jam loop is 4/4. */
export const BEATS_PER_BAR = 4;
/**
 * Where the second note of a swung pair sits in its beat: two thirds of the
 * way through. The guitar's up-strum, the bass's pickup and the drums' swung
 * notes all use this one number.
 */
export const SWING_OFFSET = 2 / 3;
