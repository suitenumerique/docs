import { Doc } from '@/docs/doc-management';

export const useDocUtils = (doc: Doc) => {
  return {
    isTopRoot: doc.depth === 1,
    isChild: doc.depth > 1,
    hasChildren: doc.numchild > 0,
    isDesynchronized: !!(
      doc.ancestors_link_reach &&
      (doc.computed_link_reach !== doc.ancestors_link_reach ||
        doc.computed_link_role !== doc.ancestors_link_role)
    ),
  } as const;
};
