import { OpenMap, useTreeContext } from '@gouvfr-lasuite/ui-components';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Doc } from '@/docs/doc-management';
import { TreeSkeleton } from '@/features/skeletons/components/TreeSkeleton';

import { KEY_DOC_TREE, useDocTree } from '../api/useDocTree';
import { findIndexInTree } from '../utils';

import { DocTreeRoot } from './DocTreeRoot';
import { DocTreeSubpages } from './DocTreeSubpages';

type DocTreeProps = {
  currentDoc: Doc;
};

export const DocTree = ({ currentDoc }: DocTreeProps) => {
  const [treeRoot, setTreeRoot] = useState<HTMLElement | null>(null);
  const treeContext = useTreeContext<Doc | null>();
  const rootItemRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [initialOpenState, setInitialOpenState] = useState<OpenMap | undefined>(
    undefined,
  );

  const { data: tree, isFetching } = useDocTree(
    { docId: currentDoc.id },
    {
      enabled: !treeContext?.root?.id,
      queryKey: [KEY_DOC_TREE, { id: currentDoc.id }],
    },
  );

  /**
   * This function resets the tree states.
   */
  const resetStateTree = useCallback(() => {
    treeContext?.setRoot(null);
    setInitialOpenState(undefined);
  }, [treeContext]);

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

  /**
   * react-arborist's scrollTo calls react-window's scrollToItem, which mutates
   * the internal scrollOffset state. When navigating to a deep item in a large
   * tree, this causes all items above the target to be removed from the DOM
   * (virtualized away), making the tree appear empty above the selected node.
   * We no-op it to prevent that — the panel's own overflow-y handles scrolling.
   */
  const treeApiRef = treeContext?.treeApiRef;
  useLayoutEffect(() => {
    if (!treeRoot || !treeApiRef?.current) {
      return;
    }
    const api = treeApiRef.current as unknown as Record<string, unknown>;
    const origScrollTo = api['scrollTo'];
    if (typeof origScrollTo !== 'function') {
      return;
    }
    api['scrollTo'] = () => {};
    return () => {
      api['scrollTo'] = origScrollTo;
    };
  }, [treeRoot, treeApiRef]);

  /**
   * On initial tree load, scroll the panel to show the current document.
   * This fires once when initialOpenState is first set (tree data just loaded).
   * It does not re-fire on user navigation — clicked items are already in view.
   */
  useEffect(() => {
    if (!treeRoot || !initialOpenState) {
      return;
    }

    const timeoutId = setTimeout(() => {
      treeRoot
        .querySelector<HTMLElement>(
          `[data-testid="doc-sub-page-item-${currentDoc.id}"]`,
        )
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [treeRoot, initialOpenState, currentDoc.id]);

  if (!treeContext || !treeContext.root) {
    return <TreeSkeleton />;
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
        /**
        * TODO: When this pull request is merged (https://github.com/suitenumerique/ui-kit/pull/215), we 
        * should remove the pointer-events manipulation.
        * See: https://github.com/suitenumerique/docs/commit/d41e44dcd5a4111463b1bddfdab640faacbf1795
        */
        /* Remove outline from TreeViewItem wrapper elements */
        .c__tree-view--row {
          outline: none !important;
          pointer-events: initial;
          &:focus-visible {
            outline: none !important;
          }
        }

        .c__tree-view--node {
          pointer-events: inherit;
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
          'Use the up and down arrow keys to move between documents, and Enter to open one. Press F2 to reach the actions of a document and to move between them, use Escape to go back to the document list.',
        )}
      </Box>
      <Box
        $padding={{ horizontal: 'sm', top: 'sm', bottom: '4px' }}
        $css={css`
          z-index: 2;
        `}
      >
        <DocTreeRoot
          currentDoc={currentDoc}
          rootItemRef={rootItemRef}
          treeContext={treeContext}
        />
      </Box>

      {initialOpenState &&
        treeContext.treeData.nodes.length > 0 &&
        treeRoot && (
          <DocTreeSubpages
            doc={currentDoc}
            treeRoot={treeRoot}
            initialOpenState={initialOpenState}
            rootNodeId={treeContext.root.id}
            rootItemRef={rootItemRef}
          />
        )}
    </Box>
  );
};
