import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { TFunction } from 'i18next';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { Box, Icon } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, useCreateChildDoc, useDocStore } from '@/docs/doc-management';

import AddPageIcon from '../../assets/doc-plus.svg';
import { DocsBlockNoteEditor } from '../../types';

export const InterlinkingBlock = createReactBlockSpec(
  {
    type: 'interlinking',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
    },
    content: 'inline',
  },
  {
    render: (props) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { colorsTokens } = useCunninghamTheme();

      return (
        <Box
          as="blockquote"
          className="inline-content"
          $margin="0 0 1rem 0"
          $padding="0.5rem 1rem"
          style={{
            borderLeft: `4px solid ${colorsTokens['greyscale-300']}`,
            fontStyle: 'italic',
            flexGrow: 1,
          }}
          $color="var(--c--theme--colors--greyscale-500)"
          ref={props.contentRef}
        />
      );
    },
  },
);

export const getInterlinkingBlockSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
  createPage: () => void,
) => [
  {
    title: t('Link to a page'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'interlinking',
      });
    },
    aliases: ['interlinking', 'link', 'anchor', 'a'],
    group,
    icon: <Icon iconName="format_quote" $size="18px" />,
    subtext: t('Link to a page'),
  },
  {
    title: t('New page'),
    onItemClick: createPage,
    aliases: ['new page'],
    group,
    icon: <AddPageIcon />,
    subtext: t('Add a new page'),
  },
];

export const getInterlinkingBlockFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Link to a page 44'),
  type: 'interlinking',
  icon: () => <Icon iconName="format_quote" $size="16px" />,
  isSelected: (block) => block.type === 'interlinking',
});

export const useGetInterlinkingBlockSlashMenuItems = () => {
  const treeContext = useTreeContext<Doc>();
  const router = useRouter();
  const { currentDoc } = useDocStore();

  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: (createdDoc) => {
      const newDoc = {
        ...createdDoc,
        children: [],
        childrenCount: 0,
        parentId: currentDoc?.id ?? undefined,
      };
      treeContext?.treeData.addChild(currentDoc?.id || null, newDoc);

      router.push(`/docs/${newDoc.id}`);
      treeContext?.treeData.setSelectedNode(createdDoc);
    },
  });

  return useCallback(
    (editor: DocsBlockNoteEditor, t: TFunction<'translation', undefined>) =>
      getInterlinkingBlockSlashMenuItems(
        editor,
        t,
        t('Links'),
        () =>
          currentDoc?.id &&
          createChildDoc({
            parentId: currentDoc.id,
          }),
      ),
    [createChildDoc, currentDoc?.id],
  );
};
