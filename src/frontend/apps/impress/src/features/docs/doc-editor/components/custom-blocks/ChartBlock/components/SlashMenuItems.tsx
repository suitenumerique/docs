import { insertOrUpdateBlock } from '@blocknote/core';
import { TFunction } from 'i18next';
import React from 'react';

import { Icon } from '@/components';

import type { DocsBlockNoteEditor } from '../../../../types';
import { defaultFormula } from '../config/blockConfig';

export const getChartReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Chart'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'chart',
        props: {
          formula: defaultFormula,
        },
      });
    },
    aliases: ['latex', 'math', 'formula', 'equation', 'katex'],
    group,
    icon: <Icon iconName="line_axis" $size="18px" />,
    subtext: t('Plot a function defined with latex'),
  },
];
