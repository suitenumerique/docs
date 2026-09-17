import { Block } from '@blocknote/core';
import { captureException } from '@sentry/nextjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError, backendUrl } from '@/api';
import { useConfig } from '@/core';
import { isSafeUrl } from '@/utils/url';

import { useCreateDocAttachment } from '../api';
import { ANALYZE_URL } from '../conf';
import { DocsBlockNoteEditor } from '../types';

export const useUploadFile = (docId: string) => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const [sizeError, setSizeError] = useState<APIError | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const {
    mutateAsync: createDocAttachment,
    isError: isErrorAttachment,
    error: errorAttachment,
  } = useCreateDocAttachment();

  const maxSize = config?.DOCUMENT_IMAGE_MAX_SIZE ?? 10 * 1024 * 1024; // Default to 10MB if config isn't provided by the backend.

  const buildAndReportSizeError = useCallback((): APIError => {
    const error = new APIError(t('File is too large'), {
      status: 413,
      cause: [
        t('File size exceeds the maximum allowed size of {{size}}MB.', {
          size: Math.round(maxSize / (1024 * 1024)),
        }),
      ],
    });
    setSizeError(error);
    setErrorKey((prev) => prev + 1);
    return error;
  }, [maxSize, t]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.size > maxSize) {
        throw buildAndReportSizeError();
      }

      setSizeError(null);
      const body = new FormData();
      body.append('file', file);

      const ret = await createDocAttachment({ docId, body });

      return `${backendUrl()}${ret.file}`;
    },
    [buildAndReportSizeError, createDocAttachment, docId, maxSize],
  );

  return {
    uploadFile,
    isErrorAttachment: isErrorAttachment || !!sizeError,
    errorAttachment: sizeError ?? errorAttachment,
    errorKey,
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
   * block to show analyzing status.
   *
   * A Map keyed by blockId tracks the pending 300 ms cleanup timeout so that:
   * - onUploadStart: cancels any earlier cleanup scheduled for the same block,
   *   preventing a stale timeout from removing a block whose retry is in flight.
   * - onUploadEnd: replaces any earlier timeout with a fresh one (handles rapid
   *   successive failures), then either removes the URL-less block (failed) or
   *   replaces it with the uploadLoader (success).
   */
  const pendingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    // Check if editor and its view are mounted before setting up handlers
    if (!editor) {
      return;
    }

    const cancelPending = (blockId: string) => {
      const existing = pendingTimeouts.current.get(blockId);
      if (existing !== undefined) {
        clearTimeout(existing);
        pendingTimeouts.current.delete(blockId);
      }
    };

    const unsubscribeStart = editor.onUploadStart((blockId) => {
      if (!blockId) {
        return;
      }
      // A new upload attempt has started for this block — cancel any scheduled
      // cleanup from a previous failed attempt so it cannot remove an active retry.
      cancelPending(blockId);
    });

    const unsubscribeEnd = editor.onUploadEnd((blockId) => {
      if (!blockId) {
        return;
      }

      // Cancel any earlier pending cleanup for this block before scheduling a
      // new one (e.g. rapid successive failures for the same blockId).
      cancelPending(blockId);

      const timeoutId = setTimeout(() => {
        pendingTimeouts.current.delete(blockId);

        const block = editor.getBlock({ id: blockId });

        // onUploadEnd fires whether uploadFile resolved or threw (BlockNote calls
        // it in a finally-like manner). At that moment, BlockNote may not have
        // had time to update the block URL yet, so we wait 300ms. After this
        // delay:
        //   - Upload succeeded → BlockNote has updated the block URL to the final
        //     ANALYZE_URL returned by uploadFile.
        //   - Upload failed → uploadFile threw before returning a URL. BlockNote
        //     never received a URL, so the block URL is still the empty string
        //     it was initialised with.
        //
        // An empty URL at this checkpoint therefore unambiguously indicates a
        // failed upload. We remove the block to avoid leaving a stuck
        // "Loading..." block in the editor.
        if (block && 'url' in block.props && !block.props.url) {
          try {
            editor.removeBlocks([blockId]);
          } catch (error) {
            captureException(error, {
              extra: { info: 'Error removing block after failed upload' },
            });
          }
          return;
        }

        replaceBlockWithUploadLoader(block as Block);
      }, 300);

      pendingTimeouts.current.set(blockId, timeoutId);
    });

    const timeouts = pendingTimeouts.current;
    return () => {
      unsubscribeStart();
      unsubscribeEnd();
      for (const timeoutId of timeouts.values()) {
        clearTimeout(timeoutId);
      }
      timeouts.clear();
    };
  }, [editor, replaceBlockWithUploadLoader]);
};
