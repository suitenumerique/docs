import { Block } from '@blocknote/core';
import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { captureException } from '@sentry/nextjs';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { backendUrl } from '@/api';
import { useConfig } from '@/core';
import { formatFileSize } from '@/utils';
import { isSafeUrl } from '@/utils/url';

import { useCreateDocAttachment } from '../api';
import { ANALYZE_URL } from '../conf';
import { DocsBlockNoteEditor } from '../types';

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // Default to 10MB

export const useUploadFile = (docId: string) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { data: config } = useConfig();
  const {
    mutateAsync: createDocAttachment,
    isError: isErrorAttachment,
    error: errorAttachment,
  } = useCreateDocAttachment();

  const maxFileSize = config?.DOCUMENT_IMAGE_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE;

  const uploadFile = useCallback(
    async (file: File) => {
      // The server rejects an oversized file, but the proxy in front of it usually cuts the
      // request first and answers a bare 413 the editor cannot make sense of. Telling the
      // user before sending anything saves them the wait and the cryptic message.
      if (file.size > maxFileSize) {
        toast(
          t(
            'The file "{{fileName}}" is too large. Maximum file size is {{maxFileSize}}.',
            {
              fileName: file.name,
              maxFileSize: formatFileSize(maxFileSize),
            },
          ),
          VariantType.ERROR,
        );

        throw new Error('File is too large');
      }

      const body = new FormData();
      body.append('file', file);

      const ret = await createDocAttachment({
        docId,
        body,
      });

      return `${backendUrl()}${ret.file}`;
    },
    [createDocAttachment, docId, maxFileSize, t, toast],
  );

  return {
    uploadFile,
    isErrorAttachment,
    errorAttachment,
  };
};

/**
 * When we upload a file it can takes some time to analyze it (e.g. virus scan).
 * This hook listen to upload end and replace the uploaded block by a uploadLoader
 * block to show analyzing status.
 * The uploadLoader block will then handle the status display until the analysis is done
 * then replaced by the final block (e.g. image, pdf, etc.).
 * @param editor
 */
export const useUploadStatus = (editor: DocsBlockNoteEditor) => {
  const { t } = useTranslation();

  /**
   * Replace the resource block by a uploadLoader block to show analyzing status
   */
  const replaceBlockWithUploadLoader = useCallback(
    (block: Block) => {
      if (
        !block ||
        !('url' in block.props) ||
        ('url' in block.props && !block.props.url.includes(ANALYZE_URL)) ||
        !isSafeUrl(block.props.url)
      ) {
        return;
      }

      const blockUploadUrl = block.props.url;
      const blockUploadType = block.type;
      const blockUploadName = block.props.name;
      const blockUploadShowPreview =
        ('showPreview' in block.props && block.props.showPreview) || false;

      try {
        editor.replaceBlocks(
          [block.id],
          [
            {
              type: 'uploadLoader',
              props: {
                information: t('Analyzing file...'),
                type: 'loading',
                blockUploadName,
                blockUploadType,
                blockUploadUrl,
                blockUploadShowPreview,
              },
            },
          ],
        );
      } catch (error) {
        captureException(error, {
          extra: { info: 'Error replacing block for upload loader' },
        });
      }
    },
    [editor, t],
  );

  useEffect(() => {
    // Check if editor and its view are mounted before accessing document
    if (!editor?.document) {
      return;
    }

    const imagesBlocks = editor.document.filter(
      (block) =>
        block.type === 'image' && block.props.url.includes(ANALYZE_URL),
    );

    imagesBlocks.forEach((block) => {
      replaceBlockWithUploadLoader(block as Block);
    });
  }, [editor, replaceBlockWithUploadLoader]);

  /**
   * Handle upload end to replace the upload block by a uploadLoader
   * block to show analyzing status
   */
  useEffect(() => {
    // Check if editor and its view are mounted before setting up handlers
    if (!editor) {
      return;
    }

    editor.onUploadEnd((blockId) => {
      if (!blockId) {
        return;
      }

      const innerTimeoutId = setTimeout(() => {
        const block = editor.getBlock({ id: blockId });

        replaceBlockWithUploadLoader(block as Block);
      }, 300);

      return () => {
        clearTimeout(innerTimeoutId);
      };
    });
  }, [editor, replaceBlockWithUploadLoader]);
};
