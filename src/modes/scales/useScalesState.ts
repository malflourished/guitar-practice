import { type ScaleAnchor } from '../../lib/audio/pitch';
import { SCALE_QUALITIES, getImpliedChordQuality } from '../../lib/music';
import { oneOf, usePersistentState } from '../../hooks/usePersistentState';
import type { ScaleQuality, ScaleSystem } from '../../types/music';

export function useScalesState() {
  const [scaleQuality, setScaleQuality] = usePersistentState<ScaleQuality>(
    'scale-quality',
    'minorPentatonic',
    oneOf(SCALE_QUALITIES),
  );
  const [scaleSystem, setScaleSystem] = usePersistentState<ScaleSystem>(
    'scale-system',
    'caged',
    oneOf(['caged', '3nps'] as const),
  );
  const [scaleAnchor, setScaleAnchor] = usePersistentState<ScaleAnchor>(
    'scale-anchor',
    'root',
    oneOf(['root', 'third', 'fifth'] as const),
  );
  return {
    scaleQuality,
    setScaleQuality,
    scaleSystem,
    setScaleSystem,
    scaleAnchor,
    setScaleAnchor,
    impliedChordQuality: getImpliedChordQuality(scaleQuality),
  };
}

export type ScalesState = ReturnType<typeof useScalesState>;
