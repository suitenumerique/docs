import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React from 'react';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSelector } from '../DatabaseSelector';

import { ChartEditor } from './charts/ChartEditor';
import { ChartType } from './charts/types';

export const GristChartBlock = createReactBlockSpec(
  {
    type: 'grist_chart',
    propSchema: {
      documentId: {
        default: '',
      },
      tableId: {
        default: '',
      },
      chartType: {
        default: 'bar',
      },
      chartOptions: {
        type: 'object',
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const chartOptions = {
        title: block.props.chartOptions,
        showLegend: true,
        xAxisLabel: '',
        yAxisLabel: '',
      };
      return (
        <Box
          style={{
            flexGrow: 1,
            flexDirection: 'row',
            width: '100%',
          }}
        >
          {block.props.documentId && block.props.tableId ? (
            <ChartEditor
              documentId={block.props.documentId}
              tableId={block.props.tableId}
              chartType={block.props.chartType as ChartType} // Passage de chartType
              chartOptions={chartOptions} // Passage de chartOptions
              onChartConfigChange={({ chartType, chartOptions }) => {
                editor.updateBlock(block, {
                  props: { chartType, chartOptions: chartOptions.title },
                });
              }}
            />
          ) : (
            <DatabaseSelector
              onDatabaseSelected={({ documentId, tableId }) => {
                editor.updateBlock(block, {
                  props: { documentId: documentId.toString(), tableId },
                });
              }}
            />
          )}
        </Box>
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
