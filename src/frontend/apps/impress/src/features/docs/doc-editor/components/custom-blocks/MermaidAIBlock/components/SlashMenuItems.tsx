import { insertOrUpdateBlock } from '@blocknote/core';
import { TFunction } from 'i18next';
import React from 'react';

import { Icon } from '@/components';

import type { DocsBlockNoteEditor } from '../../../../types';

export const getMermaidAIReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Write Mermaid with AI'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'mermaidai',
        props: {}
      });
    },
    aliases: ['ai', 'mermaid', 'mermaidai'],
    group,
    icon: <Icon iconName="functions" $size="18px" />,
    subtext: t('Add a LaTeX formula block with AI'),
  },
];
