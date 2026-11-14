import { useEffect, useState } from 'react';

/** Air kept between the board and the deck's rule. */
const DECK_GROW_MARGIN = 10;

/** How far the deck may rise: the empty band under the board, less a margin. */
export function deckGrowFor(neckBottom: number, boardBottom: number): number {
  return Math.max(0, Math.floor(neckBottom - boardBottom - DECK_GROW_MARGIN));
}

/**
 * The height of the empty band between the board and the bottom of the neck
 * region, which a deck may rise into (see ModeDeck). The board is centred in
 * the neck and capped by the window's width, so a tall window leaves a band
 * above it (where the position bar sits) and one below it. Measured from the
 * page, and again whenever the neck is resized. 0 while `enabled` is false.
 */
export function useDeckGrow(enabled: boolean): number {
  const [grow, setGrow] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const neck = document.querySelector('[data-region="neck"]');
    const grid = neck?.querySelector('[data-fretboard-grid]');
    if (!neck || !grid) return undefined;
    const measure = () => {
      const board = grid.querySelector('svg');
      if (!board) return;
      // An audio error is written under the board: leave it its room.
      const lowest = neck.querySelector('.audioError') ?? board;
      setGrow(deckGrowFor(neck.getBoundingClientRect().bottom, lowest.getBoundingClientRect().bottom));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(neck);
    observer.observe(grid);
    const board = grid.querySelector('svg');
    if (board) observer.observe(board);
    // The board draws itself after its first measure: look once more then.
    const mutations = new MutationObserver(() => {
      const drawn = grid.querySelector('svg');
      if (drawn) observer.observe(drawn);
      measure();
    });
    mutations.observe(grid, { childList: true });
    mutations.observe(neck, { childList: true, subtree: false });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [enabled]);
  return enabled ? grow : 0;
}
