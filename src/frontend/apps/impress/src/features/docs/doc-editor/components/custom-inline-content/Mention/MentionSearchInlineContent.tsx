import { StyleSchema } from '@blocknote/core';
import {
  ReactCustomInlineContentRenderProps,
  createReactInlineContentSpec,
} from '@blocknote/react';

import { MentionTriggerExtension } from './MentionTriggerExtension';
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
  };
  content: 'none';
};

type MentionSearchRenderProps = ReactCustomInlineContentRenderProps<
  MentionSearchInlineContentType,
  StyleSchema
>;

/**
 * A read-only editor displaying a search left open when the content was
 * saved (a comment) must not open it and take the focus.
 */
export const MentionSearchRender = (props: MentionSearchRenderProps) => {
  if (props.inlineContent.props.disabled || !props.editor.isEditable) {
    return null;
  }

  return <Search {...props} />;
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
    },
    content: 'none',
  },
  {
    render: (props) => <MentionSearchRender {...props} />,
  },
  [MentionTriggerExtension()],
);
