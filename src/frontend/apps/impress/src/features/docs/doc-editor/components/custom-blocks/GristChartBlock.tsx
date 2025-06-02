import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

import { Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

import { ChartEditor } from './charts/ChartEditor';

export const GristChartBlock = createReactBlockSpec(
  {
    type: 'grist_chart',
    propSchema: {},
    content: 'none',
  },
  {
    render: ChartEditor,
  },
);

export const getGristChartReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Chart'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'grist_chart',
      });
    },

    aliases: [
      'grist_chart',
      'chart',
      'graphique',
      'pie chart',
      'line chart',
      'bar chart',
    ],
    group,
    icon: <Icon iconName="bar_chart" $size="18px" />,
    subtext: t('Add a chart connected to a grist table.'),
  },
];
