import { useTreeContext } from '@gouvfr-lasuite/ui-kit';

import { Doc } from '@/docs/doc-management';

export const useTreeUtils = (doc: Doc) => {
  const treeContext = useTreeContext<Doc>();

  return {
    isParent: doc.nb_accesses_ancestors <= 1, // it is a parent
    isChild: doc.nb_accesses_ancestors > 1, // it is a child
    isCurrentParent: treeContext?.root?.id === doc.id || doc.depth === 1, // it can be a child but not for the current user
    isDesynchronized: !!(
      doc.ancestors_link_reach &&
      (doc.computed_link_reach !== doc.ancestors_link_reach ||
        doc.computed_link_role !== doc.ancestors_link_role)
    ),
  } as const;
};
