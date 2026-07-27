import {
  DocDefaultFilter,
  DocsOrdering,
  useInfiniteDocs,
  useInfiniteDocsFavorite,
} from '@/docs/doc-management';

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

  const favoriteQuery = useInfiniteDocsFavorite(
    {
      page: 1,
      ordering,
    },
    {
      enabled: target === DocDefaultFilter.STARRED,
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
      enabled:
        target !== DocDefaultFilter.TRASHBIN &&
        target !== DocDefaultFilter.STARRED,
    },
  );

  switch (target) {
    case DocDefaultFilter.TRASHBIN:
      return trashbinQuery;
    case DocDefaultFilter.STARRED:
      return favoriteQuery;
    default:
      return docsQuery;
  }
};
