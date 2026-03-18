import { announce } from '@react-aria/live-announcer';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

export type CreateFavoriteDocParams = Pick<Doc, 'id'>;

export const createFavoriteDoc = async ({ id }: CreateFavoriteDocParams) => {
  const response = await fetchAPI(`documents/${id}/favorite/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to make the doc as favorite',
      await errorCauses(response),
    );
  }
};

interface CreateFavoriteDocProps {
  onSuccess?: () => void;
  listInvalidQueries?: string[];
}

export function useCreateFavoriteDoc({
  onSuccess,
  listInvalidQueries,
}: CreateFavoriteDocProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, APIError, CreateFavoriteDocParams>({
    mutationFn: createFavoriteDoc,
    onSuccess: () => {
      listInvalidQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });

      const message = t('Document pinned successfully!');
      announce(message, 'polite');

      onSuccess?.();
    },
    onError: () => {
      const message = t('Failed to pin the document.');
      announce(message, 'assertive');
    },
  });
}
