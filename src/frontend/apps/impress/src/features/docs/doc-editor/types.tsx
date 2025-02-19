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

export type DocsBlockSchema = typeof blockNoteSchema.blockSchema;
export type DocsInlineContentSchema =
  typeof blockNoteSchema.inlineContentSchema;
export type DocsStyleSchema = typeof blockNoteSchema.styleSchema;
export type DocsBlockNoteEditor = BlockNoteEditor<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema
>;
