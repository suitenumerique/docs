import { insertOrUpdateBlock } from '@blocknote/core';
import { TFunction } from 'i18next';
import React from 'react';

import { Icon } from '@/components';

import type { DocsBlockNoteEditor } from '../../../../types';
import { defaultFormula } from '../config/blockConfig';

export const getLatexReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('LaTeX Formula'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'latex',
        props: {
          formula: defaultFormula,
        },
      });
    },
    aliases: ['latex', 'math', 'formula', 'equation', 'katex'],
    group,
    icon: <Icon iconName="functions" $size="18px" />,
    subtext: t('Add a LaTeX formula block'),
  },
];
