import { useEffect } from 'react';

import { SELECTORS } from '../dom-selectors';

export const useKeyboardActivation = (
  keys: string[],
  enabled: boolean,
  action: () => void,
  capture = false,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const modal = document.querySelector(SELECTORS.MODAL_SCROLLER);

      if (modal) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // Don't intercept if user is typing in an editor
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toLowerCase();

        // Ignore if user is typing in a text field, textarea, or editor
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          activeElement.hasAttribute('contenteditable') ||
          activeElement.closest('[contenteditable]') ||
          activeElement.closest('.editor') ||
          activeElement.closest('[role="textbox"]') ||
          activeElement.closest('.cm-editor') || // CodeMirror
          activeElement.closest('.ProseMirror') || // ProseMirror
          activeElement.closest('.ql-editor') // Quill
        ) {
          return;
        }
      }

      // Only intercept if we're in the tree context (navigation)
      if (!activeElement?.closest('[role="tree"], .c__tree-view')) {
        return;
      }

      if (keys.includes(e.key)) {
        e.preventDefault();
        action();
      }
    };

    document.addEventListener('keydown', onKeyDown, capture);
    return () => document.removeEventListener('keydown', onKeyDown, capture);
  }, [keys, enabled, action, capture]);
};
