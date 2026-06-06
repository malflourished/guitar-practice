import { useLayoutEffect, useState, type RefObject } from 'react';

const BOUNDARY_BLEED_PX = 72;
const FRETBOARD_GRID_SELECTOR = '[data-fretboard-grid]';

export function useColorBoundary(
  anchorRef: RefObject<HTMLElement | null>,
): string {
  const [boundary, setBoundary] = useState('78vh');

  useLayoutEffect(() => {
    const update = () => {
      const grid = anchorRef.current?.querySelector(FRETBOARD_GRID_SELECTOR);
      if (!(grid instanceof HTMLElement)) return;

      const top = grid.getBoundingClientRect().top;
      const next = `${top + BOUNDARY_BLEED_PX}px`;
      setBoundary((prev) => (prev === next ? prev : next));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);

    const anchor = anchorRef.current;
    if (anchor) {
      observer.observe(anchor);
    }

    const shell = anchor?.closest('.shell');
    if (shell instanceof Element) {
      observer.observe(shell);
    }

    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [anchorRef]);

  return boundary;
}
