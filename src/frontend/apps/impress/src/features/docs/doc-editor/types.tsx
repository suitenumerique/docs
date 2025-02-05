import { BlockNoteEditor, BlockNoteSchema } from '@blocknote/core';

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

export const blockNoteInstance = BlockNoteSchema.create();
export type DocsBlockSchema = typeof blockNoteInstance.blockSchema;
export type DocsInlineContentSchema =
  typeof blockNoteInstance.inlineContentSchema;
export type DocsStyleSchema = typeof blockNoteInstance.styleSchema;
export type DocsBlockNoteEditor = BlockNoteEditor<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema
>;
export type DocsBlockNoteSchema = BlockNoteSchema<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema
>;
