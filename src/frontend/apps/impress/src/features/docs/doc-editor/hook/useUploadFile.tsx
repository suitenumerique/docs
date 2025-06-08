import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { backendUrl } from '@/api';
import { useMediaUrl } from '@/core/config';
import { sleep } from '@/utils';

import { checkDocMediaStatus, useCreateDocAttachment } from '../api';
import Loader from '../assets/loader.svg?url';
import Warning from '../assets/warning.svg?url';
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

const informationStatus = (src: string, text: string) => {
  const loadingContainer = document.createElement('div');
  loadingContainer.style.display = 'flex';
  loadingContainer.style.alignItems = 'center';
  loadingContainer.style.justifyContent = 'left';
  loadingContainer.style.padding = '10px';
  loadingContainer.style.color = '#666';
  loadingContainer.className =
    'bn-visual-media bn-audio bn-file-name-with-icon';

  // Create an image element for the SVG
  const imgElement = document.createElement('img');
  imgElement.src = src;

  // Create a text span
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  textSpan.style.marginLeft = '8px';
  textSpan.style.verticalAlign = 'middle';
  imgElement.style.animation = 'spin 1.5s linear infinite';

  // Add the spinner and text to the container
  loadingContainer.appendChild(imgElement);
  loadingContainer.appendChild(textSpan);

  return loadingContainer;
};

const replaceUploadContent = (blockId: string, elementReplace: HTMLElement) => {
  const blockEl = document.body.querySelector(
    `.bn-block[data-id="${blockId}"]`,
  );

  blockEl
    ?.querySelector('.bn-visual-media-wrapper .bn-visual-media')
    ?.replaceWith(elementReplace);

  blockEl
    ?.querySelector('.bn-file-block-content-wrapper .bn-audio')
    ?.replaceWith(elementReplace);

  blockEl
    ?.querySelector('.bn-file-block-content-wrapper .bn-file-name-with-icon')
    ?.replaceWith(elementReplace);
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
        replaceUploadContent(
          blockId,
          informationStatus(Loader.src, t('Analyzing file...')),
        );

        loopCheckDocMediaStatus(url)
          .then((response) => {
            const block = editor.getBlock(blockId);
            if (!block) {
              return;
            }

            block.props = {
              ...block.props,
              url: `${mediaUrl}${response.file}`,
            };

            editor.updateBlock(blockId, block);
          })
          .catch((error) => {
            console.error('Error analyzing file:', error);

            replaceUploadContent(
              blockId,
              informationStatus(
                Warning.src,
                t('The antivirus has detected an anomaly in your file.'),
              ),
            );
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
