import { Suspense, lazy, useEffect, useState } from 'react';

/**
 * The sound lab: a hidden panel for judging instrument sounds by ear
 * (docs/specs/S1-modelled-bass.md). The backslash key (\) opens and closes it.
 *
 * It plays a bass line, or the 12-bar blues, through the synth bass (A) and
 * the modelled bass (B) at matched loudness, flips between them without a
 * gap, and exposes the model's controls. The choice of A or B is also the
 * bass the jam loop plays.
 *
 * Only this small listener is in the app's main bundle. The panel and the
 * modelled bass load the first time the lab is opened.
 */
const SoundLabPanel = lazy(() => import('./SoundLabPanel'));

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox';
}

export default function SoundLab() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The physical key, or the character for keyboards and tools that do not report one.
      if ((event.code !== 'Backslash' && event.key !== '\\') || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <SoundLabPanel onClose={() => setOpen(false)} />
    </Suspense>
  );
}
