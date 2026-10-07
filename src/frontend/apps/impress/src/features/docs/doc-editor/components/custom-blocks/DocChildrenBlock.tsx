import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { createReactBlockSpec } from '@blocknote/react';
import { Button } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { Doc, useDocStore } from '@/docs/doc-management';
import { useAllDocChildren } from '@/docs/doc-tree/api/useDocChildren';
import {
  findItemInTree,
  isDocNode,
  useTreeContextOrNull,
} from '@/docs/doc-tree/utils';

import type { DocsBlockNoteEditor } from '../../types';
import { LinkSelected } from '../custom-inline-content/Mention/Interlinking/LinkSelected';

/**
 * Refetches the list when the sidebar tree changes the sub-docs of the doc
 * (created, renamed, moved or deleted), so that the list follows the tree.
 * It is kept apart from the list so that the other changes of the tree, like
 * a selection, do not render the list again.
 */
const DocChildrenTreeSync = ({
  docId,
  onTreeChange,
}: {
  docId: string;
  onTreeChange: () => void;
}) => {
  const treeContext = useTreeContextOrNull();

  // The tree root is not a node: its children are the top-level nodes.
  // The children are read from the items of the tree, which follow its
  // updates, since the doc of a node keeps the children it was loaded with.
  const treeChildren = (
    treeContext?.root?.id === docId
      ? treeContext.treeData.nodes
      : findItemInTree(treeContext?.treeData.nodes ?? [], docId)?.children
  )?.map((item) => item.value);

  const treeSignature = treeChildren
    ?.filter(isDocNode)
    .map((child) => `${child.id}:${child.title}`)
    .join('|');
  const previousTreeSignature = useRef(treeSignature);

  useEffect(() => {
    const previous = previousTreeSignature.current;
    previousTreeSignature.current = treeSignature;

    // The tree loading the sub-docs is not a change of the sub-docs: the list
    // fetches them on its own.
    if (previous === undefined || previous === treeSignature) {
      return;
    }
    onTreeChange();
  }, [treeSignature, onTreeChange]);

  return null;
};

export const DocChildrenList = ({ isEditable }: { isEditable: boolean }) => {
  const { t } = useTranslation();
  const docId = useDocStore((state) => state.currentDoc?.id);
  const loadErrorText = t('The sub-docs could not be loaded.', {
    description:
      'Shown in the sub-docs block when the sub-docs could not be fetched',
  });

  const {
    data: children,
    isError,
    refetch,
  } = useAllDocChildren(docId, {
    // Sub-docs change from other pages and other users: the list is fetched on
    // every mount, and when the tab regains focus once it is 30 seconds old,
    // since it walks every page of the sub-docs
    staleTime: 30000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Every block of the doc follows the same tree: a refetch already in flight
  // is joined rather than replaced, so that one change makes one request.
  const followTree = useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]);

  // A retry starts the query over, which leaves it without error until it
  // fails again: the error stays displayed meanwhile, so that the Retry
  // button keeps the focus.
  const [isRetrying, setIsRetrying] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldFocusAfterRetry = useRef(false);

  const retry = async () => {
    if (isRetrying) {
      return;
    }
    setIsRetrying(true);
    const result = await refetch();
    setIsRetrying(false);

    if (result.isError) {
      announce(loadErrorText, 'polite');
    } else {
      shouldFocusAfterRetry.current = true;
    }
  };

  // The Retry button is gone once the sub-docs are loaded: the focus moves to
  // what replaced it rather than falling back to the page.
  useEffect(() => {
    if (!shouldFocusAfterRetry.current || !children) {
      return;
    }
    shouldFocusAfterRetry.current = false;
    contentRef.current
      ?.querySelector<HTMLElement>('[role="link"], [tabindex="-1"]')
      ?.focus();
  }, [children]);

  return (
    <>
      {docId && <DocChildrenTreeSync docId={docId} onTreeChange={followTree} />}
      <Box ref={contentRef}>
        <DocChildrenContent
          subDocs={children}
          // A failed background refetch keeps the list it already has
          showError={(isError || isRetrying) && !children}
          errorText={loadErrorText}
          isRetrying={isRetrying}
          onRetry={() => void retry()}
          isEditable={isEditable}
        />
      </Box>
    </>
  );
};

interface DocChildrenContentProps {
  subDocs?: Doc[];
  showError: boolean;
  errorText: string;
  isRetrying: boolean;
  onRetry: () => void;
  isEditable: boolean;
}

const DocChildrenContent = ({
  subDocs,
  showError,
  errorText,
  isRetrying,
  onRetry,
  isEditable,
}: DocChildrenContentProps) => {
  const { t } = useTranslation();

  if (showError) {
    return (
      <Box
        $direction="row"
        $align="center"
        $gap="0.5rem"
        contentEditable={false}
      >
        <Text $variation="secondary" $size="sm">
          {errorText}
        </Text>
        <Button
          size="small"
          variant="tertiary"
          aria-disabled={isRetrying || undefined}
          onClick={onRetry}
        >
          {t('Retry', {
            description: 'Button fetching the sub-docs again after a failure',
          })}
        </Button>
      </Box>
    );
  }

  if (!subDocs) {
    return null;
  }

  if (subDocs.length === 0) {
    return (
      <Text
        $variation="secondary"
        $size="sm"
        contentEditable={false}
        tabIndex={-1}
      >
        {t('No sub-docs yet', {
          description: 'Shown in the sub-docs block when the doc has none',
        })}
      </Text>
    );
  }

  return (
    <Box
      as="ul"
      // `list-style: none` removes the list semantics in Safari
      role="list"
      aria-label={t('Sub-docs', {
        description:
          'Name of the block listing the sub-docs of a doc, and of its list',
      })}
      className="--docs--doc-children"
      contentEditable={false}
      $gap="var(--c--globals--spacings--4xs)"
      $css={css`
        list-style: none;
        padding: 0;
        margin: 0;
      `}
    >
      {subDocs.map((subDoc) => (
        <li key={subDoc.id}>
          <LinkSelected
            docId={subDoc.id}
            doc={subDoc}
            isEditable={isEditable}
          />
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
    title: t('Sub-docs', {
      description:
        'Name of the block listing the sub-docs of a doc, and of its list',
    }),
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
        type: 'docChildren',
      });
    },
    aliases: ['children', 'sub-docs', 'subdocs', 'sub-pages', 'subpages'],
    group,
    icon: <Icon iconName="account_tree" $size="18px" />,
    subtext: t('List the sub-docs of this doc', {
      description: 'Description of the "Sub-docs" editor menu entry',
    }),
  },
];
