import { insertOrUpdateBlock } from '@blocknote/core';
import { TFunction } from 'i18next';
import React from 'react';

import { Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../../../types';
import { defaultDiagram } from '../config/blockConfig';

export const getMermaidReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Mermaid Diagram'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'mermaid',
        props: {
          diagram: defaultDiagram,
        },
      });
    },
    aliases: ['mermaid', 'diagram', 'flowchart', 'graph', 'chart'],
    group,
    icon: <Icon iconName="account_tree" $size="18px" />,
    subtext: t('Add a Mermaid diagram block'),
  },
];
