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
  listInvalidQueries?: string[];
}

export function useDeleteFavoriteDoc({
  onSuccess,
  listInvalidQueries,
}: DeleteFavoriteDocProps) {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, DeleteFavoriteDocParams>({
    mutationFn: deleteFavoriteDoc,
    onSuccess: () => {
      listInvalidQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });
      onSuccess?.();
    },
  });
}
