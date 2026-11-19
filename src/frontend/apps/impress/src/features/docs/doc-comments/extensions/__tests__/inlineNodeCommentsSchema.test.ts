import { describe, expect, it } from 'vitest';

import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';

import { COMMENTABLE_INLINE_NODES } from '../InlineNodeCommentsExtension';

// Transient, never kept in a document.
const NOT_COMMENTABLE = ['mentionSearchInline'];

describe('inline nodes of the editor schema', () => {
  const inlineNodes = Object.values(blockNoteSchema.inlineContentSchema)
    .filter(
      (config) =>
        typeof config === 'object' &&
        config.content === 'none' &&
        !NOT_COMMENTABLE.includes(config.type),
    )
    .map((config) => (typeof config === 'object' ? config.type : ''));

  it('has inline nodes', () => {
    expect(inlineNodes.length).toBeGreaterThan(0);
  });

  // Their comments are only kept in Yjs through the attribute of
  // InlineNodeCommentsExtension.
  it.each(inlineNodes)('%s keeps its comments', (type) => {
    expect(COMMENTABLE_INLINE_NODES).toContain(type);
  });
});
