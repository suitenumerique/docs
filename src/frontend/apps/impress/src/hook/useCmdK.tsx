import { useEffect } from 'react';

export const useCmdK = (callback: () => void) => {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();

        const isProseMirrorFocused =
          document.activeElement?.classList.contains('ProseMirror');
        if (isProseMirrorFocused) {
          return;
        }

        callback();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [callback]);
};
