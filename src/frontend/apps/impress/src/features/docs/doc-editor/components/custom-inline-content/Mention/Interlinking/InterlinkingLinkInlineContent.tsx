import { StyleSchema } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import * as Sentry from '@sentry/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { validate as uuidValidate } from 'uuid';

import LinkPageIcon from '@/docs/doc-editor/assets/doc-link.svg';
import AddPageIcon from '@/docs/doc-editor/assets/doc-plus.svg';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import {
  Doc,
  KEY_DOC,
  useCreateChildDocTree,
  useDocStore,
} from '@/docs/doc-management';

import { LinkSelected } from './LinkSelected';
import { getBlockAnchorLabel } from './getBlockAnchorLabel';

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
     * The text shown instead of the title of the doc or the text of the
     * block, e.g. the text the link was pasted on
     */
    label?: {
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
      label: {
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
        label={props.inlineContent.props.label}
        disabled={props.inlineContent.props.disabled}
        isEditable={props.editor.isEditable}
        editor={props.editor as unknown as DocsBlockNoteEditor}
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
    toExternalHTML: (props) => (
      <InterlinkingLinkExternal
        docId={props.inlineContent.props.docId}
        blockId={props.inlineContent.props.blockId}
        label={props.inlineContent.props.label}
        disabled={props.inlineContent.props.disabled}
        editor={props.editor as unknown as DocsBlockNoteEditor}
      />
    ),
  },
);

/**
 * The external HTML is what other apps get from the clipboard (office
 * suites, mails) and the source of the Markdown export: a plain link to the
 * doc, the rendered one being a span. Its text is the one the editor shows,
 * read from the docs already loaded: it is rendered synchronously.
 */
export const InterlinkingLinkExternal = ({
  docId,
  blockId,
  label,
  disabled,
  editor,
}: Pick<
  InterlinkingLinkProps,
  'docId' | 'blockId' | 'label' | 'disabled' | 'editor'
>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { currentDoc } = useDocStore();

  if (disabled || !docId || !uuidValidate(docId)) {
    return null;
  }

  const path = `/docs/${docId}/${blockId ? `#${blockId}` : ''}`;
  const blockLabel =
    editor && blockId && currentDoc?.id === docId
      ? getBlockAnchorLabel(editor, blockId, t)?.text
      : undefined;
  const text =
    label ||
    blockLabel ||
    queryClient.getQueryData<Doc>([KEY_DOC, { id: docId }])?.title ||
    path;

  return <a href={`${window.location.origin}${path}`}>{text}</a>;
};

interface InterlinkingLinkProps {
  docId?: string;
  blockId?: string;
  label?: string;
  disabled?: boolean;
  isEditable: boolean;
  editor?: DocsBlockNoteEditor;
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
  label,
  disabled,
  isEditable,
  editor,
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
    <LinkSelected
      docId={docId}
      blockId={blockId}
      label={label}
      isEditable={isEditable}
      editor={editor}
    />
  );
};

export const getInterlinkinghMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
  // Left out when the user cannot create a child of the current doc
  createPage?: () => void,
) => [
  {
    key: 'link-doc',
    title: t('Link a doc', {
      description: 'Editor menu entry to insert a link to another doc',
    }),
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
    subtext: t('Link this doc to another doc', {
      description: 'Description of the "Link a doc" editor menu entry',
    }),
  },
  ...(createPage
    ? [
        {
          key: 'new-sub-doc',
          title: t('New sub-doc', {
            description: 'Action to create a doc nested under the current doc',
          }),
          onItemClick: createPage,
          aliases: ['new sub-doc'],
          group,
          icon: <AddPageIcon />,
          subtext: t('Create a new sub-doc', {
            description: 'Description of the "New sub-doc" editor menu entry',
          }),
        },
      ]
    : []),
];

/**
 * Group of the editor menu holding the link entries
 */
export const getLinksGroupTitle = (t: TFunction<'translation', undefined>) =>
  t('Links', {
    description: 'Group title of the link entries in the editor menu',
  });

export const useGetInterlinkingMenuItems = () => {
  const { currentDoc } = useDocStore();
  const createChildDoc = useCreateChildDocTree(currentDoc?.id);
  const canCreateChildDoc = !!currentDoc?.abilities.children_create;

  return (
    editor: DocsBlockNoteEditor,
    t: TFunction<'translation', undefined>,
  ) =>
    getInterlinkinghMenuItems(
      editor,
      t,
      getLinksGroupTitle(t),
      canCreateChildDoc ? createChildDoc : undefined,
    );
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
