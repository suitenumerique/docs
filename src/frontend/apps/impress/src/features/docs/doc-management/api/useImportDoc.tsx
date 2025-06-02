import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

import { KEY_LIST_DOC } from './useDocs';

export const importDoc = async (file: File): Promise<Doc> => {
  const form = new FormData();
  form.append('file', file);

  const responseConversion = await fetch('https://api.docspec.dev/conversion', {
    method: 'POST',
    body: form,
  });

  if (!responseConversion.ok) {
    throw new APIError(
      'Failed to convert the doc',
      await errorCauses(responseConversion),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const blocksJSON = await responseConversion.json();

  const responseYDoc = await fetch('https://blocknote-api.docspec.dev/', {
    method: 'POST',
    body: JSON.stringify(blocksJSON),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  });

  if (!responseYDoc.ok) {
    throw new APIError(
      'Failed to convert the doc to YDoc',
      await errorCauses(responseYDoc),
    );
  }

  const ydoc = await responseYDoc.text();

  const response = await fetchAPI(`documents/`, {
    method: 'POST',
    body: JSON.stringify({ content: ydoc }),
  });

  if (!response.ok) {
    throw new APIError('Failed to create the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

interface ImportDocProps {
  onSuccess: (data: Doc) => void;
}

export function useImportDoc({ onSuccess }: ImportDocProps) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, File>({
    mutationFn: importDoc,
    onSuccess: (data) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      onSuccess(data);
    },
  });
}
