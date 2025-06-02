import { createReactBlockSpec } from '@blocknote/react';
import React from 'react';

import { LatexRenderer } from './components/LatexRenderer';
import { getLatexReactSlashMenuItems } from './components/SlashMenuItems';
import { blockSpec } from './config/blockConfig';

export const LatexBlock = createReactBlockSpec(blockSpec, {
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
      <LatexRenderer
        formula={block.props.formula}
        onFormulaChange={handleFormulaChange}
      />
    );
  },
});

export { getLatexReactSlashMenuItems };
