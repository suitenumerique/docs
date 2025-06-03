import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { KEY_LIST_DOC } from './useDocs';

export const importNotion = async (): Promise<void> => {
  const response = await fetchAPI('notion_import/run', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to import the Notion',
      await errorCauses(response),
    );
  }
};

export function useImportNotion() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation<void, APIError, void>({
    mutationFn: importNotion,
    onSuccess: () => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      router.push('/');
    },
  });
}
