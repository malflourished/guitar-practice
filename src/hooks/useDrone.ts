import { useEffect, useRef, useState } from 'react';
import { RootDrone } from '../lib/audio/drone';
import type { NoteName } from '../types/music';

interface DroneInput {
  /** The mode that offers the drone is showing (Scales). */
  available: boolean;
  root: NoteName;
  /** The engine's volume and mute: the drone follows both. */
  volume: number;
  muted: boolean;
}

/**
 * The Scales drone: on or off, holding the key note. It follows the key, the
 * volume and Mute, and goes off when the mode is left. It is not saved: sound
 * never starts on its own when the app opens.
 */
export function useDrone({ available, root, volume, muted }: DroneInput) {
  const [wanted, setWanted] = useState(false);
  if (!available && wanted) setWanted(false);
  const on = wanted && available;
  const droneRef = useRef<RootDrone | null>(null);
  const level = muted ? 0 : volume;

  useEffect(() => {
    if (!on) {
      droneRef.current?.stop();
      return;
    }
    const drone = (droneRef.current ??= new RootDrone());
    void drone.start(root);
  }, [on, root]);

  useEffect(() => {
    droneRef.current?.setLevel(level);
  }, [level, on]);

  useEffect(() => () => droneRef.current?.dispose(), []);

  return { on, toggle: () => setWanted((prev) => !prev) };
}
