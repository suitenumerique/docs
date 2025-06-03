import type { Block, BlockNoteEditor } from '@blocknote/core';

export interface ChartRendererProps {
  formula: string;
  onFormulaChange: (formula: string) => void;
}

export interface ChartBlockProps {
  block: Block;
  editor: BlockNoteEditor;
}

export interface SlashMenuItemProps {
  editor: BlockNoteEditor;
  t: (key: string) => string;
  group: string;
}
