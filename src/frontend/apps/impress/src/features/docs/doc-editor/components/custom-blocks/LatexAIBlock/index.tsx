import { createReactBlockSpec } from '@blocknote/react';
import React, { useRef, useState } from 'react';
import { Box, Icon } from '@/components';

import { callAlbertAI} from '../shared/calls'

import { getLatexAIReactSlashMenuItems } from './components/SlashMenuItems';
import { blockStyles } from '../shared/styles';
import { blockSpec } from './config/blockConfig';

export const LatexAIBlock = createReactBlockSpec(blockSpec, {
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
            callAlbertAI('latex', prompt).then((res) => {
              editor.replaceBlocks([block.id], [{
                type : 'latex',
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
        <textarea value={prompt} disabled={textD} onChange={(e) => setPrompt(e.target.value)}/>
      </Box>
    );
  },
});

export { getLatexAIReactSlashMenuItems };
