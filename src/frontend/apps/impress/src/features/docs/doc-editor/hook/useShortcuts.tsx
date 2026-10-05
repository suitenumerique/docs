import { announce } from '@react-aria/live-announcer';
import type { TFunction } from 'i18next';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useFindReplaceShortcut } from '@/docs/doc-find-replace/hooks/useFindReplaceShortcut';

import { DocsBlockNoteEditor } from '../types';

const getFormattingShortcutLabel = (
  event: KeyboardEvent,
  t: TFunction<'translation', undefined>,
): string | null => {
  const isMod = event.ctrlKey || event.metaKey;
  if (!isMod) {
    return null;
  }

  if (event.altKey) {
    switch (event.code) {
      case 'Digit1':
        return t('Heading 1 applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a heading level 1',
        });
      case 'Digit2':
        return t('Heading 2 applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a heading level 2',
        });
      case 'Digit3':
        return t('Heading 3 applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a heading level 3',
        });
      default:
        return null;
    }
  }

  if (event.shiftKey) {
    switch (event.code) {
      case 'Digit0':
        return t('Paragraph applied', {
          description:
            'Screen reader announcement after a keyboard shortcut turned a block into a paragraph',
        });
      case 'Digit6':
        return t('Toggle list applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a collapsible list',
        });
      case 'Digit7':
        return t('Numbered list applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a numbered list',
        });
      case 'Digit8':
        return t('Bulleted list applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a bulleted list',
        });
      case 'Digit9':
        return t('Checklist applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a checklist',
        });
      case 'KeyC':
        return t('Code block applied', {
          description:
            'Screen reader announcement after a keyboard shortcut applied a code block',
        });
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
  useFindReplaceShortcut(editor);

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
            type: 'interlinkingLinkInline',
            props: {
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
