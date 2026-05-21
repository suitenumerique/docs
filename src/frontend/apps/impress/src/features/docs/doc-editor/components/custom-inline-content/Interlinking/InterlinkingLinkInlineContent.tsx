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
import { SearchPage } from './SearchPage';

export type InterlinkingLinkInlineContentType = {
  type: 'interlinkingLinkInline';
  propSchema: {
    disabled?: {
      default: false;
      values: [true, false];
    };
    docId?: {
      default: '';
    };
    trigger?: {
      default: '/';
      values: readonly ['/', '@'];
    };
    title?: {
      default: '';
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
      disabled: {
        default: false,
        values: [true, false],
      },
      trigger: {
        default: '/',
        values: ['/', '@'],
      },
      title: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    /**
     * Can have 3 render states:
     * 1. Disabled state: when the inline content is disabled, it renders nothing
     * 2. Search state: when the inline content has no docId, it renders the search page
     * 3. Linked state: when the inline content has a docId and title, it renders the linked doc
     *
     * Info: We keep everything in the same inline content to easily preserve
     * the element position when switching between states
     */
    render: (props) => {
      const { disabled, docId, title } = props.inlineContent.props;

      if (disabled) {
        return null;
      }

      if (docId && title) {
        /**
         * Should not happen
         */
        if (!uuidValidate(docId)) {
          return (
            <DisableInvalidInterlink
              docId={docId}
              onUpdateInlineContent={() => {
                props.updateInlineContent({
                  type: 'interlinkingLinkInline',
                  props: {
                    disabled: true,
                  },
                });
              }}
            />
          );
        }

        return (
          <LinkSelected
            docId={docId}
            title={title}
            isEditable={props.editor.isEditable}
            onUpdateTitle={(newTitle) =>
              props.updateInlineContent({
                type: 'interlinkingLinkInline',
                props: {
                  docId: docId,
                  title: newTitle,
                  trigger: props.inlineContent.props.trigger,
                  disabled: false,
                },
              })
            }
          />
        );
      }

      return <SearchPage {...props} />;
    },
  },
);

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
          type: 'interlinkingLinkInline',
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
  onUpdateInlineContent,
}: {
  docId: string;
  onUpdateInlineContent: () => void;
}) => {
  useEffect(() => {
    Sentry.captureException(new Error(`Invalid docId: ${docId}`), {
      extra: { info: 'InterlinkingInlineContent' },
    });

    onUpdateInlineContent();
  }, [docId, onUpdateInlineContent]);

  return null;
};
