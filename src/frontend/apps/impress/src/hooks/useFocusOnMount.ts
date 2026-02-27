import { RefObject, useEffect } from 'react';

const DEFAULT_DELAY_MS = 100;

/**
 * Focus the target element when the component mounts (or when enabled becomes true).
 * Useful for modals to move focus to the first interactive element on open.
 */
export const useFocusOnMount = <T extends { focus?: () => void }>(
  ref: RefObject<T | null | undefined>,
  delayMs = DEFAULT_DELAY_MS,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timeoutId = setTimeout(() => {
      ref.current?.focus?.();
    }, delayMs);
    return () => clearTimeout(timeoutId);
  }, [ref, delayMs, enabled]);
};
