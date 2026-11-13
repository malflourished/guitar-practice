import { createContext } from 'react';

/**
 * How the board tells its neck about the empty band above its fret numbers
 * (px, measured from the top of the board's container), so the neck can sit
 * its bar halfway between the neck's top edge and the fret numbers.
 */
export const NeckBandContext = createContext<((px: number) => void) | null>(null);
