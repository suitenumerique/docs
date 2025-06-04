import { createReactBlockSpec } from '@blocknote/react';
import React from 'react';

import { ChartRenderer } from './components/ChartRenderer';
import { getChartReactSlashMenuItems } from './components/SlashMenuItems';
import { blockSpec } from './config/blockConfig';

export const ChartBlock = createReactBlockSpec(blockSpec, {
  render: (props) => {
    const { block, editor } = props;
    const handleFormulaChange = (newFunctions: string[], newMin : number, newMax : number, newNum : number) => {
      editor.updateBlock(block, {
        props: {
          functions: newFunctions,
          min: newMin,
          max: newMax,
          num: newNum,
          textAlignment: block.props.textAlignment,
          backgroundColor: block.props.backgroundColor,
        },
      });
    };

    return (
      <ChartRenderer
        functions={block.props.functions}
        min = {block.props.min}
        max = {block.props.max}
        num = {block.props.num}
        onFormulaChange={handleFormulaChange}
      />
    );
  },
});

export { getChartReactSlashMenuItems };
