import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/features/docs';

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
  listInvalideQueries?: string[];
}

export function useDeleteFavoriteDoc({
  onSuccess,
  listInvalideQueries,
}: DeleteFavoriteDocProps) {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, DeleteFavoriteDocParams>({
    mutationFn: deleteFavoriteDoc,
    onSuccess: () => {
      listInvalideQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });
      onSuccess?.();
    },
  });
}
