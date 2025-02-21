import { useEffect, useState } from 'react';
import { OpenMap } from 'react-arborist/dist/module/state/open-slice';
import { css } from 'styled-components';

import { fetchAPI } from '@/api';
import { Box, SeparatedSection, StyledLink } from '@/components';
import { TreeView } from '@/components/common/tree/TreeView';
import { useTreeStore } from '@/components/common/tree/treeStore';
import { useCunninghamTheme } from '@/cunningham';

import { Doc } from '../../doc-management';
import { SimpleDocItem } from '../../docs-grid';
import { useDocTree } from '../api/useDocTree';
import { TreeViewDataType, TreeViewMoveResult } from '../types/tree';

import { DocTreeItem } from './DocTreeItem';

type Props = {
  docId: Doc['id'];
};

export type DocTreeDataType = TreeViewDataType<Doc>;
export const DocTree = ({ docId }: Props) => {
  const [rootNode, setRootNode] = useState<Doc | null>(null);
  const { spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();

  const [initialOpenState, setInitialOpenState] = useState<OpenMap | undefined>(
    undefined,
  );

  const {
    selectedNode,
    setSelectedNode,
    refreshNode,
    setTreeData: setTreeDataStore,
    treeData: treeDataStore,
  } = useTreeStore();

  const { data, isLoading, isFetching, isRefetching } = useDocTree({
    docId,
    page_size: 25,
    page: 1,
  });

  const afterMove = async (
    result: TreeViewMoveResult,
    newTreeData: TreeViewDataType<Doc>[],
  ) => {
    const { targetNodeId, mode: position, sourceNodeId, oldParentId } = result;
    await fetchAPI(`documents/${sourceNodeId}/move/`, {
      method: 'POST',
      body: JSON.stringify({
        target_document_id: targetNodeId,
        position,
      }),
    });

    setTreeDataStore(newTreeData);
    if (oldParentId) {
      refreshNode(oldParentId);
    }
    refreshNode(targetNodeId);
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    const initialOpenState: OpenMap = {};
    const root = data[0];

    initialOpenState[root.id] = true;

    const serialize = (
      children: Doc[],
      parentId: Doc['id'],
    ): DocTreeDataType[] => {
      if (children.length === 0) {
        return [];
      }
      return children.map((child) => {
        if (child?.children?.length && child?.children?.length > 0) {
          initialOpenState[child.id] = true;
        }

        if (docId === child.id) {
          setSelectedNode(child);
        }

        const node = {
          ...child,
          childrenCount: child.numchild,
          children: serialize(child.children ?? [], child.id),
          parentId: parentId,
        };
        if (child?.children?.length && child?.children?.length > 0) {
          initialOpenState[child.id] = true;
        }
        return node;
      });
    };

    root.children = serialize(root.children ?? [], docId);
    console.log('initialOpenState', initialOpenState);
    setInitialOpenState(initialOpenState);
    setRootNode(root);
    setTreeDataStore(root.children ?? []);
  }, [data, setTreeDataStore, docId, setSelectedNode, rootNode]);

  const isRootNodeSelected = !selectedNode
    ? true
    : selectedNode?.id === rootNode?.id;

  if (isLoading || isFetching || isRefetching) {
    return <div>Loading...</div>;
  }

  if (!data) {
    return <div>No data</div>;
  }

  return (
    <>
      <SeparatedSection showSeparator={false}>
        <Box $padding={{ horizontal: 'sm' }}>
          <Box
            $css={css`
              padding: ${spacing['2xs']};
              border-radius: 4px;
              background-color: ${isRootNodeSelected
                ? 'var(--c--theme--colors--greyscale-100)'
                : 'transparent'};
            `}
          >
            {rootNode && (
              <StyledLink
                href={`/docs/${rootNode.id}`}
                onClick={() => {
                  setSelectedNode(rootNode);
                }}
              >
                <SimpleDocItem doc={rootNode} showAccesses={false} />
              </StyledLink>
            )}
          </Box>
        </Box>
      </SeparatedSection>
      <Box $padding={{ all: 'sm' }} $margin={{ top: '-35px' }} $width="100%">
        {initialOpenState && treeDataStore.length > 0 && (
          <TreeView
            initialOpenState={initialOpenState}
            treeData={treeDataStore}
            width="100%"
            selectedNodeId={selectedNode?.id}
            rootNodeId={docId}
            renderNode={(props) => <DocTreeItem {...props} />}
            afterMove={(result, newTreeData) => {
              void afterMove(result, newTreeData);
            }}
          />
        )}
      </Box>
    </>
  );
};
