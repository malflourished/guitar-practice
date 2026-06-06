import type { Tier } from '../types/music';
import { TIER_ORDER, TIERS } from '../lib/tiers';
import styles from './TierSelector.module.css';

interface TierSelectorProps {
  tier: Tier;
  onChange: (tier: Tier) => void;
}

export function TierSelector({ tier, onChange }: TierSelectorProps) {
  return (
    <div className={styles.container} role="group" aria-label="Complexity level">
      {TIER_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={tier === id ? styles.optionSelected : styles.option}
          aria-pressed={tier === id}
          onClick={() => onChange(id)}
        >
          {TIERS[id].label}
        </button>
      ))}
    </div>
  );
}
