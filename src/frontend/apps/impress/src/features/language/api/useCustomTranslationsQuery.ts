import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { Resource } from 'i18next';

import { APIError, errorCauses } from '@/api';
import { assert } from '@/utils';

// Queries are separated from mutations to allow for better separation of concerns.
// Queries are responsible for R (READ) in CRUD.

// --- Read ---
const readCustomTranslations = async (url: URL): Promise<Resource> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new APIError(
      'Failed to fetch custom translations',
      await errorCauses(response),
    );
  }
  return response.json() as Promise<Resource>;
};

// --- Query-Hook ---
export const QKEY_CUSTOM_TRANSLATIONS = 'translations_custom';
export function useCustomTranslationsQuery(
  url?: URL,
  queryConfig?: UseQueryOptions<Resource, APIError, Resource>,
) {
  return useQuery<Resource, APIError, Resource>({
    queryKey: [QKEY_CUSTOM_TRANSLATIONS, url],
    queryFn: () => {
      assert(url);
      return readCustomTranslations(url);
    },
    enabled: !!url,
    ...queryConfig,
  });
}
