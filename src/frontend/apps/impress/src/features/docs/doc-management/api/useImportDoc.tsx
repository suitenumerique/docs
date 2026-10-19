import { VariantType } from '@gouvfr-lasuite/ui-components';
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
import { useConfig } from '@/core';
import { useToast } from '@/hooks';

import { Doc } from '../types';

import { DocsResponse, KEY_LIST_DOC } from './useDocs';

interface ContentType {
  mime: string;
  extensions: string[];
}

export const ContentTypes: {
  Docx: ContentType;
  Markdown: ContentType;
  OctetStream: ContentType;
} = {
  Docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
  },
  Markdown: {
    mime: 'text/markdown',
    extensions: ['.md'],
  },
  OctetStream: {
    mime: 'application/octet-stream',
    extensions: [],
  },
};

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { data: config } = useConfig();

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
          description:
            'Toast message when the document has been successfully imported',
        }),
        VariantType.SUCCESS,
      );

      props?.onSuccess?.(...successProps);
    },
    onError: (...errorProps) => {
      const [error, [file]] = errorProps;
      const documentName = file?.name || '';

      if (error.status === 415) {
        const allowedExtensions =
          config?.CONVERSION_FILE_EXTENSIONS_ALLOWED?.join(', ') || '';
        toast(
          allowedExtensions
            ? t(
                `The document "{{documentName}}" import has failed (only {{allowedExtensions}} files are allowed)`,
                {
                  documentName,
                  allowedExtensions,
                  description:
                    'Toast message when the document import has failed due to unsupported media type',
                },
              )
            : t(`The document "{{documentName}}" import has failed`, {
                documentName,
                description:
                  'Toast message when the document import has failed due to unsupported media type',
              }),
          VariantType.ERROR,
        );
      } else if (error.status === 422) {
        toast(
          t(
            `The import of the document « {{documentName}} » failed because something is wrong with the file.`,
            {
              documentName,
              description:
                'Toast message when the document import has failed due to unprocessable entity',
            },
          ),
          VariantType.ERROR,
        );
      } else if (error.status === 500) {
        toast(
          t(
            `The import of the document « {{documentName}} » failed due to a technical issue`,
            {
              documentName,
              description:
                'Toast message when the document import has failed due to a technical issue',
            },
          ),
          VariantType.ERROR,
        );
      } else {
        toast(
          t(`The document "{{documentName}}" import has failed`, {
            documentName,
            description:
              'Toast message when the document import has failed due to an unknown error',
          }),
          VariantType.ERROR,
        );
      }

      props?.onError?.(...errorProps);
    },
  });
}
