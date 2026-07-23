import {
  DocDefaultFilter,
  DocsOrdering,
  useInfiniteDocs,
} from '../../doc-management';

import { useInfiniteDocsTrashbin } from './useDocsTrashbin';

export const useDocsGridQuery = (
  target: DocDefaultFilter,
  ordering: DocsOrdering,
) => {
  const trashbinQuery = useInfiniteDocsTrashbin(
    {
      page: 1,
    },
    {
      enabled: target === DocDefaultFilter.TRASHBIN,
    },
  );

  const docsQuery = useInfiniteDocs(
    {
      page: 1,
      ordering,
      ...(target &&
        target !== DocDefaultFilter.ALL_DOCS && {
          is_creator_me: target === DocDefaultFilter.MY_DOCS,
        }),
    },
    {
      enabled: target !== DocDefaultFilter.TRASHBIN,
    },
  );

  return target === DocDefaultFilter.TRASHBIN ? trashbinQuery : docsQuery;
};
