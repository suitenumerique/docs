import {
  AIMenu as AIMenuDefault,
  //AIMenuSuggestionItem,
  //getAIExtension,
  getDefaultAIMenuItems,
} from '@blocknote/xl-ai';
//import { RiEmotionHappyFill } from 'react-icons/ri';

import { DocsBlockNoteEditor } from '../../types';

export function AIMenu() {
  return (
    <AIMenuDefault
      items={(editor: DocsBlockNoteEditor, aiResponseStatus) => {
        if (aiResponseStatus === 'user-input') {
          if (editor.getSelection()) {
            // When a selection is active (so when the AI Menu is opened via the Formatting Toolbar),
            // we add our `makeInformal` command to the default items.
            return [
              ...getDefaultAIMenuItems(editor, aiResponseStatus),
              //aIMenuItemMakeInformal(editor),
            ];
          } else {
            return getDefaultAIMenuItems(editor, aiResponseStatus);
          }
        }

        // for other states, return the default items
        return getDefaultAIMenuItems(editor, aiResponseStatus);
      }}
    />
  );
}

// export const aIMenuItemMakeInformal = (
//   editor: DocsBlockNoteEditor,
// ): AIMenuSuggestionItem => ({
//   key: 'make_informal',
//   title: 'Make Informal',
//   aliases: ['informal', 'make informal', 'casual'],
//   icon: <RiEmotionHappyFill size={18} />,
//   onItemClick: () => {
//     void getAIExtension(editor).callLLM({
//       // The prompt to send to the LLM:
//       userPrompt: 'Give the selected text a more informal (casual) tone',
//       // Tell the LLM to specifically use the selected content as context (instead of the whole document)
//       useSelection: true,
//       // We only want the LLM to update selected text, not to add / delete blocks
//       defaultStreamTools: {
//         add: false,
//         delete: false,
//         update: true,
//       },
//     });
//   },
//   size: 'small',
// });
