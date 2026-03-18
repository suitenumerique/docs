import { announce } from '@react-aria/live-announcer';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

export type DeleteFavoriteDocParams = Pick<Doc, 'id'>;

export const deleteFavoriteDoc = async ({ id }: DeleteFavoriteDocParams) => {
  const response = await fetchAPI(`documents/${id}/favorite/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to remove the doc as favorite',
      await errorCauses(response),
    );
  }
};

interface DeleteFavoriteDocProps {
  onSuccess?: () => void;
  listInvalidQueries?: string[];
}

export function useDeleteFavoriteDoc({
  onSuccess,
  listInvalidQueries,
}: DeleteFavoriteDocProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, APIError, DeleteFavoriteDocParams>({
    mutationFn: deleteFavoriteDoc,
    onSuccess: () => {
      listInvalidQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });

      const message = t('Document unpinned successfully!');
      announce(message, 'polite');

      onSuccess?.();
    },
    onError: () => {
      const message = t('Failed to unpin the document.');
      announce(message, 'assertive');
    },
  });
}
