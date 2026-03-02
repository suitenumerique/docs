import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';

import { useConfig } from '@/core';

import { ContentTypes, useImportDoc } from '../api/useImportDoc';

interface UseImportProps {
  onDragOver: (isDragOver: boolean) => void;
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

  const ACCEPT = useMemo(() => {
    const extensions = config?.CONVERSION_FILE_EXTENSIONS_ALLOWED;
    const accept: { [key: string]: string[] } = {};

    if (extensions && extensions.length > 0) {
      extensions.forEach((ext) => {
        switch (ext.toLowerCase()) {
          case '.docx':
            accept[ContentTypes.Docx] = ['.docx'];
            break;
          case '.md':
          case '.markdown':
            accept[ContentTypes.Markdown] = ['.md'];
            break;
          default:
            break;
        }
      });
    } else {
      // Default to docx and md if no configuration is provided
      accept[ContentTypes.Docx] = ['.docx'];
      accept[ContentTypes.Markdown] = ['.md'];
    }

    return accept;
  }, [config?.CONVERSION_FILE_EXTENSIONS_ALLOWED]);

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_FILE_SIZE.bytes,
    onDrop(acceptedFiles) {
      onDragOver(false);
      for (const file of acceptedFiles) {
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
          toast(
            t(
              `The document "{{documentName}}" import has failed (only .docx and .md files are allowed)`,
              {
                documentName: rejection.file.name,
              },
            ),
            VariantType.ERROR,
          );
        }
      });
    },
    noClick: true,
  });
  const { mutate: importDoc, isPending } = useImportDoc();

  return { getRootProps, getInputProps, open, isPending };
};
