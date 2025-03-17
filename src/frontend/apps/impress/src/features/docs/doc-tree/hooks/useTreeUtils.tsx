import { useTreeContext } from '@gouvfr-lasuite/ui-kit';

import { Doc } from '@/docs/doc-management';

export const useTreeUtils = (doc: Doc) => {
  const treeContext = useTreeContext<Doc>();

  return {
    isParent: doc.nb_accesses_ancestors <= 1, // it is a parent
    isChild: doc.nb_accesses_ancestors > 1, // it is a child
    isCurrentParent: treeContext?.root?.id === doc.id, // it can be a child but not for the current user
  } as const;
};
