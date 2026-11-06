import { describe, expect, it } from 'vitest';

import { commentEditorSchema } from '../commentEditorSchema';
import { MentionSearchInlineContent } from '../custom-inline-content';

describe('commentEditorSchema', () => {
  it('lets the comments hold the mentions and open their search with "@"', () => {
    expect(Object.keys(commentEditorSchema.inlineContentSpecs)).toEqual(
      expect.arrayContaining([
        'interlinkingLinkInline',
        'mentionSearchInline',
        'userMentionInline',
      ]),
    );
    // The spec of the search carries the extension opening it on "@"
    expect(
      commentEditorSchema.inlineContentSpecs.mentionSearchInline.extensions,
    ).toEqual(MentionSearchInlineContent.extensions);
    expect(MentionSearchInlineContent.extensions).toHaveLength(1);
  });

  it('keeps the blocks and the styles of the default comment editor', () => {
    expect(Object.keys(commentEditorSchema.blockSpecs)).toEqual(['paragraph']);
    expect(commentEditorSchema.styleSpecs).not.toHaveProperty('textColor');
    expect(commentEditorSchema.styleSpecs).not.toHaveProperty(
      'backgroundColor',
    );
  });
});
