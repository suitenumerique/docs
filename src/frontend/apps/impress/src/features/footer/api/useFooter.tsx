import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { FooterType } from '../types';

export const getFooter = async (): Promise<FooterType> => {
  const response = await fetchAPI(`footer/`);

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  return response.json() as Promise<FooterType>;
};

export const KEY_FOOTER = 'footer';

export function useFooter(
  queryConfig?: UseQueryOptions<FooterType, APIError, FooterType>,
) {
  return useQuery<FooterType, APIError, FooterType>({
    queryKey: [KEY_FOOTER],
    queryFn: getFooter,
    ...queryConfig,
  });
}
