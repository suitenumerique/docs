import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import debug from 'debug';
import { Resource } from 'i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';

// Queries are separated from mutations to allow for better separation of concerns.
// Queries are responsible for R (READ) in CRUD.

// --- Read ---
const readCustomTranslations = async (): Promise<Resource> => {
  const response = await fetchAPI('custom-translations/');
  if (!response.ok) {
    throw new APIError(
      `Couldn't fetch custom translations: ${response.statusText}`,
      await errorCauses(response),
    );
  }
  return response.json() as Promise<Resource>;
};

// --- Query-Hook ---
export const QKEY_CUSTOM_TRANSLATIONS = 'translations_custom';
export function useCustomTranslationsQuery(
  queryConfig?: UseQueryOptions<Resource, APIError, Resource>,
) {
  return useQuery<Resource, APIError, Resource>({
    queryKey: [QKEY_CUSTOM_TRANSLATIONS],
    queryFn: readCustomTranslations,
    staleTime: debug.enabled('no-cache') ? 0 : 1000 * 60 * 60 * 24, // 24 hours
    ...queryConfig,
  });
}
