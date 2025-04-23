import {
  OpenMap,
  TreeView,
  TreeViewMoveResult,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_SUB_PAGE,
  SimpleDocItem,
  useDoc,
  useDocStore,
} from '@/docs/doc-management';

import { useDocTree } from '../api/useDocTree';
import { useMoveDoc } from '../api/useMove';
import { canDrag, canDrop, serializeDocToSubPage } from '../utils';

import { DocSubPageItem } from './DocSubPageItem';
import { DocTreeItemActions } from './DocTreeItemActions';

type DocTreeProps = {
  initialTargetId: string;
};
export const DocTree = ({ initialTargetId }: DocTreeProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const treeContext = useTreeContext<Doc>();
  const { currentDoc } = useDocStore();
  const router = useRouter();

  const previousDocId = useRef<string | null>(initialTargetId);

  const { data: rootNode } = useDoc(
    { id: treeContext?.root?.id ?? '' },
    {
      enabled: !!treeContext?.root?.id,
      initialData: treeContext?.root ?? undefined,
      queryKey: [KEY_SUB_PAGE, { id: treeContext?.root?.id ?? '' }],
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  const [initialOpenState, setInitialOpenState] = useState<OpenMap | undefined>(
    undefined,
  );

  const { mutate: moveDoc } = useMoveDoc();

  const { data } = useDocTree({
    docId: initialTargetId,
  });

  const handleMove = (result: TreeViewMoveResult) => {
    moveDoc({
      sourceDocumentId: result.sourceId,
      targetDocumentId: result.targetModeId,
      position: result.mode,
    });
    treeContext?.treeData.handleMove(result);
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    const { children: rootChildren, ...root } = data;
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
    if (initialTargetId === root.id) {
      treeContext?.treeData.setSelectedNode(root);
    } else {
      treeContext?.treeData.selectNodeById(initialTargetId);
    }

    // Because treeData change in the treeContext, we have a infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, initialTargetId]);

  useEffect(() => {
    if (
      !currentDoc ||
      (previousDocId.current && previousDocId.current === currentDoc.id)
    ) {
      return;
    }

    const item = treeContext?.treeData.getNode(currentDoc?.id ?? '');
    if (!item && currentDoc.id !== rootNode?.id) {
      treeContext?.treeData.resetTree([]);
      treeContext?.setRoot(currentDoc);
      treeContext?.setInitialTargetId(currentDoc.id);
    } else if (item) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { children, ...rest } = currentDoc;
      treeContext?.treeData.updateNode(
        currentDoc.id,
        serializeDocToSubPage(rest),
      );
    }
    if (currentDoc?.id && currentDoc?.id !== previousDocId.current) {
      previousDocId.current = currentDoc?.id;
    }

    treeContext?.treeData.setSelectedNode(currentDoc);

    // we don't need to run this effect on every change of treeContext.data bacause it cause an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDoc, rootNode?.id]);

  const rootIsSelected =
    treeContext?.treeData.selectedNode?.id === treeContext?.root?.id;

  if (!initialTargetId || !treeContext) {
    return null;
  }

  return (
    <Box data-testid="doc-tree" $height="100%">
      <Box $padding={{ horizontal: 'sm', top: 'sm', bottom: '-1px' }}>
        <Box
          $css={css`
            padding: ${spacingsTokens['2xs']};
            border-radius: 4px;
            width: 100%;
            background-color: ${rootIsSelected
              ? 'var(--c--theme--colors--greyscale-100)'
              : 'transparent'};

            &:hover {
              background-color: var(--c--theme--colors--greyscale-100);
            }

            .doc-tree-root-item-actions {
              display: 'flex';
              opacity: 0;

              &:has(.isOpen) {
                opacity: 1;
              }
            }
            &:hover {
              .doc-tree-root-item-actions {
                opacity: 1;
              }
            }
          `}
        >
          {treeContext.root !== null && rootNode && (
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
            >
              <Box $direction="row" $align="center" $width="100%">
                <SimpleDocItem doc={rootNode} showAccesses={true} />
                <div className="doc-tree-root-item-actions">
                  <DocTreeItemActions
                    doc={rootNode}
                    onCreateSuccess={(createdDoc) => {
                      const newDoc = {
                        ...createdDoc,
                        children: [],
                        childrenCount: 0,
                        parentId: treeContext.root?.id ?? undefined,
                      };
                      treeContext?.treeData.addChild(null, newDoc);
                    }}
                  />
                </div>
              </Box>
            </StyledLink>
          )}
        </Box>
      </Box>

      {initialOpenState && treeContext.treeData.nodes.length > 0 && (
        <TreeView
          initialOpenState={initialOpenState}
          afterMove={handleMove}
          selectedNodeId={
            treeContext.treeData.selectedNode?.id ??
            treeContext.initialTargetId ??
            undefined
          }
          canDrop={({ parentNode }) => {
            if (!rootNode) {
              return false;
            }
            const parentDoc = parentNode?.data.value as Doc;
            if (!parentDoc) {
              return canDrop(rootNode);
            }
            return canDrop(parentDoc);
          }}
          canDrag={(node) => {
            const doc = node.value as Doc;
            return canDrag(doc);
          }}
          rootNodeId={treeContext.root?.id ?? ''}
          renderNode={DocSubPageItem}
        />
      )}
    </Box>
  );
};
