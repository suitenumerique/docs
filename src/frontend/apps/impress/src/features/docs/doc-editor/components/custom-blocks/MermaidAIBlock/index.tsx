import { createReactBlockSpec } from '@blocknote/react';
import React, { useRef, useState } from 'react';
import { Box, Icon } from '@/components';

import { callAlbertAI} from '../shared/calls'

import { getMermaidAIReactSlashMenuItems } from './components/SlashMenuItems';
import { blockStyles } from '../shared/styles';
import { blockSpec } from './config/blockConfig';

export const MermaidAIBlock = createReactBlockSpec(blockSpec, {
  render: (props) => {
    const { block, editor } = props;
    const [prompt, setPrompt] = useState("");
    const [textD, setTextD] = useState(false);

    return (
      <Box
        $padding="1rem"
        style={blockStyles.container}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            callAlbertAI('mermaid', prompt).then((res) => {
              editor.replaceBlocks([block.id], [{
                type : 'mermaid',
                props : {
                  formula : res
                }
              }]);
            })
            setTextD(true);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <textarea autoFocus={true} value={prompt} disabled={textD} onChange={(e) => setPrompt(e.target.value)}/>
      </Box>
    );
  },
});

export { getMermaidAIReactSlashMenuItems };
