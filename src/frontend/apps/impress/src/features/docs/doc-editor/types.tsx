import { BlockNoteEditor } from '@blocknote/core';

import { blockNoteSchema } from './components/BlockNoteEditor';

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
  typeof blockNoteSchema.blockSchema,
  typeof blockNoteSchema.inlineContentSchema,
  typeof blockNoteSchema.styleSchema
>;
