import { createReactBlockSpec } from '@blocknote/react';
import React from 'react';

import { ChartRenderer } from './components/ChartRenderer';
import { getChartReactSlashMenuItems } from './components/SlashMenuItems';
import { blockSpec } from './config/blockConfig';

export const ChartBlock = createReactBlockSpec(blockSpec, {
  render: (props) => {
    const { block, editor } = props;
    const handleFormulaChange = (newFormula: string) => {
      editor.updateBlock(block, {
        props: {
          formula: newFormula,
          textAlignment: block.props.textAlignment,
          backgroundColor: block.props.backgroundColor,
        },
      });
    };

    return (
      <ChartRenderer
        formula={block.props.formula}
        onFormulaChange={handleFormulaChange}
      />
    );
  },
});

export { getChartReactSlashMenuItems };
