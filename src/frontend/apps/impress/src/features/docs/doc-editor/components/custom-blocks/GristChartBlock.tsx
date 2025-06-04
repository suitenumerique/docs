import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

import {Box, Icon} from '@/components';

import { DocsBlockNoteEditor } from '../../types';

import { ChartEditor } from './charts/ChartEditor';
import { DatabaseSelector } from '../DatabaseSelector';
import React from "react";

export const GristChartBlock = createReactBlockSpec(
  {
    type: 'grist_chart',
    propSchema: {
      documentId: {
        type: 'string',
        default: '',
      },
      tableId: {
        type: 'string',
        default: '',
      },
      chartType: {
        type: 'string',
        default: 'bar',
      },
      chartOptions: {
        type: 'object',
        default: {},
      },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
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
              chartType={block.props.chartType} // Passage de chartType
              chartOptions={block.props.chartOptions} // Passage de chartOptions
              onChartConfigChange={({ chartType, chartOptions }) => {
                editor.updateBlock(block, {
                  props: { chartType, chartOptions },
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
