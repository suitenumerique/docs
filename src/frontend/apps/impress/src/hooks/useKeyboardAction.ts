import { KeyboardEvent, useCallback } from 'react';

/**
 * Hook to handle keyboard actions (Enter and Space) on interactive elements.
 * Prevents default behavior and stops propagation to avoid conflicts.
 *
 * @param callback - The function to execute when Enter or Space is pressed
 * @returns A keyboard event handler function

 */
export const useKeyboardAction = (callback: () => void) => {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        callback();
      }
    },
    [callback],
  );
};
