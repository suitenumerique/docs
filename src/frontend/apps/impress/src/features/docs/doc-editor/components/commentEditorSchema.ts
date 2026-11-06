import {
  BlockNoteSchema,
  createParagraphBlockSpec,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core';

import {
  InterlinkingLinkInlineContent,
  MentionSearchInlineContent,
  UserMentionInlineContent,
} from './custom-inline-content';

// Same blocks and styles as the default comment editor of BlockNote, which
// does not export it: paragraphs only, and no colors.
const {
  textColor: _textColor,
  backgroundColor: _backgroundColor,
  ...commentStyleSpecs
} = defaultStyleSpecs;

/**
 * Schema of the editors composing and displaying the comments. It adds the
 * mentions, so that "@" proposes the users and the docs as in the doc.
 */
export const commentEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: createParagraphBlockSpec(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    interlinkingLinkInline: InterlinkingLinkInlineContent,
    mentionSearchInline: MentionSearchInlineContent,
    userMentionInline: UserMentionInlineContent,
  },
  styleSpecs: commentStyleSpecs,
});
