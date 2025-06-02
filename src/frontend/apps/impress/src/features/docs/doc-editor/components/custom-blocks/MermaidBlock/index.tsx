import { createReactBlockSpec } from '@blocknote/react';
import React from 'react';

import { MermaidRenderer } from './components/MermaidRenderer';
import { getMermaidReactSlashMenuItems } from './components/SlashMenuItems';
import { blockSpec } from './config/blockConfig';

export const MermaidBlock = createReactBlockSpec(blockSpec, {
  render: (props) => {
    const { block, editor } = props;
    const handleDiagramChange = (newDiagram: string) => {
      editor.updateBlock(block, {
        props: {
          diagram: newDiagram,
          textAlignment: block.props.textAlignment,
          backgroundColor: block.props.backgroundColor,
        },
      });
    };

    return (
      <MermaidRenderer
        diagram={block.props.diagram}
        onDiagramChange={handleDiagramChange}
      />
    );
  },
});

export { getMermaidReactSlashMenuItems };
