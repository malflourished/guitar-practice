import { Suspense, lazy, useState } from 'react';
import './SoundLab.css';

/**
 * The sound lab's panel: a page for each instrument we synthesize ourselves.
 * Each page compares versions of its instrument at matched loudness, and its
 * choice is what the jam loop plays. Closing a page stops its sound.
 *
 * - Bass (docs/specs/S1-modelled-bass.md): the synth bass against the modelled one.
 * - Drums (docs/specs/S2-drums.md): the acoustic, machine and brushes kits.
 */
const BassLab = lazy(() => import('./BassLab'));
const DrumLab = lazy(() => import('./DrumLab'));

type LabPage = 'bass' | 'drums';
const PAGE_KEY = 'vibrato:sound-lab-page';

function savedPage(): LabPage {
  try {
    return localStorage.getItem(PAGE_KEY) === 'bass' ? 'bass' : 'drums';
  } catch {
    return 'drums';
  }
}

export default function SoundLabPanel({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<LabPage>(savedPage);

  const choose = (next: LabPage) => {
    setPage(next);
    try {
      localStorage.setItem(PAGE_KEY, next);
    } catch {
      // storage is unavailable: the page is remembered until the panel closes
    }
  };

  return (
    <aside className="sound-panel" aria-label="Sound lab">
      <header>
        <strong>Sound</strong>
        <span className="sound-pages" role="group" aria-label="Instrument">
          <button type="button" aria-pressed={page === 'bass'} onClick={() => choose('bass')}>
            Bass
          </button>
          <button type="button" aria-pressed={page === 'drums'} onClick={() => choose('drums')}>
            Drums
          </button>
        </span>
        <button type="button" aria-label="Hide the panel" onClick={onClose}>
          ×
        </button>
      </header>
      <Suspense fallback={null}>{page === 'bass' ? <BassLab /> : <DrumLab />}</Suspense>
    </aside>
  );
}
