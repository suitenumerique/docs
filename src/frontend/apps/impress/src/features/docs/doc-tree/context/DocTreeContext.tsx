import { TreeViewDataType, useTree } from '@gouvfr-lasuite/ui-kit';
import React, { ReactNode, createContext, useContext, useState } from 'react';

import { Doc, getDoc } from '../../doc-management';
import { getDocChildren } from '../api/useDocChildren';

// import { useTree2 } from './useTree2';

// Interface pour le contexte de l'arbre de documents
interface DocTreeContextType {
  tree: ReturnType<typeof useTree<Doc>>;
  root: Doc | null;
  initialTargetId?: string | null;
  initialRootId?: string | null;
  setRoot: (doc: Doc | null) => void;
  setInitialTargetId: (id: string) => void;
  refreshRoot: () => Promise<void>;
}

// Création du contexte avec une valeur par défaut
const DocTreeContext = createContext<DocTreeContextType | undefined>(undefined);

// Props pour le provider
interface DocTreeProviderProps {
  children: ReactNode;
  initialData?: TreeViewDataType<Doc>[];
  initialRootId?: string;
  initialTargetId?: string;
}

// Provider qui expose les fonctionnalités de l'arbre
export const DocTreeProvider: React.FC<DocTreeProviderProps> = ({
  children,
  initialData = [],
  initialRootId,
  initialTargetId: targetId,
}) => {
  const [root, setRoot] = useState<Doc | null>(null);
  const [initialTargetId, setInitialTargetId] = useState<string | null>(
    targetId ?? null,
  );

  const tree = useTree(
    initialData,
    async (docId) => {
      const doc = await getDoc({ id: docId });

      return { ...doc, childrenCount: doc.numchild };
    },
    async (docId) => {
      const doc = await getDocChildren({ docId: docId });
      return doc.results ?? [];
    },
  );

  const refreshRoot = async () => {
    if (!root) {
      return;
    }
    const doc = await getDoc({ id: root.id });
    setRoot(doc);
  };

  const value: DocTreeContextType = {
    tree,
    root,
    setRoot,
    initialTargetId,
    initialRootId,
    setInitialTargetId,
    refreshRoot,
  };

  return (
    <DocTreeContext.Provider value={value}>{children}</DocTreeContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte
export const useDocTreeData = (): DocTreeContextType | undefined => {
  const context = useContext(DocTreeContext);
  if (context === undefined) {
    return;
  }
  return context;
};
