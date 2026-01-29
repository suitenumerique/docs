import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { useCallback } from 'react';

import { useBroadcastStore } from '@/stores';

import { KEY_DOC, KEY_LIST_DOC, useUpdateDoc } from '../api';
import { Doc } from '../types';
import { getEmojiAndTitle } from '../utils';

interface UseDocUpdateOptions {
  onSuccess?: (updatedDoc: Doc) => void;
  onError?: (error: Error) => void;
}

export const useDocTitleUpdate = (options?: UseDocUpdateOptions) => {
  const { broadcast } = useBroadcastStore();
  const treeContext = useTreeContext<Doc>();

  const { mutate: updateDoc, ...mutationResult } = useUpdateDoc({
    listInvalidQueries: [KEY_DOC, KEY_LIST_DOC],
    onSuccess: (updatedDoc) => {
      // Broadcast to every user connected to the document
      broadcast(`${KEY_DOC}-${updatedDoc.id}`);

      if (treeContext) {
        if (treeContext.root?.id === updatedDoc.id) {
          treeContext?.setRoot(updatedDoc);
        } else {
          treeContext?.treeData.updateNode(updatedDoc.id, updatedDoc);
        }
      }

      options?.onSuccess?.(updatedDoc);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });

  const updateDocTitle = useCallback(
    (doc: Doc, title: string) => {
      const sanitizedTitle = title.trim().replace(/(\r\n|\n|\r)/gm, '');

      // When blank we set to untitled
      if (!sanitizedTitle) {
        updateDoc({ id: doc.id, title: '' });
        return '';
      }

      // If mutation we update
      if (sanitizedTitle !== doc.title) {
        updateDoc({ id: doc.id, title: sanitizedTitle });
      }

      return sanitizedTitle;
    },
    [updateDoc],
  );

  const updateDocEmoji = useCallback(
    (docId: string, title: string, emoji: string) => {
      const { titleWithoutEmoji } = getEmojiAndTitle(title);
      updateDoc({ id: docId, title: `${emoji} ${titleWithoutEmoji}` });
    },
    [updateDoc],
  );

  return {
    ...mutationResult,
    updateDocTitle,
    updateDocEmoji,
  };
};
