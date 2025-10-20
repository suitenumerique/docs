import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/docs/doc-management';

export type UpdateDocLinkParams = Pick<Doc, 'id' | 'link_reach'> &
  Partial<Pick<Doc, 'link_role'>>;

export const updateDocLink = async ({
  id,
  ...params
}: UpdateDocLinkParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/${id}/link-configuration/`, {
    method: 'PUT',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to update the doc link',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<Doc>;
};

interface UpdateDocLinkProps {
  onSuccess?: (data: Doc) => void;
  listInvalideQueries?: string[];
}

export function useUpdateDocLink({
  onSuccess,
  listInvalideQueries,
}: UpdateDocLinkProps = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return useMutation<Doc, APIError, UpdateDocLinkParams>({
    mutationFn: updateDocLink,
    onSuccess: (data) => {
      listInvalideQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });

      toast(
        t('The document visibility has been updated.'),
        VariantType.SUCCESS,
        {
          duration: 2000,
        },
      );

      onSuccess?.(data);
    },
  });
}
