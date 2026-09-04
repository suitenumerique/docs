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
import { Doc, useMoveDoc } from '@/docs/doc-management';
import { focusMainContentStart } from '@/layouts/utils';

import { isDocNode, isWithinTreeItemActions } from '../utils';

import { DocSubPageItem } from './DocSubPageItem';

/**
 * Scalars rather than the current `Doc`: refetching it yields an equal but new
 * object, which would break the memo and re-render the tree. That re-inserts
 * the rows' DOM nodes and drops the focus held inside them.
 */
interface DocTreeSubPagesProps {
  canMoveInto: boolean;
  isDeleted: boolean;
  treeRoot: HTMLElement;
  initialOpenState: OpenMap;
  rootNodeId: string;
  rootItemRef: RefObject<HTMLDivElement | null>;
}

export const DocTreeSubpages = memo(function DocTreeSubpages({
  canMoveInto,
  isDeleted,
  treeRoot,
  initialOpenState,
  rootNodeId,
  rootItemRef,
}: DocTreeSubPagesProps) {
  const { isDesktop } = useResponsive();
  const treeContext = useTreeContext<Doc | null>();
  const treeApiRef = treeContext?.treeApiRef;
  const { mutateAsync: moveDoc } = useMoveDoc();
  const { query } = useRouter();

  /**
   * react-arborist hardcodes `tabIndex=0` and `role="tree"` on its container,
   * and `ui-components` does not forward `renderContainer`. The root item is
   * the tree's only Tab stop, and `DocTree` already owns the `tree` role, so
   * this container is only the root item's `group`.
   */
  useEffect(() => {
    const container = treeRoot.querySelector<HTMLElement>(
      '.c__tree-view--container [role="tree"], .c__tree-view--container [role="group"]',
    );

    if (!container) {
      return;
    }

    container.setAttribute('tabindex', '-1');
    container.setAttribute('role', 'group');
  }, [treeRoot]);

  /**
   * Tell react-arborist the focus left, so it stops considering its last row
   * focused. Opening a doc reloads the tree, and remounting a row it still
   * believes is focused makes it take the focus back from the doc content.
   *
   * Its own container does the same, but on a React `onBlur` that never fires
   * when the row is unmounted along with the tree.
   */
  useEffect(() => {
    const handleFocusOut = (event: FocusEvent) => {
      if (!treeRoot.contains(event.relatedTarget as Node | null)) {
        treeApiRef?.current?.onBlur();
      }
    };

    treeRoot.addEventListener('focusout', handleFocusOut);
    return () => treeRoot.removeEventListener('focusout', handleFocusOut);
  }, [treeRoot, treeApiRef]);

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
        return canMoveInto && isDesktop;
      }
      return parentValue.abilities.move && isDesktop;
    },
    [canMoveInto, isDesktop],
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

      // Already on this document: move on to its content rather than reloading.
      // `role="treeitem"` sits on the row itself — react-arborist puts it there
      // through `rowClassName` — so this reads the row, not a descendant.
      if (e.currentTarget.getAttribute('aria-selected') === 'true') {
        e.preventDefault();
        focusMainContentStart();
        return;
      }

      e.currentTarget
        .querySelector<HTMLDivElement>('.c__tree-view--node')
        ?.click();
    },
    [rootItemRef, treeContext],
  );

  return (
    <Overlayer isOverlay={isDeleted} inert>
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
