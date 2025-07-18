import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc, KEY_LIST_DOC } from '..';

export type CreateChildDocParam = Pick<Doc, 'title'> & {
  parentId: string;
};

export const createChildDoc = async ({
  title,
  parentId,
}: CreateChildDocParam): Promise<Doc> => {
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

interface UseCreateChildDocProps {
  onSuccess: (doc: Doc) => void;
}

export function useCreateChildDoc({ onSuccess }: UseCreateChildDocProps) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, CreateChildDocParam>({
    mutationFn: createChildDoc,
    onSuccess: (doc) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      onSuccess(doc);
    },
  });
}
