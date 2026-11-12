import { createContext } from 'react';

/** Docked beside the neck, a drawer over it (small windows), or not shown. */
export type SideState = 'docked' | 'drawer' | 'closed';

interface FrameContextValue {
  side: SideState;
  /** The panel has been asked to close and is fading out. */
  closing: boolean;
  closeSide: () => void;
}

export const FrameContext = createContext<FrameContextValue>({
  side: 'closed',
  closing: false,
  closeSide: () => {},
});
