/* eslint-disable jsx-a11y/no-static-element-interactions */
import { clsx } from 'clsx';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  CursorProps,
  MoveHandler,
  NodeApi,
  NodeRendererProps,
  Tree,
} from 'react-arborist';
import { OpenMap } from 'react-arborist/dist/module/state/open-slice';

import {
  BaseType,
  TreeViewDataType,
  TreeViewMoveModeEnum,
  TreeViewMoveResult,
} from '@/features/docs/doc-tree/types/tree';

import { Box } from '../../Box';
import { Icon } from '../../Icon';
import { Loader } from '../loader/Loader';

import styles from './treeview.module.scss';

export type TreeViewProps<T> = {
  treeData: TreeViewDataType<T>[];
  width?: number | string;
  selectedNodeId?: string;
  rootNodeId: string;
  initialOpenState?: OpenMap;
  renderNode: (
    props: NodeRendererProps<TreeViewDataType<T>>,
  ) => React.ReactNode;
  afterMove?: (
    result: TreeViewMoveResult,
    newTreeData: TreeViewDataType<T>[],
  ) => void;
};

export const TreeView = <T,>({
  treeData,
  width,
  rootNodeId,
  renderNode,
  afterMove,
  selectedNodeId,
  initialOpenState,
}: TreeViewProps<T>) => {
  const onMove3 = (args: {
    dragIds: string[];
    dragNodes: NodeApi<BaseType<T>>[];
    parentId: string | null;
    parentNode: NodeApi<BaseType<T>> | null;
    index: number;
  }): TreeViewMoveResult | null => {
    const newData = JSON.parse(
      JSON.stringify(treeData),
    ) as TreeViewDataType<T>[];

    const sourceNodeId = args.dragNodes[0].data.id;
    const sourceNode = args.dragNodes[0].data;
    const oldParentId = sourceNode.parentId ?? rootNodeId;
    const newIndex = args.index;
    const targetNodeId = args.parentId ?? rootNodeId;

    const children = args.parentId
      ? (args.parentNode?.children ?? [])
      : newData;

    let result: TreeViewMoveResult | null = null;

    if (newIndex === 0) {
      result = {
        targetNodeId: targetNodeId ?? rootNodeId,
        mode: TreeViewMoveModeEnum.FIRST_CHILD,
        sourceNodeId,
        oldParentId,
      };
    }
    if (newIndex === children.length) {
      result = {
        targetNodeId: targetNodeId ?? rootNodeId,
        mode: TreeViewMoveModeEnum.LAST_CHILD,
        sourceNodeId,
        oldParentId,
      };
    }

    const siblingIndex = newIndex - 1;
    const sibling = children[siblingIndex];

    if (sibling) {
      result = {
        targetNodeId: sibling.id,
        mode: TreeViewMoveModeEnum.RIGHT,
        sourceNodeId,
        oldParentId,
      };
    }

    const nextSiblingIndex = newIndex + 1;
    const nextSibling = children[nextSiblingIndex];
    if (nextSibling) {
      result = {
        targetNodeId: nextSibling.id,
        mode: TreeViewMoveModeEnum.LEFT,
        sourceNodeId,
        oldParentId,
      };
    }

    return result;
  };

  const onMove = (args: {
    dragIds: string[];
    dragNodes: NodeApi<BaseType<T>>[];
    parentId: string | null;
    parentNode: NodeApi<BaseType<T>> | null;
    index: number;
  }) => {
    // Création d'une copie profonde pour éviter les mutations directes
    const newData = JSON.parse(
      JSON.stringify(treeData),
    ) as TreeViewDataType<T>[];
    const draggedId = args.dragIds[0];

    // Fonction helper pour trouver et supprimer un nœud dans l'arbre
    const findAndRemoveNode = (
      items: TreeViewDataType<T>[],
      parentId?: string,
    ): {
      currentIndex: number;
      newIndex: number;
      parentId?: string;
      draggedNode: TreeViewDataType<T>;
    } | null => {
      items.forEach((item, index) => {
        if (item.id === draggedId) {
          return {
            currentIndex: index,
          };
        }
      });

      for (let i = 0; i < items.length; i++) {
        if (items[i].id === draggedId) {
          const currentIndex = i;
          let newIndex = args.index;
          if (currentIndex < newIndex) {
            newIndex -= 1;
          }
          return {
            currentIndex: i,
            parentId,
            newIndex,
            draggedNode: items.splice(i, 1)[0],
          };
        }
        if (items[i].children?.length) {
          const found = findAndRemoveNode(
            items[i]?.children ?? [],
            items[i].id,
          );
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    // Trouver et supprimer le nœud déplacé
    const r = findAndRemoveNode(newData);
    const draggedNode = r?.draggedNode;
    const currentIndex = r?.currentIndex ?? -1;
    const newIndex = r?.newIndex ?? -1;
    if (!draggedNode || currentIndex < 0 || newIndex < 0) {
      return;
    }

    // Cas 1: Déplacement à la racine
    if (!args.parentNode) {
      draggedNode.parentId = rootNodeId;
      newData.splice(newIndex, 0, draggedNode);
    }
    // Cas 2: Déplacement dans un dossier
    else {
      const targetParent = args.parentNode.data;
      draggedNode.parentId = targetParent.id;
      const findParentAndInsert = (items: TreeViewDataType<T>[]) => {
        for (const item of items) {
          if (item.id === targetParent.id) {
            item.children = item.children || [];
            item.children.splice(
              r.parentId === targetParent.id ? r.newIndex : args.index,
              0,
              draggedNode,
            );

            return true;
          }
          if (item.children?.length) {
            if (findParentAndInsert(item.children)) {
              return true;
            }
          }
        }
        return false;
      };

      findParentAndInsert(newData);
    }

    const moveResult = onMove3(args);
    if (moveResult) {
      afterMove?.(moveResult, newData);
    }
  };

  return (
    <Tree
      data={treeData}
      openByDefault={false}
      height={1000}
      indent={20}
      width={width}
      initialOpenState={initialOpenState}
      selection={selectedNodeId}
      disableEdit={true}
      rowHeight={32}
      overscanCount={20}
      padding={25}
      renderCursor={Cursor}
      onMove={onMove as MoveHandler<TreeViewDataType<T>>}
    >
      {(props) => renderNode(props)}
    </Tree>
  );
};

function Cursor({ top, left }: CursorProps) {
  return (
    <div
      className={styles.cursor}
      style={{
        top,
        left: left + 10,
      }}
    ></div>
  );
}

export type TreeViewNodeProps<T> = NodeRendererProps<TreeViewDataType<T>> & {
  children: ReactNode;
  onClick?: () => void;
  loadChildren?: (node?: TreeViewDataType<T>) => Promise<TreeViewDataType<T>[]>;
};

export const TreeViewNode = <T,>({
  children,
  onClick,
  node,
  dragHandle,
  style,
  loadChildren,
}: TreeViewNodeProps<T>) => {
  /* This node instance can do many things. See the API reference. */
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasChildren =
    (node.data.childrenCount !== undefined && node.data.childrenCount > 0) ||
    (node.data.children?.length ?? 0) > 0;

  const isLeaf = node.isLeaf || !hasChildren;

  const hasLoadedChildren = node.children?.length ?? 0 > 0;

  const handleClick = useCallback(async () => {
    if (isLeaf) {
      return;
    }

    if (hasLoadedChildren) {
      node.toggle();
      return;
    }

    setIsLoading(true);
    await loadChildren?.(node.data);
    setIsLoading(false);
    node.open();
  }, [hasLoadedChildren, loadChildren, node, isLeaf]);

  useEffect(() => {
    if (node.willReceiveDrop && !node.isOpen) {
      timeoutRef.current = setTimeout(() => {
        void handleClick();
      }, 200);
    }

    if (timeoutRef.current && !node.willReceiveDrop) {
      clearTimeout(timeoutRef.current);
    }
  }, [node, handleClick]);
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick}
      role="button"
      tabIndex={0}
      className={clsx(styles.node, {
        [styles.willReceiveDrop]: node.willReceiveDrop,
        [styles.selected]: node.isSelected,
        toto: true,
      })}
      style={{
        ...style,
      }}
      ref={dragHandle}
    >
      {isLeaf ? (
        <Box $padding={{ left: '16px' }} />
      ) : (
        <>
          {isLoading ? (
            <Box $padding={{ horizontal: '4px' }}>
              <Loader />
            </Box>
          ) : (
            <Icon
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void handleClick();
              }}
              $variation="500"
              $size="16px"
              iconName={
                node.isOpen ? 'keyboard_arrow_down' : 'keyboard_arrow_right'
              }
            />
          )}
        </>
      )}
      {children}
    </div>
  );
};
