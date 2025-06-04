import type { Block, BlockNoteEditor } from '@blocknote/core';
 

export interface SlashMenuItemProps {
  editor: BlockNoteEditor;
  t: (key: string) => string;
  group: string;
}
