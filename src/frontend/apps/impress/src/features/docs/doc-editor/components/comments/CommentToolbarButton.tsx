import { useBlockNoteEditor, useComponentsContext } from '@blocknote/react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useDocStore } from '@/features/docs/doc-management';

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

  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();

  if (!editor.isEditable || !Components || !currentDoc?.abilities.comment) {
    return null;
  }

  return (
    <Box $direction="row" className="--docs--comment-toolbar-button">
      <Components.Generic.Toolbar.Button
        className="bn-button"
        onClick={() => {
          editor.comments?.startPendingComment();
        }}
        aria-haspopup="dialog"
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
            $theme="greyscale"
            $variation="600"
            $padding="0.15rem"
            $size="16px"
            $color={colorsTokens['greyscale-600']}
          />
          {t('Comment')}
        </Box>
      </Components.Generic.Toolbar.Button>
      <Box
        $background={colorsTokens['greyscale-100']}
        $width="1px"
        $height="70%"
        $margin={{ left: '2px' }}
        $css={css`
          align-self: center;
        `}
      />
    </Box>
  );
};
