import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { backendUrl } from '@/api';

import { useCreateDocAttachment } from '../api';
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

export const useUploadStatus = (editor: DocsBlockNoteEditor) => {
  const ANALYZE_URL = 'media-check';
  const { t } = useTranslation();

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

      const blockUploadUrl = blockChanges.block.props.url;
      const blockUploadType = blockChanges.block.type;
      const blockUploadName = blockChanges.block.props.name;
      const blockUploadShowPreview =
        ('showPreview' in blockChanges.block.props &&
          blockChanges.block.props.showPreview) ||
        false;

      const timeoutId = setTimeout(() => {
        // Replace the resource block by a uploadLoader block
        // to show analyzing status
        editor.replaceBlocks(
          [blockChanges.block.id],
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
      }, 250);

      return () => {
        clearTimeout(timeoutId);
      };
    });
  }, [editor, t]);
};
