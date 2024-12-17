import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/features/docs';

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
  listInvalideQueries?: string[];
}

export function useCreateFavoriteDoc({
  onSuccess,
  listInvalideQueries,
}: CreateFavoriteDocProps) {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, CreateFavoriteDocParams>({
    mutationFn: createFavoriteDoc,
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
