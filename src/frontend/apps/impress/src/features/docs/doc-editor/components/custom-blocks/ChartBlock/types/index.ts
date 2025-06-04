import type { Block, BlockNoteEditor } from '@blocknote/core';

export interface ChartRendererProps {
  functions: string[];
  min: number;
  max: number;
  num: number;
  onFormulaChange: (functions: string[], min : number, max : number, num : number) => void;
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
