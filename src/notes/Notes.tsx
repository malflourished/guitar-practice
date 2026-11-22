import { Suspense, lazy, useEffect } from 'react';
import { setNotesOpen, useNotesOpen } from './notesStore';

/**
 * Notes: the owner's way to say "this, here" about the running app. The N key
 * or the strip's Notes button turns the window into a sheet: click a thing to
 * pin a comment on it, or drag to circle and point. Each sheet is saved with
 * a screenshot (see noteTypes.ts) where the next person working on the app
 * can read it.
 *
 * Only this listener is in the main bundle. The layer loads when first used.
 */
const NotesOverlay = lazy(() => import('./NotesOverlay'));

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox';
}

export default function Notes() {
  const open = useNotesOpen();

  useEffect(() => {
    if (open) return undefined; // the layer has its own keys
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code !== 'KeyN' && event.key.toLowerCase() !== 'n') || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      setNotesOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <NotesOverlay onClose={() => setNotesOpen(false)} />
    </Suspense>
  );
}
