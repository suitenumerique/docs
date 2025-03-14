import { TreeView, TreeViewMoveResult } from '@gouvfr-lasuite/ui-kit';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect } from 'react';
import { css } from 'styled-components';

import { Box, SeparatedSection, StyledLink } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { Doc } from '../../doc-management';
import { SimpleDocItem } from '../../docs-grid';
import { useDocTree } from '../api/useDocTree';
import { useMoveDoc } from '../api/useMove';
import { useDocTreeData } from '../context/DocTreeContext';

import { DocSubPageItem } from './DocSubPageItem';
import { DocTreeItemActions } from './DocTreeItemActions';

type DocTreeProps = {
  initialTargetId: string;
};
export const DocTree = ({ initialTargetId }: DocTreeProps) => {
  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();
  const treeData = useDocTreeData();
  const router = useRouter();

  const { mutate: moveDoc } = useMoveDoc();

  const { data } = useDocTree({
    docId: initialTargetId,
  });

  const handleMove = (result: TreeViewMoveResult) => {
    moveDoc({
      sourceDocumentId: result.sourceId,
      targetDocumentId: result.newParentId ?? result.targetModeId,
      position: result.mode,
    });
    treeData?.tree.handleMove(result);
  };
  useEffect(() => {
    if (!data) {
      return;
    }
    const { children: rootChildren, ...root } = data;
    const children = rootChildren ?? [];
    treeData?.setRoot(root);
    children.map((child) => {
      child.childrenCount = child.numchild ?? 0;
    });
    treeData?.tree.resetTree(children);
    if (initialTargetId === root.id) {
      treeData?.tree.selectNodeById(root.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rootIsSelected = treeData?.tree.selectedNode?.id === treeData?.root?.id;

  if (!initialTargetId || !treeData) {
    return null;
  }

  return (
    <Fragment>
      <SeparatedSection showSeparator={false}>
        <Box $padding={{ horizontal: 'sm' }}>
          <Box
            $css={css`
              padding: ${spacing['2xs']};
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
            {/* {TreeViewMoveModeEnum.FIRST_CHILD} */}
            {treeData.root !== null && (
              <StyledLink
                $css={css`
                  width: 100%;
                `}
                href={`/docs/${treeData.root.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  treeData.tree.setSelectedNode(treeData.root ?? undefined);
                  router.push(`/docs/${treeData?.root?.id}`);
                }}
              >
                <Box $direction="row" $align="center" $width="100%">
                  <SimpleDocItem doc={treeData.root} showAccesses={true} />
                  <div className="doc-tree-root-item-actions">
                    <DocTreeItemActions
                      doc={treeData.root}
                      onCreateSuccess={(createdDoc) => {
                        const newDoc = {
                          ...createdDoc,
                          children: [],
                          childrenCount: 0,
                          parentId: treeData.root?.id ?? undefined,
                        };
                        treeData?.tree.addChild(null, newDoc);
                      }}
                    />
                  </div>
                </Box>
              </StyledLink>
            )}
          </Box>
        </Box>
      </SeparatedSection>

      <TreeView
        handleMove={handleMove}
        selectedNodeId={
          treeData.tree.selectedNode?.id ??
          treeData.initialTargetId ??
          undefined
        }
        treeData={treeData.tree.nodes ?? []}
        rootNodeId={treeData.root?.id ?? ''}
        renderNode={(props) => {
          return (
            <DocSubPageItem
              {...props}
              doc={props.node.data.value as Doc}
              loadChildren={(node) => treeData.tree.handleLoadChildren(node.id)}
              setSelectedNode={treeData.tree.setSelectedNode}
            />
          );
        }}
      />
    </Fragment>
  );
};
