import { create } from 'zustand';

import { Doc, getDoc } from '@/features/docs';
import { TreeViewDataType } from '@/features/docs/doc-tree/types/tree';

interface TreeStore<T> {
  treeData: TreeViewDataType<T>[];
  selectedNode: TreeViewDataType<T> | null;
  setSelectedNode: (node: TreeViewDataType<T> | null) => void;
  setTreeData: (data: TreeViewDataType<T>[]) => void;
  updateNode: (nodeId: string, newData: Partial<TreeViewDataType<T>>) => void;
  addRootNode: (node: TreeViewDataType<T>) => void;
  removeNode: (nodeId: string) => void;
  addChildNode: (parentId: string, newNode: TreeViewDataType<T>) => void;
  refreshNode: (nodeId: string) => void;
  findNode: (nodeId: string) => TreeViewDataType<T> | null;
}

export const createTreeStore = <T>(
  refreshCallback?: (id: string) => Promise<Partial<TreeViewDataType<T>>>,
) =>
  create<TreeStore<T>>((set, get) => ({
    treeData: [],
    selectedNode: null,
    setSelectedNode: (node) => {
      set({ selectedNode: node });
    },
    setTreeData: (data) => {
      set({ treeData: data });
    },
    refreshNode: (nodeId) => {
      set((state) => {
        const node = state.findNode(nodeId);
        if (!node) {
          return state;
        }
        refreshCallback?.(nodeId)
          .then((data) => {
            state.updateNode(nodeId, { ...node, ...data });
          })
          .catch((error) => {
            console.error(error);
          });
        return state;
      });
    },
    updateNode: (nodeId, newData) => {
      set((state) => {
        const updateNodeInTree = (
          nodes: TreeViewDataType<T>[],
        ): TreeViewDataType<T>[] => {
          return nodes.map((node) => {
            if (node.id === nodeId) {
              return { ...node, ...newData };
            }
            if (node.children) {
              return {
                ...node,
                children: updateNodeInTree(node.children),
              };
            }
            return node;
          });
        };

        return {
          treeData: updateNodeInTree(state.treeData),
        };
      });
    },

    addRootNode: (node) => {
      set((state) => ({
        treeData: [...state.treeData, node],
      }));
    },

    removeNode: (nodeId) => {
      set((state) => {
        const removeNodeFromTree = (
          nodes: TreeViewDataType<T>[],
        ): TreeViewDataType<T>[] => {
          const filteredNodes = nodes.filter((node) => node.id !== nodeId);

          return filteredNodes.map((node) => {
            if (node.children) {
              return {
                ...node,
                children: removeNodeFromTree(node.children),
              };
            }
            return node;
          });
        };

        return {
          treeData: removeNodeFromTree(state.treeData),
        };
      });
    },

    addChildNode: (parentId, newNode) => {
      set((state) => {
        const addChildToNode = (
          nodes: TreeViewDataType<T>[],
        ): TreeViewDataType<T>[] => {
          return nodes.map((node) => {
            if (node.id === parentId) {
              return {
                ...node,
                children: [...(node.children || []), newNode],
              };
            }
            if (node.children) {
              return {
                ...node,
                children: addChildToNode(node.children),
              };
            }
            return node;
          });
        };

        return {
          treeData: addChildToNode(state.treeData),
        };
      });
    },

    findNode: (nodeId) => {
      const findNodeInTree = (
        nodes: TreeViewDataType<T>[],
      ): TreeViewDataType<T> | null => {
        for (const node of nodes) {
          if (node.id === nodeId) {
            return node;
          }
          if (node.children) {
            const found = findNodeInTree(node.children);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      return findNodeInTree(get().treeData);
    },
  }));

// Créer une instance du store
// export const useTreeStore = createTreeStore();
export const useTreeStore = createTreeStore<Doc>(async (docId) => {
  const doc = await getDoc({ id: docId });
  return { ...doc, childrenCount: doc.numchild };
});
