/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect } from 'react';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
    },
    content: 'inline',
  },
  {
    render: ({ block, editor }) => {
      // Temporary: sets a orange background color to a database block when added by
      // the user, while keeping the colors menu on the drag handler usable for
      // this custom block.
      useEffect(() => {
        if (
          !block.content.length &&
          block.props.backgroundColor === 'default'
        ) {
          editor.updateBlock(block, { props: { backgroundColor: 'orange' } });
        }
      }, [block, editor]);

      return (
        <Box
          $padding="1rem"
          $gap="0.625rem"
          style={{
            flexGrow: 1,
            flexDirection: 'row',
          }}
        >
          <Box as="p">🏗️ Database block is in development</Box>{' '}
        </Box>
      );
    },
  },
);

export const getDatabaseReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Database'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'database',
      });
    },
    aliases: ['database', 'encadré', 'hervorhebung', 'benadrukken'],
    group,
    icon: <Icon iconName="lightbulb" $size="18px" />,
    subtext: t('Add a database block'),
  },
];
