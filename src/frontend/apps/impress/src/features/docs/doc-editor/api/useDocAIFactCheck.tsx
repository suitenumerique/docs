import { useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type DocAIFactCheck = {
  docId: string;
  text: string;
};

export type DocAIFactCheckResponse = {
  answer: {
    claim: string;
    accuracy: string;
    justification: string;
    references: string[];
  };
};

export const docAIFactCheck = async ({
  docId,
  ...params
}: DocAIFactCheck): Promise<DocAIFactCheckResponse> => {
  const response = await fetchAPI(`documents/${docId}/ai-fact-check/`, {
    method: 'POST',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to request ai fact check',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DocAIFactCheckResponse>;
};

export function useDocAIFactCheck() {
  return useMutation<DocAIFactCheckResponse, APIError, DocAIFactCheck>({
    mutationFn: docAIFactCheck,
  });
}
