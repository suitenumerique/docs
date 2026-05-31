import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';

import { useConfig } from '@/core';

import { ContentTypes, useImportDoc } from '../api/useImportDoc';

interface UseImportProps {
  onDragOver: (isDragOver: boolean) => void;
}

interface AcceptedMap {
  [mime: string]: string[];
}

export const useImport = ({ onDragOver }: UseImportProps) => {
  const { toast } = useToastProvider();
  const { data: config } = useConfig();

  const MAX_FILE_SIZE = useMemo(() => {
    const maxSizeInBytes = config?.CONVERSION_FILE_MAX_SIZE ?? 10 * 1024 * 1024; // Default to 10MB

    const units = ['bytes', 'KB', 'MB', 'GB'];
    let size = maxSizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return {
      bytes: maxSizeInBytes,
      text: `${Math.round(size * 10) / 10}${units[unitIndex]}`,
    };
  }, [config?.CONVERSION_FILE_MAX_SIZE]);

  const ACCEPT = useMemo((): AcceptedMap => {
    const allowedExtensions = config?.CONVERSION_FILE_EXTENSIONS_ALLOWED?.map(
      (ext: string) => ext.toLowerCase(),
    ) ?? ['.docx', '.md'];

    return Object.values(ContentTypes).reduce(
      (acc: AcceptedMap, contentType) => {
        const matchedExtensions = contentType.extensions.filter((ext: string) =>
          allowedExtensions.includes(ext),
        );

        if (matchedExtensions.length > 0) {
          acc[contentType.mime] = matchedExtensions;
        }

        return acc;
      },
      {},
    );
  }, [config?.CONVERSION_FILE_EXTENSIONS_ALLOWED]);

  const toastInvalidFileType = useCallback(
    (fileName: string) => {
      const allowedExtensions = Object.values(ACCEPT).flat().join(', ');
      toast(
        t(
          allowedExtensions
            ? `The document "{{documentName}}" import has failed (only {{allowedExtensions}} files are allowed)`
            : `The document "{{documentName}}" import has failed`,
          {
            documentName: fileName,
            allowedExtensions,
          },
        ),
        VariantType.ERROR,
      );
    },
    [ACCEPT, toast],
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_FILE_SIZE.bytes,
    onDrop(acceptedFiles) {
      onDragOver(false);
      const allowedExtensions = Object.values(ACCEPT).flat();
      for (const file of acceptedFiles) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!allowedExtensions.includes(ext)) {
          toastInvalidFileType(file.name);
          continue;
        }
        importDoc([file, file.type]);
      }
    },
    onDragEnter: () => {
      onDragOver(true);
    },
    onDragLeave: () => {
      onDragOver(false);
    },
    onDropRejected(fileRejections) {
      fileRejections.forEach((rejection) => {
        const isFileTooLarge = rejection.errors.some(
          (error) => error.code === 'file-too-large',
        );

        if (isFileTooLarge) {
          toast(
            t(
              'The document "{{documentName}}" is too large. Maximum file size is {{maxFileSize}}.',
              {
                documentName: rejection.file.name,
                maxFileSize: MAX_FILE_SIZE.text,
              },
            ),
            VariantType.ERROR,
          );
        } else {
          toastInvalidFileType(rejection.file.name);
        }
      });
    },
    noClick: true,
    noKeyboard: true,
  });
  const { mutate: importDoc, isPending } = useImportDoc();

  return {
    getRootProps,
    getInputProps,
    open,
    isEnabled: config?.CONVERSION_UPLOAD_ENABLED || false,
    isPending,
  };
};
