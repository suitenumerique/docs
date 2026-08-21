import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

import { KEY_LIST_DOC } from './useDocs';

interface DuplicateDocPayload {
  docId: string;
  with_accesses?: boolean;
}

type DuplicateDocResponse = Pick<Doc, 'id'>;

export const duplicateDoc = async ({
  docId,
  with_accesses,
}: DuplicateDocPayload): Promise<DuplicateDocResponse> => {
  const response = await fetchAPI(`documents/${docId}/duplicate/`, {
    method: 'POST',
    body: JSON.stringify({ with_accesses }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to duplicate the doc',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DuplicateDocResponse>;
};

type DuplicateDocParams = DuplicateDocPayload & {
  canSave: boolean;
};

type DuplicateDocOptions = UseMutationOptions<
  DuplicateDocResponse,
  APIError,
  DuplicateDocParams
>;

export function useDuplicateDoc(options?: DuplicateDocOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToastProvider();
  const { t } = useTranslation();

  return useMutation<DuplicateDocResponse, APIError, DuplicateDocParams>({
    // TODO(yhub): double check the saving is made correctly from the back so
    mutationFn: duplicateDoc,
    onSuccess: (data, variables, onMutateResult, context) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });

      const message = t('Document duplicated successfully!');
      toast(message, VariantType.SUCCESS, {
        duration: 3000,
      });

      void options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const message = t('Failed to duplicate the document...');
      toast(message, VariantType.ERROR, {
        duration: 3000,
      });

      void options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
