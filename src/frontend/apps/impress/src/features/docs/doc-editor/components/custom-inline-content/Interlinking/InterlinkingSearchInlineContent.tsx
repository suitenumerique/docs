/* eslint-disable react-hooks/rules-of-hooks */
import { createReactInlineContentSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

import { DocsBlockNoteEditor } from '@/docs/doc-editor';
import LinkPageIcon from '@/docs/doc-editor/assets/doc-link.svg';
import AddPageIcon from '@/docs/doc-editor/assets/doc-plus.svg';
import { useCreateChildDocTree, useDocStore } from '@/docs/doc-management';

import { SearchPage } from './SearchPage';

export const InterlinkingSearchInlineContent = createReactInlineContentSpec(
  {
    type: 'interlinkingSearchInline',
    propSchema: {
      trigger: {
        default: '/',
        values: ['/', '@'],
      },
      disabled: {
        default: false,
        values: [true, false],
      },
    },
    content: 'styled',
  },
  {
    render: (props) => {
      if (props.inlineContent.props.disabled) {
        return null;
      }

      return (
        <SearchPage
          {...props}
          trigger={props.inlineContent.props.trigger}
          contentRef={props.contentRef}
        />
      );
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
    title: t('Link a doc'),
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: 'interlinkingSearchInline',
          props: {
            disabled: false,
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
