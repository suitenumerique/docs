import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../../types';

export const GristChartBlock = createReactBlockSpec(
  {
    type: 'grist_chart',
    propSchema: {},
    content: 'none',
  },
  {
    render: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { colorsTokens } = useCunninghamTheme();

      return (
        <div>Hello world !</div>
      );
    },
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
    aliases: ['grist_chart', 'chart', 'graphique', 'pie chart', 'line chart', 'bar chart'],
    group,
    icon: <Icon iconName="bar_chart" $size="18px" />,
    subtext: t('Add a chart connected to a grist table.'),
  },
];
