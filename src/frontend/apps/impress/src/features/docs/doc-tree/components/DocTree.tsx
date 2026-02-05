import {
  OpenMap,
  TreeView,
  TreeViewMoveResult,
  useResponsive,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Overlayer, StyledLink } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, SimpleDocItem } from '@/docs/doc-management';

import { KEY_DOC_TREE, useDocTree } from '../api/useDocTree';
import { useMoveDoc } from '../api/useMove';
import { findIndexInTree } from '../utils';

import { DocSubPageItem } from './DocSubPageItem';
import { DocTreeItemActions } from './DocTreeItemActions';

type DocTreeProps = {
  currentDoc: Doc;
};

export const DocTree = ({ currentDoc }: DocTreeProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsive();
  const [treeRoot, setTreeRoot] = useState<HTMLElement | null>(null);
  const treeContext = useTreeContext<Doc | null>();
  const router = useRouter();
  const [rootActionsOpen, setRootActionsOpen] = useState(false);
  const rootIsSelected =
    !!treeContext?.root?.id &&
    treeContext?.treeData.selectedNode?.id === treeContext.root.id;
  const rootItemRef = useRef<HTMLDivElement>(null);
  const rootActionsRef = useRef<HTMLDivElement>(null);
  const rootButtonOptionRef = useRef<HTMLDivElement | null>(null);

  const { t } = useTranslation();

  const [initialOpenState, setInitialOpenState] = useState<OpenMap | undefined>(
    undefined,
  );

  const { mutate: moveDoc } = useMoveDoc();

  const { data: tree, isFetching } = useDocTree(
    { docId: currentDoc.id },
    {
      enabled: !treeContext?.root?.id,
      queryKey: [KEY_DOC_TREE, { id: currentDoc.id }],
    },
  );

  const handleMove = (result: TreeViewMoveResult) => {
    moveDoc({
      sourceDocumentId: result.sourceId,
      targetDocumentId: result.targetModeId,
      position: result.mode,
    });
    treeContext?.treeData.handleMove(result);
  };

  /**
   * This function resets the tree states.
   */
  const resetStateTree = useCallback(() => {
    treeContext?.setRoot(null);
    setInitialOpenState(undefined);
  }, [treeContext]);

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

  // Handle keyboard navigation for root item
  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInActions = !!target?.closest('.doc-tree-root-item-actions');
      const isOnEmojiButton = !!target?.closest('.--docs--doc-icon');
      const isOnRootItem = target === e.currentTarget;

      // F2: focus first action button
      if (e.key === 'F2' && !rootActionsOpen && !isInActions) {
        if (
          isOnEmojiButton ||
          isOnRootItem ||
          target?.classList.contains('c__tree-view--node')
        ) {
          e.preventDefault();
          rootButtonOptionRef.current?.focus();
        }
        return;
      }

      // Ignore if focus is in actions
      if (isInActions) {
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRoot();
        navigateToRoot();
      }
    },
    [selectRoot, navigateToRoot, rootActionsOpen],
  );

  // Handle menu open/close for root item - mirrors DocSubPageItem behavior
  const handleRootActionsOpenChange = useCallback((isOpen: boolean) => {
    setRootActionsOpen(isOpen);

    // When the menu closes, return focus to the root tree item
    // (same behavior as DocSubPageItem for consistency)
    // Use requestAnimationFrame for smoother focus transition without flickering
    if (!isOpen) {
      requestAnimationFrame(() => {
        rootItemRef.current?.focus();
      });
    }
  }, []);

  const handleRowKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') {
      return;
    }

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

    e.currentTarget
      .querySelector<HTMLDivElement>('.c__tree-view--node')
      ?.click();
  }, []);

  /**
   * This effect is used to reset the tree when a new document
   * that is not part of the current tree is loaded.
   */
  useEffect(() => {
    if (!treeContext?.root?.id) {
      return;
    }
    const index = findIndexInTree(treeContext.treeData.nodes, currentDoc.id);
    if (index === -1 && currentDoc.id !== treeContext.root?.id) {
      resetStateTree();
      return;
    }
  }, [currentDoc, resetStateTree, treeContext]);

  /**
   * This effect is used to reset the tree when the component is unmounted.
   */
  useEffect(() => {
    return () => {
      resetStateTree();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * This effect is used to set the initial open state of the tree when the tree is loaded.
   * If the treeContext is already set, we do not need to set it again.
   */
  useEffect(() => {
    if (!tree || treeContext?.root?.id || isFetching) {
      return;
    }

    const { children: rootChildren, ...root } = tree;
    const children = rootChildren ?? [];
    treeContext?.setRoot(root);
    const initialOpenState: OpenMap = {};
    initialOpenState[root.id] = true;
    const serialize = (children: Doc[]) => {
      children.forEach((child) => {
        child.childrenCount = child.numchild ?? 0;
        if (child?.children?.length && child?.children?.length > 0) {
          initialOpenState[child.id] = true;
        }
        serialize(child.children ?? []);
      });
    };
    serialize(children);

    treeContext?.treeData.resetTree(children);
    setInitialOpenState(initialOpenState);
  }, [tree, treeContext, isFetching]);

  /**
   * This effect is used to select the current document in the tree
   */
  useEffect(() => {
    if (!treeContext || !treeContext.root?.id) {
      return;
    }

    if (currentDoc.id === treeContext?.root?.id) {
      treeContext?.treeData.setSelectedNode(treeContext?.root);
    } else {
      treeContext?.treeData.selectNodeById(currentDoc.id);
    }
  }, [currentDoc, treeContext]);

  if (!treeContext || !treeContext.root) {
    return null;
  }

  return (
    <Box
      ref={setTreeRoot}
      data-testid="doc-tree"
      $height="100%"
      role="tree"
      aria-label={t('Document tree')}
      aria-describedby="doc-tree-keyboard-instructions"
      $css={css`
        /* Remove outline from TreeViewItem wrapper elements */
        .c__tree-view--row {
          outline: none !important;
          &:focus-visible {
            outline: none !important;
          }
        }

        .c__tree-view--container {
          z-index: 1;
          margin-top: -10px;

          .c__tree-view {
            overflow: hidden !important;
          }
        }
      `}
    >
      {/* Keyboard instructions for screen readers */}
      <Box id="doc-tree-keyboard-instructions" className="sr-only">
        {t(
          'Use arrow keys to navigate between documents. Press Enter to open a document. Press F2 to focus the emoji button when available, then press F2 again to access document actions.',
        )}
      </Box>
      <Box
        $padding={{ horizontal: 'sm', top: 'sm', bottom: '4px' }}
        $css={css`
          z-index: 2;
        `}
      >
        <Box
          ref={rootItemRef}
          data-testid="doc-tree-root-item"
          role="treeitem"
          aria-label={`${t('Root document {{title}}', { title: treeContext.root?.title || t('Untitled document') })}`}
          aria-selected={rootIsSelected}
          tabIndex={0}
          onFocus={handleRootFocus}
          onKeyDown={handleRootKeyDown}
          $css={css`
            padding: ${spacingsTokens['2xs']};
            border-radius: var(--c--globals--spacings--st);
            width: 100%;
            background-color: ${rootIsSelected || rootActionsOpen
              ? 'var(--c--contextuals--background--semantic--contextual--primary)'
              : 'transparent'};

            &:hover {
              background-color: var(
                --c--contextuals--background--semantic--contextual--primary
              );
            }

            &:focus-visible {
              outline: none !important;
              box-shadow: 0 0 0 2px var(--c--globals--colors--brand-500) !important;
              border-radius: var(--c--globals--spacings--st);
            }

            .doc-tree-root-item-actions {
              display: flex;
              opacity: ${rootActionsOpen ? '1' : '0'};

              &:has(.isOpen) {
                opacity: 1;
              }
            }
            &:hover,
            &:focus-visible,
            &:focus-within {
              .doc-tree-root-item-actions {
                display: flex;
                opacity: 1;
              }
            }
            /* Remove visual focus from the root item when focus is on the actions */
            &:has(.doc-tree-root-item-actions *:focus) {
              box-shadow: none !important;
            }
          `}
        >
          <StyledLink
            $css={css`
              width: 100%;
            `}
            href={`/docs/${treeContext.root.id}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              treeContext.treeData.setSelectedNode(
                treeContext.root ?? undefined,
              );
              router.push(`/docs/${treeContext?.root?.id}`);
            }}
            aria-label={`${t('Open root document')}: ${treeContext.root?.title || t('Untitled document')}`}
            tabIndex={-1} // avoid double tabstop
          >
            <Box $direction="row" $align="center" $width="100%">
              <SimpleDocItem doc={treeContext.root} showAccesses={true} />
              <DocTreeItemActions
                doc={treeContext.root}
                onCreateSuccess={(createdDoc) => {
                  const newDoc = {
                    ...createdDoc,
                    children: [],
                    childrenCount: 0,
                    parentId: treeContext.root?.id ?? undefined,
                  };
                  treeContext?.treeData.addChild(null, newDoc);
                }}
                isOpen={rootActionsOpen}
                isRoot={true}
                onOpenChange={handleRootActionsOpenChange}
                actionsRef={rootActionsRef}
                buttonOptionRef={rootButtonOptionRef}
              />
            </Box>
          </StyledLink>
        </Box>
      </Box>

      {initialOpenState &&
        treeContext.treeData.nodes.length > 0 &&
        treeRoot && (
          <Overlayer isOverlay={currentDoc.deleted_at != null} inert>
            <TreeView
              dndRootElement={treeRoot}
              initialOpenState={initialOpenState}
              afterMove={handleMove}
              selectedNodeId={
                treeContext.treeData.selectedNode?.id ??
                treeContext.initialTargetId ??
                undefined
              }
              canDrop={({ parentNode }) => {
                const parentDoc = parentNode?.data.value as Doc;
                if (!parentDoc) {
                  return currentDoc.abilities.move && isDesktop;
                }
                return parentDoc.abilities.move && isDesktop;
              }}
              canDrag={(node) => {
                const doc = node.value as Doc;
                return doc.abilities.move && isDesktop;
              }}
              rootNodeId={treeContext.root.id}
              renderNode={DocSubPageItem}
              rowProps={{
                onKeyDown: handleRowKeyDown,
              }}
            />
          </Overlayer>
        )}
    </Box>
  );
};
