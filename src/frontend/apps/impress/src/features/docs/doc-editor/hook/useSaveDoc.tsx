import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';

import { useUpdateDoc } from '@/docs/doc-management/';
import { KEY_LIST_DOC_VERSIONS } from '@/docs/doc-versioning';

import { toBase64 } from '../utils';

const SAVE_INTERVAL = 60000;

export const useSaveDoc = (
  docId: string,
  yDoc: Y.Doc,
  isConnectedToCollabServer: boolean,
) => {
  const { mutate: updateDoc } = useUpdateDoc({
    listInvalidQueries: [KEY_LIST_DOC_VERSIONS],
    onSuccess: () => {
      setIsLocalChange(false);
    },
  });
  const [isLocalChange, setIsLocalChange] = useState<boolean>(false);

  /**
   * Update initial doc when doc is updated by other users,
   * so only the user typing will trigger the save.
   * This is to avoid saving the same doc multiple time.
   */
  useEffect(() => {
    const onUpdate = (
      _uintArray: Uint8Array,
      _pluginKey: string,
      _updatedDoc: Y.Doc,
      transaction: Y.Transaction,
    ) => {
      setIsLocalChange(transaction.local);
    };

    yDoc.on('update', onUpdate);

    return () => {
      yDoc.off('update', onUpdate);
    };
  }, [yDoc]);

  const saveDoc = useCallback(() => {
    if (!isLocalChange) {
      return false;
    }

    updateDoc({
      id: docId,
      content: toBase64(Y.encodeStateAsUpdate(yDoc)),
      websocket: isConnectedToCollabServer,
    });

    return true;
  }, [isLocalChange, updateDoc, docId, yDoc, isConnectedToCollabServer]);

  const router = useRouter();

  useEffect(() => {
    const onSave = () => {
      saveDoc();
    };

    // Save every minute
    const timeout = setInterval(onSave, SAVE_INTERVAL);
    // Save when the user leaves the page
    addEventListener('beforeunload', onSave);
    // Save when the user navigates to another page
    router.events.on('routeChangeStart', onSave);

    return () => {
      clearInterval(timeout);

      removeEventListener('beforeunload', onSave);
      router.events.off('routeChangeStart', onSave);
    };
  }, [router.events, saveDoc]);
};
