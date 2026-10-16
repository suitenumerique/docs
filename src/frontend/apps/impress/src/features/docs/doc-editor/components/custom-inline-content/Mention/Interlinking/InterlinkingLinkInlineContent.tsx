import { StyleSchema } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import * as Sentry from '@sentry/nextjs';
import { TFunction } from 'i18next';
import { useEffect } from 'react';
import { validate as uuidValidate } from 'uuid';

import LinkPageIcon from '@/docs/doc-editor/assets/doc-link.svg';
import AddPageIcon from '@/docs/doc-editor/assets/doc-plus.svg';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { useCreateChildDocTree, useDocStore } from '@/docs/doc-management';

import { LinkSelected } from './LinkSelected';

export type InterlinkingLinkInlineContentType = {
  type: 'interlinkingLinkInline';
  propSchema: {
    /**
     * @deprecated Only set by the former search state of this inline content,
     * now `mentionSearchInline`. Kept to read the documents saved before.
     */
    disabled?: {
      default: false;
      values: [true, false];
    };
    docId?: {
      default: '';
    };
    blockId?: {
      default: '';
    };
    /**
     * @deprecated See `disabled`.
     */
    trigger?: {
      default: '/';
      values: readonly ['/', '@'];
    };
  };
  content: 'none';
};

export const InterlinkingLinkInlineContent = createReactInlineContentSpec<
  InterlinkingLinkInlineContentType,
  StyleSchema
>(
  {
    type: 'interlinkingLinkInline',
    propSchema: {
      docId: {
        default: '',
      },
      blockId: {
        default: '',
      },
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
    render: (props) => (
      <InterlinkingLink
        docId={props.inlineContent.props.docId}
        blockId={props.inlineContent.props.blockId}
        disabled={props.inlineContent.props.disabled}
        isEditable={props.editor.isEditable}
        onDisable={() => {
          props.updateInlineContent({
            type: 'interlinkingLinkInline',
            props: {
              disabled: true,
            },
          });
        }}
      />
    ),
  },
);

interface InterlinkingLinkProps {
  docId?: string;
  blockId?: string;
  disabled?: boolean;
  isEditable: boolean;
  onDisable: () => void;
}

/**
 * Can have 2 render states:
 * 1. Linked state: when the inline content has a docId, it renders the linked doc.
 * 2. Empty state: otherwise, it renders nothing. It is what remains in the
 *    documents saved while this inline content was also the search of the
 *    mentions, now `mentionSearchInline`.
 */
export const InterlinkingLink = ({
  docId,
  blockId,
  disabled,
  isEditable,
  onDisable,
}: InterlinkingLinkProps) => {
  if (disabled || !docId) {
    return null;
  }

  /**
   * Should not happen
   */
  if (!uuidValidate(docId)) {
    return <DisableInvalidInterlink docId={docId} onDisable={onDisable} />;
  }

  return (
    <LinkSelected docId={docId} blockId={blockId} isEditable={isEditable} />
  );
};

export const getInterlinkinghMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
  createPage: () => void,
) => [
  {
    key: 'link-doc',
    title: t('Link a doc'),
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: 'mentionSearchInline',
          props: {
            trigger: '/',
          },
        },
      ]);
    },
    aliases: ['interlinking', 'link', 'anchor', 'a'],
    group,
    icon: <LinkPageIcon />,
    subtext: t('Link this doc to another doc'),
  },
  {
    key: 'new-sub-doc',
    title: t('New sub-doc'),
    onItemClick: createPage,
    aliases: ['new sub-doc'],
    group,
    icon: <AddPageIcon />,
    subtext: t('Create a new sub-doc'),
  },
];

export const useGetInterlinkingMenuItems = () => {
  const { currentDoc } = useDocStore();
  const createChildDoc = useCreateChildDocTree(currentDoc?.id);

  return (
    editor: DocsBlockNoteEditor,
    t: TFunction<'translation', undefined>,
  ) => getInterlinkinghMenuItems(editor, t, t('Links'), createChildDoc);
};

const DisableInvalidInterlink = ({
  docId,
  onDisable,
}: {
  docId: string;
  onDisable: () => void;
}) => {
  useEffect(() => {
    Sentry.captureException(new Error(`Invalid docId: ${docId}`), {
      extra: { info: 'InterlinkingInlineContent' },
    });

    onDisable();
  }, [docId, onDisable]);

  return null;
};
