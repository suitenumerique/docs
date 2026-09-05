import {
  OpenMap,
  TreeDataItem,
  TreeView,
  TreeViewMoveResult,
  useResponsive,
  useTreeContext,
} from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { RefObject, memo, useCallback, useEffect } from 'react';
import { NodeApi } from 'react-arborist';

import { Overlayer } from '@/components';
import { CLASS_DOC_TITLE } from '@/docs/doc-header';
import { Doc, useMoveDoc } from '@/docs/doc-management';

import { isDocNode, isWithinTreeItemActions } from '../utils';

import { DocSubPageItem } from './DocSubPageItem';

interface DocTreeSubPagesProps {
  doc: Doc;
  treeRoot: HTMLElement;
  initialOpenState: OpenMap;
  rootNodeId: string;
  rootItemRef: RefObject<HTMLDivElement | null>;
}

export const DocTreeSubpages = memo(function DocTreeSubpages({
  doc,
  treeRoot,
  initialOpenState,
  rootNodeId,
  rootItemRef,
}: DocTreeSubPagesProps) {
  const { isDesktop } = useResponsive();
  const treeContext = useTreeContext<Doc | null>();
  const { mutateAsync: moveDoc } = useMoveDoc();
  const { query } = useRouter();

  /**
   * The root item is the tree's only Tab stop; the sub pages are reached from
   * it with the arrow keys. react-arborist hardcodes `tabIndex=0` on its
   * container and `ui-components` does not forward `renderContainer`, so the
   * attribute is corrected here. React leaves it alone afterwards: it only
   * writes an attribute when the rendered prop value changes, and this one
   * stays `0` for the lifetime of the container.
   */
  useEffect(() => {
    treeRoot
      .querySelector<HTMLElement>('.c__tree-view--container [role="tree"]')
      ?.setAttribute('tabindex', '-1');
  }, [treeRoot]);

  const handleMove = useCallback(
    async (result: TreeViewMoveResult) => {
      await moveDoc({
        sourceDocumentId: result.sourceId,
        targetDocumentId: result.targetModeId,
        position: result.mode,
      });

      treeContext?.treeData.handleMove(result);
    },
    [moveDoc, treeContext?.treeData],
  );

  const canDrop = useCallback(
    ({ parentNode }: { parentNode: NodeApi<TreeDataItem<Doc>> | null }) => {
      const parentValue = parentNode?.data.value;
      if (!parentValue || !isDocNode(parentValue)) {
        return doc.abilities.move && isDesktop;
      }
      return parentValue.abilities.move && isDesktop;
    },
    [doc.abilities.move, isDesktop],
  );

  const canDrag = useCallback(
    (node: TreeDataItem<Doc>) => {
      if (!isDocNode(node.value)) {
        return false;
      }
      return node.value.abilities.move && isDesktop;
    },
    [isDesktop],
  );

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.stopPropagation();
        if (e.shiftKey) {
          e.preventDefault();
          rootItemRef.current?.focus();
        }
        return;
      }

      // ArrowUp on the first row leaves the sub pages for the root item;
      // deeper rows fall through to the tree's own row-to-row navigation.
      if (e.key === 'ArrowUp' && !isWithinTreeItemActions(e)) {
        const api = treeContext?.treeApiRef.current;
        if (api && !api.prevNode) {
          e.preventDefault();
          e.stopPropagation();
          rootItemRef.current?.focus();
        }
        return;
      }

      if (e.key !== 'Enter') {
        return;
      }

      // Classes rendered by the `ui-components` TreeView / TreeViewItem.
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        !(
          target.classList.contains('c__tree-view--row') ||
          target.classList.contains('c__tree-view--node')
        )
      ) {
        return;
      }

      // Already on this document: move on to its title rather than reloading.
      const treeItem = e.currentTarget.querySelector('[role="treeitem"]');
      if (treeItem?.getAttribute('aria-selected') === 'true') {
        e.preventDefault();
        document.querySelector<HTMLElement>(`.${CLASS_DOC_TITLE}`)?.focus();
        return;
      }

      e.currentTarget
        .querySelector<HTMLDivElement>('.c__tree-view--node')
        ?.click();
    },
    [rootItemRef, treeContext],
  );

  return (
    <Overlayer isOverlay={doc.deleted_at != null} inert>
      <TreeView
        dndRootElement={treeRoot}
        initialOpenState={initialOpenState}
        afterMove={handleMove}
        selectedNodeId={
          (query.id as string | undefined) ??
          treeContext?.initialTargetId ??
          undefined
        }
        canDrop={canDrop}
        canDrag={canDrag}
        rootNodeId={rootNodeId}
        renderNode={DocSubPageItem}
        rowProps={{
          onKeyDown: handleRowKeyDown,
        }}
      />
    </Overlayer>
  );
});
