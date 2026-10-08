import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { createReactBlockSpec } from '@blocknote/react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useDocStore } from '@/docs/doc-management';
import {
  KEY_LIST_DOC_CHILDREN,
  getAllDocChildren,
} from '@/docs/doc-tree/api/useDocChildren';
import { isDocNode, useTreeContextOrNull } from '@/docs/doc-tree/utils';

import type { DocsBlockNoteEditor } from '../../types';
import { LinkSelected } from '../custom-inline-content/Interlinking/LinkSelected';

const DocChildrenList = ({ isEditable }: { isEditable: boolean }) => {
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const docId = currentDoc?.id;
  const treeContext = useTreeContextOrNull();

  const { data: children, refetch } = useQuery({
    queryKey: [KEY_LIST_DOC_CHILDREN, { docId, all: true }],
    queryFn: () => getAllDocChildren(docId as string),
    enabled: !!docId,
    // Sub-docs change from other pages and other users, refetch on every mount
    staleTime: 0,
  });

  // Refetch when the sidebar tree changes the sub-docs of this doc (created,
  // renamed, moved or deleted), so the list follows the tree.
  // The tree root is not a node: its children are the top-level nodes.
  const treeChildren =
    docId && treeContext?.root?.id === docId
      ? treeContext.treeData.nodes.map((node) => node.value)
      : docId
        ? treeContext?.treeData.getNode(docId)?.children
        : undefined;
  const treeSignature = treeChildren
    ?.filter(isDocNode)
    .map((child) => `${child.id}:${child.title}`)
    .join('|');
  const previousTreeSignature = useRef(treeSignature);

  useEffect(() => {
    if (previousTreeSignature.current === treeSignature) {
      return;
    }
    previousTreeSignature.current = treeSignature;
    void refetch();
  }, [treeSignature, refetch]);

  if (!children) {
    return null;
  }

  if (children.length === 0) {
    return (
      <Text $variation="secondary" $size="sm" contentEditable={false}>
        {t('No sub-docs yet')}
      </Text>
    );
  }

  return (
    <Box
      as="ul"
      className="--docs--doc-children"
      contentEditable={false}
      $gap="2px"
      $css={css`
        list-style: none;
        padding: 0;
        margin: 0;
      `}
    >
      {children.map((child) => (
        <li key={child.id}>
          <LinkSelected docId={child.id} doc={child} isEditable={isEditable} />
        </li>
      ))}
    </Box>
  );
};

export const DocChildrenBlock = createReactBlockSpec(
  {
    type: 'docChildren',
    propSchema: {},
    content: 'none',
  },
  {
    render: ({ editor }) => <DocChildrenList isEditable={editor.isEditable} />,
  },
);

export const getDocChildrenReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    key: 'doc-children',
    title: t('Sub-docs'),
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: 'docChildren',
      });
    },
    aliases: ['children', 'sub-docs', 'subdocs', 'sub-pages', 'subpages'],
    group,
    icon: <Icon iconName="account_tree" $size="18px" />,
    subtext: t('List the sub-docs of this doc'),
  },
];
