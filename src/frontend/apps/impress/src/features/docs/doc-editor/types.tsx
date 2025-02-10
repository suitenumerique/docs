import { BlockNoteEditor } from '@blocknote/core';

import { blockNoteWithMultiColumn } from './utils';

export interface DocAttachment {
  file: string;
}

export type HeadingBlock = {
  id: string;
  type: string;
  text: string;
  content: HeadingBlock[];
  contentText: string;
  props: {
    level: number;
  };
};

export type DocsBlockNoteEditor = BlockNoteEditor<
  typeof blockNoteWithMultiColumn.blockSchema,
  typeof blockNoteWithMultiColumn.inlineContentSchema,
  typeof blockNoteWithMultiColumn.styleSchema
>;
