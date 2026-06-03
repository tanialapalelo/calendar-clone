'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when a loading operation has been in-progress for longer
 * than `thresholdMs` without resolving.
 *
 * Used to show a "service is warming up" message during Render cold-starts
 * (typically 30-90 s) rather than leaving the user on a silent loading screen.
 *
 * Resets automatically to false as soon as `loading` becomes false.
 */
export function useSlowConnection(loading: boolean, thresholdMs = 6_000): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), thresholdMs);
    return () => clearTimeout(timer);
  }, [loading, thresholdMs]);

  return isSlow;
}
