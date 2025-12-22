import { Block } from '@blocknote/core';
import { captureException } from '@sentry/nextjs';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { backendUrl } from '@/api';

import { useCreateDocAttachment } from '../api';
import { ANALYZE_URL } from '../conf';
import { DocsBlockNoteEditor } from '../types';

export const useUploadFile = (docId: string) => {
  const {
    mutateAsync: createDocAttachment,
    isError: isErrorAttachment,
    error: errorAttachment,
  } = useCreateDocAttachment();

  const uploadFile = useCallback(
    async (file: File) => {
      const body = new FormData();
      body.append('file', file);

      const ret = await createDocAttachment({
        docId,
        body,
      });

      return `${backendUrl()}${ret.file}`;
    },
    [createDocAttachment, docId],
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
        ('url' in block.props && !block.props.url.includes(ANALYZE_URL))
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
