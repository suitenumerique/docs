import { useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type AITransformActions =
  | 'correct'
  | 'prompt'
  | 'rephrase'
  | 'summarize'
  | 'beautify'
  | 'emojify';

export type DocAITransform = {
  docId: string;
  text: string;
  action: AITransformActions;
};

export type DocAITransformResponse = {
  answer: string;
};

export const docAITransform = async ({
  docId,
  ...params
}: DocAITransform): Promise<DocAITransformResponse> => {
  const response = await fetchAPI(`documents/${docId}/ai-transform/`, {
    method: 'POST',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to request ai transform',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DocAITransformResponse>;
};

export function useDocAITransform() {
  return useMutation<DocAITransformResponse, APIError, DocAITransform>({
    mutationFn: docAITransform,
  });
}
