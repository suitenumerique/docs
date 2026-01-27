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

import {
  APIError,
  UseInfiniteQueryResultAPI,
  errorCauses,
  fetchAPI,
} from '@/api';
import { Doc, DocsResponse, KEY_LIST_DOC } from '@/docs/doc-management';

export enum ContentTypes {
  Docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  Markdown = 'text/markdown',
  OctetStream = 'application/octet-stream',
}

export const importDoc = async ([file, mimeType]: [
  File,
  string,
]): Promise<Doc> => {
  const form = new FormData();

  form.append(
    'file',
    new File([file], file.name, {
      type: mimeType,
      lastModified: file.lastModified,
    }),
  );

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

type UseImportDocOptions = UseMutationOptions<Doc, APIError, [File, string]>;

export function useImportDoc(props?: UseImportDocOptions) {
  const { toast } = useToastProvider();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Doc, APIError, [File, string]>({
    mutationFn: importDoc,
    ...props,
    onSuccess: (...successProps) => {
      const importedDoc = successProps[0];

      const updateDocsListCache = (isCreatorMe: boolean | undefined) => {
        queryClient.setQueriesData<UseInfiniteQueryResultAPI<DocsResponse>>(
          {
            queryKey: [
              KEY_LIST_DOC,
              {
                page: 1,
                ordering: undefined,
                is_creator_me: isCreatorMe,
                title: undefined,
                is_favorite: undefined,
              },
            ],
          },
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
                    results: [importedDoc, ...page.results],
                  };
                }
                return page;
              }),
            };
          },
        );
      };

      updateDocsListCache(undefined);
      updateDocsListCache(true);

      toast(
        t('The document "{{documentName}}" has been successfully imported', {
          documentName: importedDoc.title || '',
        }),
        VariantType.SUCCESS,
      );

      props?.onSuccess?.(...successProps);
    },
    onError: (...errorProps) => {
      toast(
        t(`The document "{{documentName}}" import has failed`, {
          documentName: errorProps?.[1][0].name || '',
        }),
        VariantType.ERROR,
      );

      props?.onError?.(...errorProps);
    },
  });
}
