import { Fader } from '../../components/Fader';
import type { FaderLevel, JamLayer, JamMix } from '../../lib/audio/jamMix';
import styles from './ProgressionsDeck.module.css';

interface MixFadersProps {
  mix: JamMix;
  onChange: (layer: JamLayer, level: FaderLevel) => void;
}

const LAYERS: { layer: JamLayer; label: string }[] = [
  { layer: 'guitar', label: 'Guitar' },
  { layer: 'bass', label: 'Bass' },
  { layer: 'pad', label: 'Pad' },
  { layer: 'drums', label: 'Drums' },
];

/**
 * The jam's mix: a fader each for the guitar, the bass, the pad and the
 * drums, at the deck's right end. They show whenever Progressions is open, so the mix can be
 * set before Play, and they move live while the loop plays.
 */
export function MixFaders({ mix, onChange }: MixFadersProps) {
  return (
    <div className={styles.mix} role="group" aria-label="Mix">
      {LAYERS.map(({ layer, label }) => (
        <Fader key={layer} label={label} level={mix[layer] ?? 'off'} onChange={(level) => onChange(layer, level)} />
      ))}
    </div>
  );
}
