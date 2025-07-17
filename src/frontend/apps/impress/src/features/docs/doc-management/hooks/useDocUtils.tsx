import { Doc } from '@/docs/doc-management';

export const useDocUtils = (doc: Doc) => {
  return {
    isParent: doc.depth === 1, // it is a parent
    isChild: doc.depth > 1, // it is a child
    hasChildren: doc.numchild > 0, // it has children
    isDesyncronized: !!(
      doc.ancestors_link_reach &&
      doc.ancestors_link_role &&
      (doc.computed_link_reach !== doc.ancestors_link_reach ||
        doc.computed_link_role !== doc.ancestors_link_role)
    ),
  } as const;
};
