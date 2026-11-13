import { useEffect, useRef } from 'react';

/** Fields where Space is a typed character or opens the control itself. */
export function spaceBelongsToTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('textarea, select, [contenteditable=""], [contenteditable="true"]')) {
    return true;
  }
  const input = target.closest('input');
  if (input) {
    return !['range', 'checkbox', 'radio', 'button'].includes(input.type);
  }
  // Menus and choice groups use Space to pick the focused choice.
  return Boolean(target.closest('[role="dialog"], [role="radiogroup"], [role="menu"]'));
}

/**
 * Space plays and stops, except while typing in a field or choosing in a
 * menu. A focused button would also "click" on Space, so that is cancelled
 * when Space was used to play.
 */
export function usePlaySpace(enabled: boolean, toggle: () => void) {
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let handled = false;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (spaceBelongsToTarget(event.target)) return;
      handled = true;
      event.preventDefault();
      if (!event.repeat) toggleRef.current();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !handled) return;
      handled = false;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);
}
