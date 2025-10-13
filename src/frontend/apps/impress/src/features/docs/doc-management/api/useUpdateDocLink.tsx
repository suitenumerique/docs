import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { useBroadcastStore } from '@/stores';

import { Doc } from '../types';

import { KEY_DOC } from './useDoc';

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
  const { broadcast } = useBroadcastStore();
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return useMutation<Doc, APIError, UpdateDocLinkParams>({
    mutationFn: updateDocLink,
    onSuccess: (data, variable) => {
      listInvalideQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });

      // Broadcast to every user connected to the document
      broadcast(`${KEY_DOC}-${variable.id}`);

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
