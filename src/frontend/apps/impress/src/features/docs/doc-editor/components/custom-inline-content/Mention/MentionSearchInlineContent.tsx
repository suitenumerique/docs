import { StyleSchema } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';

import { inlineNodeCommentsPropSchema } from '@/docs/doc-comments/extensions/InlineNodeCommentsExtension';

import { Search } from './Search';

export type MentionSearchInlineContentType = {
  type: 'mentionSearchInline';
  propSchema: {
    disabled?: {
      default: false;
      values: [true, false];
    };
    trigger?: {
      default: '/';
      values: readonly ['/', '@'];
    };
    commentMarks?: {
      default: '';
    };
  };
  content: 'none';
};

/**
 * Transient inline content hosting the search of a mention. It replaces
 * itself by the inline content of the kind of mention the user picked.
 *
 * Info: it is the parent of every kind of mention (Interlinking, ...), they
 * do not know about it. Keep the type of the mentions themselves unchanged,
 * they are persisted in the documents.
 */
export const MentionSearchInlineContent = createReactInlineContentSpec<
  MentionSearchInlineContentType,
  StyleSchema
>(
  {
    type: 'mentionSearchInline',
    propSchema: {
      disabled: {
        default: false,
        values: [true, false],
      },
      trigger: {
        default: '/',
        values: ['/', '@'],
      },
      ...inlineNodeCommentsPropSchema,
    },
    content: 'none',
  },
  {
    render: (props) => {
      if (props.inlineContent.props.disabled) {
        return null;
      }

      return <Search {...props} />;
    },
  },
);
