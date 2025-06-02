import { createReactBlockSpec } from '@blocknote/react';
import React from 'react';

import { LatexRenderer } from './components/LatexRenderer';
import { getLatexReactSlashMenuItems } from './components/SlashMenuItems';
import { blockSpec } from './config/blockConfig';
import type { LatexBlockProps } from './types';

export const LatexBlock = createReactBlockSpec(blockSpec, {
  render: ({ block, editor }: LatexBlockProps) => {
    const handleFormulaChange = (newFormula: string) => {
      editor.updateBlock(block, {
        props: { formula: newFormula },
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
