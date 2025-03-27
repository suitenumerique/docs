import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../../types';

export const DividerBlock = createReactBlockSpec(
  {
    type: 'divider',
    propSchema: {},
    content: 'none',
  },
  {
    render: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { colorsTokens } = useCunninghamTheme();

      return (
        <Box
          as="hr"
          $width="100%"
          $background={colorsTokens()['greyscale-300']}
          $margin="1rem 0"
          $css={`border: 1px solid ${colorsTokens()['greyscale-300']};`}
        />
      );
    },
  },
);

export const getDividerReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Divider'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'divider',
      });
    },
    aliases: ['divider', 'hr', 'horizontal rule', 'line', 'separator'],
    group,
    icon: <Icon iconName="remove" $size="18px" />,
    subtext: t('Add a horizontal line'),
  },
];
