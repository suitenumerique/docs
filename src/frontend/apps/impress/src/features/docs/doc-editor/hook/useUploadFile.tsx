import { Block } from '@blocknote/core';
import { captureException } from '@sentry/nextjs';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { backendUrl } from '@/api';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { isSafeUrl } from '@/utils/url';

import { useCreateDocAttachment } from '../api';
import { ANALYZE_URL } from '../conf';
import { DocsBlockNoteEditor } from '../types';

export const useUploadFile = (
  docId: string,
  encryptedSymmetricKey?: ArrayBuffer,
) => {
  const {
    mutateAsync: createDocAttachment,
    isError: isErrorAttachment,
    error: errorAttachment,
  } = useCreateDocAttachment();
  const { client: vaultClient } = useVaultClient();

  const uploadFile = useCallback(
    async (file: File) => {
      const body = new FormData();

      if (encryptedSymmetricKey && vaultClient) {
        // Encrypt the file via vault — pure ArrayBuffer
        const fileBuffer = await file.arrayBuffer();
        const { encryptedData } = await vaultClient.encryptWithKey(
          fileBuffer,
          encryptedSymmetricKey,
        );

        const encryptedFile = new File([encryptedData], file.name, {
          type: 'application/octet-stream',
        });
        body.append('file', encryptedFile);
        body.append('is_encrypted', 'true');
      } else {
        body.append('file', file);
      }

      const ret = await createDocAttachment({
        docId,
        body,
      });

      return `${backendUrl()}${ret.file}`;
    },
    [createDocAttachment, docId, encryptedSymmetricKey, vaultClient],
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
 */
export const useUploadStatus = (editor: DocsBlockNoteEditor) => {
  const { t } = useTranslation();

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

  useEffect(() => {
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
