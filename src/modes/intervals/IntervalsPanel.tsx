import type { ReactNode } from 'react';

/**
 * Intervals side panel: this key. The drill itself (neck, tabs, prompts) is
 * `IntervalTrainer`, which App wires in whole and which owns its own deck.
 */
export function IntervalsPanel({ keyContext }: { keyContext: ReactNode }) {
  return <>{keyContext}</>;
}
