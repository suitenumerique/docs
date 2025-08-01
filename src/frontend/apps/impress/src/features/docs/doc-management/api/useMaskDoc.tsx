import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/docs/doc-management';

export type MaskDocParams = Pick<Doc, 'id'>;

export const maskDoc = async ({ id }: MaskDocParams) => {
  const response = await fetchAPI(`documents/${id}/mask/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to make the doc as masked',
      await errorCauses(response),
    );
  }
};

interface MaskDocProps {
  onSuccess?: () => void;
  listInvalideQueries?: string[];
}

export function useMaskDoc({ onSuccess, listInvalideQueries }: MaskDocProps) {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, MaskDocParams>({
    mutationFn: maskDoc,
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

export type DeleteMaskDocParams = Pick<Doc, 'id'>;

export const deleteMaskDoc = async ({ id }: DeleteMaskDocParams) => {
  const response = await fetchAPI(`documents/${id}/mask/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to remove the doc as masked',
      await errorCauses(response),
    );
  }
};

interface DeleteMaskDocProps {
  onSuccess?: () => void;
  listInvalideQueries?: string[];
}

export function useDeleteMaskDoc({
  onSuccess,
  listInvalideQueries,
}: DeleteMaskDocProps) {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, DeleteMaskDocParams>({
    mutationFn: deleteMaskDoc,
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
