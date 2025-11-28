import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  APIError,
  UseInfiniteQueryResultAPI,
  errorCauses,
  fetchAPI,
} from '@/api';
import { Doc, DocsResponse, KEY_LIST_DOC } from '@/docs/doc-management';

export const importDoc = async (file: File): Promise<Doc> => {
  const form = new FormData();
  form.append('file', file);

  const response = await fetchAPI(`documents/`, {
    method: 'POST',
    body: form,
    withoutContentType: true,
  });

  if (!response.ok) {
    throw new APIError('Failed to import the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

type UseImportDocOptions = UseMutationOptions<Doc, APIError, File>;

export function useImportDoc(props?: UseImportDocOptions) {
  const { toast } = useToastProvider();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Doc, APIError, File>({
    mutationFn: importDoc,
    ...props,
    onSuccess: (...successProps) => {
      queryClient.setQueriesData<UseInfiniteQueryResultAPI<DocsResponse>>(
        { queryKey: [KEY_LIST_DOC] },
        (oldData) => {
          if (!oldData || oldData?.pages.length === 0) {
            return oldData;
          }

          return {
            ...oldData,
            pages: oldData.pages.map((page, index) => {
              // Add the new doc to the first page only
              if (index === 0) {
                return {
                  ...page,
                  results: [successProps[0], ...page.results],
                };
              }
              return page;
            }),
          };
        },
      );

      toast(
        t('The document "{{documentName}}" has been successfully imported', {
          documentName: successProps?.[0].title || '',
        }),
        VariantType.SUCCESS,
      );

      props?.onSuccess?.(...successProps);
    },
    onError: (...errorProps) => {
      toast(
        t(`The document "{{documentName}}" import has failed`, {
          documentName: errorProps?.[1].name || '',
        }),
        VariantType.ERROR,
      );

      props?.onError?.(...errorProps);
    },
  });
}
