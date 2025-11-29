import { KeyboardEvent, useCallback } from 'react';

type KeyboardActionCallback = () => void | Promise<unknown>;
type KeyboardActionHandler = (event: KeyboardEvent<HTMLElement>) => void;

/**
 * Hook to create keyboard handlers that trigger the provided callback
 * when the user presses Enter or Space.
 */
export const useKeyboardAction = () => {
  return useCallback(
    (callback: KeyboardActionCallback): KeyboardActionHandler =>
      (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          void callback();
        }
      },
    [],
  );
};
