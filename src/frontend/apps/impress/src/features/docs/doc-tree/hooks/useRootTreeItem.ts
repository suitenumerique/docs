// useRootTreeItem.ts
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { RefObject, useCallback, useState } from 'react';

import type { Doc } from '@/docs/doc-management';

import { useActionableMode } from '../hooks/useActionableMode';
import type { ActionableNodeLike } from '../hooks/useActionableMode';

export function useRootTreeItem() {
  const treeContext = useTreeContext<Doc | null>();
  const router = useRouter();
  const [rootActionsOpen, setRootActionsOpen] = useState(false);

  const rootIsSelected =
    !!treeContext?.root?.id &&
    treeContext?.treeData.selectedNode?.id === treeContext.root.id;

  /**
   * This is a fake node used to reuse the useActionableMode hook on the root.
   */
  const fakeRootNode: ActionableNodeLike = {
    isFocused: rootIsSelected,
    focus: () => {
      const root = treeContext?.root;
      if (root) {
        treeContext?.treeData.setSelectedNode(root);
      }
    },
  };

  const { actionsRef: rootActionsRef, onKeyDownCapture: onRootToolbarKeys } =
    useActionableMode(fakeRootNode, rootActionsOpen);

  const selectRoot = useCallback(() => {
    if (treeContext?.root) {
      treeContext.treeData.setSelectedNode(treeContext.root);
    }
  }, [treeContext]);

  const navigateToRoot = useCallback(() => {
    const id = treeContext?.root?.id;
    if (id) {
      router.push(`/docs/${id}`);
    }
  }, [router, treeContext?.root?.id]);

  const handleRootFocus = useCallback(() => {
    selectRoot();
  }, [selectRoot]);

  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRoot();
        navigateToRoot();
      }
    },
    [selectRoot, navigateToRoot],
  );

  const handleRootClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      selectRoot();
      navigateToRoot();
    },
    [selectRoot, navigateToRoot],
  );

  const handleRootActivate = useCallback(() => {
    selectRoot();
    navigateToRoot();
  }, [selectRoot, navigateToRoot]);

  const handleCreateSuccess = useCallback(
    (createdDoc: Doc) => {
      const newDoc = {
        ...createdDoc,
        children: [],
        childrenCount: 0,
        parentId: treeContext?.root?.id ?? undefined,
      };
      treeContext?.treeData.addChild(null, newDoc);
    },
    [treeContext],
  );

  return {
    rootIsSelected,
    rootActionsOpen,
    setRootActionsOpen,
    rootActionsRef: rootActionsRef as RefObject<HTMLDivElement>,
    onRootToolbarKeys,

    handleRootFocus,
    handleRootKeyDown,
    handleRootClick,
    handleRootActivate,
    handleCreateSuccess,
  };
}
