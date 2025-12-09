/**
 * This file is adapted from BlockNote's AddCommentButton component
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/components/FormattingToolbar/DefaultButtons/AddCommentButton.tsx
 */

import {
  useBlockNoteEditor,
  useComponentsContext,
  useSelectedBlocks,
} from '@blocknote/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useDocStore } from '@/features/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

export const CommentToolbarButton = () => {
  const Components = useComponentsContext();
  const { currentDoc } = useDocStore();
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();

  const selectedBlocks = useSelectedBlocks(editor);

  const show = useMemo(() => {
    return !!selectedBlocks.find((block) => block.content !== undefined);
  }, [selectedBlocks]);

  const focusOnInputThread = () => {
    // Use setTimeout to ensure the DOM has been updated with the new comment
    setTimeout(() => {
      const threadElement = document.querySelector<HTMLElement>(
        '.bn-thread .bn-editor',
      );
      threadElement?.focus();
    }, 400);
  };

  if (
    !isDesktop ||
    !show ||
    !editor.isEditable ||
    !Components ||
    !currentDoc?.abilities.comment
  ) {
    return null;
  }

  return (
    <Box $direction="row" className="--docs--comment-toolbar-button">
      <Components.Generic.Toolbar.Button
        className="bn-button"
        onClick={() => {
          editor.comments?.startPendingComment();
          editor.formattingToolbar.closeMenu();
          focusOnInputThread();
        }}
        aria-haspopup="dialog"
        data-test="comment-toolbar-button"
      >
        <Box
          $direction="row"
          $align="center"
          $gap={spacingsTokens['xs']}
          $padding={{ right: '2xs' }}
        >
          <Icon
            iconName="comment"
            className="--docs--icon-bg"
            $theme="gray"
            $padding="0.15rem"
            $size="md"
          />
          {t('Comment')}
        </Box>
      </Components.Generic.Toolbar.Button>
      <Box
        $background={colorsTokens['gray-100']}
        $width="1px"
        $height="70%"
        $margin={{ left: 'var(--c--globals--spacings--4xs)' }}
        $css={css`
          align-self: center;
        `}
      />
    </Box>
  );
};
