import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { backendUrl } from '@/api';
import { useMediaUrl } from '@/core/config';
import { sleep } from '@/utils';

import { checkDocMediaStatus, useCreateDocAttachment } from '../api';
import { DocsBlockNoteEditor } from '../types';

/**
 * Upload file can be analyzed on the server side,
 * we had this function to wait for the analysis to be done
 * before returning the file url. It will keep the loader
 * on the upload button until the analysis is done.
 * @param url
 * @returns Promise<CheckDocMediaStatusResponse> status_code
 * @description Waits for the upload to be analyzed by checking the status of the file.
 */
const loopCheckDocMediaStatus = async (url: string) => {
  const SLEEP_TIME = 5000;
  const response = await checkDocMediaStatus({
    urlMedia: url,
  });

  if (response.status === 'ready') {
    return response;
  } else {
    await sleep(SLEEP_TIME);
    return await loopCheckDocMediaStatus(url);
  }
};

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

export const useUploadStatus = (editor: DocsBlockNoteEditor) => {
  const ANALYZE_URL = 'media-check';
  const { t } = useTranslation();
  const mediaUrl = useMediaUrl();
  const timeoutIds = useRef<Record<string, NodeJS.Timeout>>({});

  const blockAnalyzeProcess = useCallback(
    (editor: DocsBlockNoteEditor, blockId: string, url: string) => {
      if (timeoutIds.current[url]) {
        clearTimeout(timeoutIds.current[url]);
      }

      // Delay to let the time to the dom to be rendered
      const timoutId = setTimeout(() => {
        // Replace the resource block by a loading block
        const { insertedBlocks, removedBlocks } = editor.replaceBlocks(
          [blockId],
          [
            {
              type: 'uploadLoader',
              props: {
                information: t('Analyzing file...'),
                type: 'loading',
              },
            },
          ],
        );

        loopCheckDocMediaStatus(url)
          .then((response) => {
            if (insertedBlocks.length === 0 || removedBlocks.length === 0) {
              return;
            }

            const loadingBlockId = insertedBlocks[0].id;
            const removedBlock = removedBlocks[0];

            removedBlock.props = {
              ...removedBlock.props,
              url: `${mediaUrl}${response.file}`,
            };

            // Replace the loading block with the resource block (image, audio, video, pdf ...)
            editor.replaceBlocks([loadingBlockId], [removedBlock]);
          })
          .catch((error) => {
            console.error('Error analyzing file:', error);

            const loadingBlock = insertedBlocks[0];

            if (!loadingBlock) {
              return;
            }

            loadingBlock.props = {
              ...loadingBlock.props,
              type: 'warning',
              information: t(
                'The antivirus has detected an anomaly in your file.',
              ),
            };

            editor.updateBlock(loadingBlock.id, loadingBlock);
          });
      }, 250);

      timeoutIds.current[url] = timoutId;
    },
    [t, mediaUrl],
  );

  useEffect(() => {
    const blocksAnalyze = editor?.document.filter(
      (block) => 'url' in block.props && block.props.url.includes(ANALYZE_URL),
    );

    if (!blocksAnalyze?.length) {
      return;
    }

    blocksAnalyze.forEach((block) => {
      if (!('url' in block.props)) {
        return;
      }

      blockAnalyzeProcess(editor, block.id, block.props.url);
    });
  }, [blockAnalyzeProcess, editor]);

  useEffect(() => {
    editor.onChange((_, context) => {
      const blocksChanges = context.getChanges();

      if (!blocksChanges.length) {
        return;
      }

      const blockChanges = blocksChanges[0];

      if (
        blockChanges.source.type !== 'local' ||
        blockChanges.type !== 'update' ||
        !('url' in blockChanges.block.props) ||
        ('url' in blockChanges.block.props &&
          !blockChanges.block.props.url.includes(ANALYZE_URL))
      ) {
        return;
      }

      blockAnalyzeProcess(
        editor,
        blockChanges.block.id,
        blockChanges.block.props.url,
      );
    });
  }, [blockAnalyzeProcess, mediaUrl, editor, t]);
};
