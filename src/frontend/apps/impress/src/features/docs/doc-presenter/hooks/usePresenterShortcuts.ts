import { useEffect } from 'react';

interface ShortcutHandlers {
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  isFullscreen: boolean;
}

const ARROW_CODES = new Set(['ArrowLeft', 'ArrowRight']);

export const usePresenterShortcuts = ({
  onPrev,
  onNext,
  onFirst,
  onLast,
  onToggleFullscreen,
  onClose,
  isFullscreen,
}: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && !ARROW_CODES.has(event.code)) {
        return;
      }

      switch (event.code) {
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          onPrev();
          return;
        case 'Space': {
          // A focused button activates on `keyup` (native click). If we
          // also call onNext() here on `keydown`, Space on the toolbar's
          // Next button fires twice. Skip when the event target handles
          // Space natively.
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest(
              'button, [role="button"], a, input, textarea, select, [contenteditable="true"]',
            )
          ) {
            return;
          }
          event.preventDefault();
          onNext();
          return;
        }
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault();
          onNext();
          return;
        case 'Home':
          event.preventDefault();
          onFirst();
          return;
        case 'End':
          event.preventDefault();
          onLast();
          return;
        case 'KeyF':
          if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
          }
          event.preventDefault();
          onToggleFullscreen();
          return;
        case 'Escape':
          // While fullscreen, the browser handles Esc natively (exits
          // fullscreen) and we deliberately stay open. Once out of
          // fullscreen, Esc closes the presenter.
          if (!isFullscreen) {
            event.preventDefault();
            onClose();
          }
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    onPrev,
    onNext,
    onFirst,
    onLast,
    onToggleFullscreen,
    onClose,
    isFullscreen,
  ]);
};
