import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';

import { useUpdateDoc } from '@/docs/doc-management/';
import { KEY_LIST_DOC_VERSIONS } from '@/docs/doc-versioning';
import { isFirefox } from '@/utils/userAgent';

import { toBase64 } from '../utils';

const SAVE_INTERVAL = 60000;

const useSaveDoc = (
  docId: string,
  yDoc: Y.Doc,
  canSave: boolean,
  isConnectedToCollabServer: boolean,
) => {
  const { mutate: updateDoc } = useUpdateDoc({
    listInvalideQueries: [KEY_LIST_DOC_VERSIONS],
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
    if (!canSave || !isLocalChange) {
      return false;
    }

    updateDoc({
      id: docId,
      content: toBase64(Y.encodeStateAsUpdate(yDoc)),
      websocket: isConnectedToCollabServer,
    });

    return true;
  }, [
    canSave,
    isLocalChange,
    updateDoc,
    docId,
    yDoc,
    isConnectedToCollabServer,
  ]);

  const router = useRouter();

  useEffect(() => {
    const onSave = (e?: Event) => {
      const isSaving = saveDoc();

      /**
       * Firefox does not trigger the request every time the user leaves the page.
       * Plus the request is not intercepted by the service worker.
       * So we prevent the default behavior to have the popup asking the user
       * if he wants to leave the page, by adding the popup, we let the time to the
       * request to be sent, and intercepted by the service worker (for the offline part).
       */
      if (
        isSaving &&
        typeof e !== 'undefined' &&
        e.preventDefault &&
        isFirefox()
      ) {
        e.preventDefault();
      }
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

export default useSaveDoc;
