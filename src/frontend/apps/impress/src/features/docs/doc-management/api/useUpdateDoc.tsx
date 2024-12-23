import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/features/docs';

export type UpdateDocParams = Pick<Doc, 'id'> &
  Partial<Pick<Doc, 'content' | 'title'>>;

export const updateDoc = async ({
  id,
  ...params
}: UpdateDocParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to update the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

interface UpdateDocProps {
  onSuccess?: (data: Doc) => void;
  listInvalideQueries?: string[];
}

export function useUpdateDoc({
  onSuccess,
  listInvalideQueries,
}: UpdateDocProps = {}) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, UpdateDocParams>({
    mutationFn: updateDoc,
    onSuccess: (data) => {
      listInvalideQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });
      onSuccess?.(data);
    },
  });
}
