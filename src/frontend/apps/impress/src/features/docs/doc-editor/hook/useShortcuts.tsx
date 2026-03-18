import { announce } from '@react-aria/live-announcer';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DocsBlockNoteEditor } from '../types';

const getFormattingShortcutLabel = (
  event: KeyboardEvent,
  t: (key: string) => string,
): string | null => {
  const isMod = event.ctrlKey || event.metaKey;
  if (!isMod) {
    return null;
  }

  if (event.altKey) {
    switch (event.code) {
      case 'Digit1':
        return t('Heading 1 applied');
      case 'Digit2':
        return t('Heading 2 applied');
      case 'Digit3':
        return t('Heading 3 applied');
      default:
        return null;
    }
  }

  if (event.shiftKey) {
    switch (event.code) {
      case 'Digit0':
        return t('Paragraph applied');
      case 'Digit6':
        return t('Toggle list applied');
      case 'Digit7':
        return t('Numbered list applied');
      case 'Digit8':
        return t('Bulleted list applied');
      case 'Digit9':
        return t('Checklist applied');
      case 'KeyC':
        return t('Code block applied');
      default:
        return null;
    }
  }

  return null;
};

export const useShortcuts = (
  editor: DocsBlockNoteEditor,
  el: HTMLDivElement | null,
) => {
  const { t } = useTranslation();

  const handleFormattingShortcut = useCallback(
    (event: KeyboardEvent) => {
      if (!editor?.isFocused()) {
        return;
      }

      const label = getFormattingShortcutLabel(event, t);
      if (label) {
        setTimeout(() => {
          announce(label, 'assertive');
        }, 150);
      }
    },
    [editor, t],
  );

  useEffect(() => {
    el?.addEventListener('keydown', handleFormattingShortcut, true);

    return () => {
      el?.removeEventListener('keydown', handleFormattingShortcut, true);
    };
  }, [el, handleFormattingShortcut]);

  useEffect(() => {
    // Check if editor and its view are mounted
    if (!editor || !el) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '@' && editor?.isFocused()) {
        const selection = window.getSelection();
        const previousChar =
          selection?.anchorNode?.textContent?.charAt(
            selection.anchorOffset - 1,
          ) || '';

        if (![' ', ''].includes(previousChar)) {
          return;
        }

        event.preventDefault();
        editor.insertInlineContent([
          {
            type: 'interlinkingSearchInline',
            props: {
              disabled: false,
              trigger: '@',
            },
          },
        ]);
      }
    };

    el.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, el]);
};
