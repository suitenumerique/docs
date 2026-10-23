import { describe, expect, it } from 'vitest';

import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';

import { COMMENT_MARKS_PROP } from '../InlineNodeCommentsExtension';

describe('inline nodes of the editor schema', () => {
  const inlineNodes = Object.values(blockNoteSchema.inlineContentSchema).filter(
    (config) => typeof config === 'object' && config.content === 'none',
  );

  it('has inline nodes', () => {
    expect(inlineNodes.length).toBeGreaterThan(0);
  });

  // Their comments are only kept in Yjs through this prop, see
  // InlineNodeCommentsExtension.
  it.each(inlineNodes.map((config) => [config.type, config]))(
    '%s spreads inlineNodeCommentsPropSchema',
    (_type, config) => {
      expect(config.propSchema).toHaveProperty(COMMENT_MARKS_PROP);
    },
  );
});
