import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc, KEY_LIST_DOC } from '../../doc-management';

export type CreateDocParam = Pick<Doc, 'title'> & {
  parentId: string;
};

export const createDocChildren = async ({
  title,
  parentId,
}: CreateDocParam): Promise<Doc> => {
  const response = await fetchAPI(`documents/${parentId}/children/`, {
    method: 'POST',
    body: JSON.stringify({
      title,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to create the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

interface CreateDocProps {
  onSuccess: (data: Doc) => void;
}

export function useCreateChildrenDoc({ onSuccess }: CreateDocProps) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, CreateDocParam>({
    mutationFn: createDocChildren,
    onSuccess: (data) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      onSuccess(data);
    },
  });
}
