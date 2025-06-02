import type { Block, BlockNoteEditor } from '@blocknote/core';

export interface MermaidRendererProps {
  diagram: string;
  onDiagramChange: (diagram: string) => void;
}

export interface MermaidBlockProps {
  block: Block;
  editor: BlockNoteEditor;
}

export interface SlashMenuItemProps {
  editor: BlockNoteEditor;
  t: (key: string) => string;
  group: string;
}
