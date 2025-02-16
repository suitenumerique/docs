import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

import { toBase64, useUpdateDoc } from '@/features/docs/doc-management/';
import { KEY_LIST_DOC_VERSIONS } from '@/features/docs/doc-versioning';
import { isFirefox } from '@/utils/userAgent';

const useSaveDoc = (docId: string, doc: Y.Doc, canSave: boolean) => {
  const { mutate: updateDoc } = useUpdateDoc({
    listInvalideQueries: [KEY_LIST_DOC_VERSIONS],
  });
  const [initialDoc, setInitialDoc] = useState<string>(
    toBase64(Y.encodeStateAsUpdate(doc)),
  );

  useEffect(() => {
    setInitialDoc(toBase64(Y.encodeStateAsUpdate(doc)));
  }, [doc]);

  /**
   * Update initial doc when doc is updated by other users,
   * so only the user typing will trigger the save.
   * This is to avoid saving the same doc multiple time.
   */
  useEffect(() => {
    const onUpdate = (
      _uintArray: Uint8Array,
      _pluginKey: string,
      updatedDoc: Y.Doc,
      transaction: Y.Transaction,
    ) => {
      if (!transaction.local) {
        setInitialDoc(toBase64(Y.encodeStateAsUpdate(updatedDoc)));
      }
    };

    doc.on('update', onUpdate);

    return () => {
      doc.off('update', onUpdate);
    };
  }, [doc]);

  /**
   * Check if the doc has been updated and can be saved.
   */
  const hasChanged = useCallback(() => {
    const newDoc = toBase64(Y.encodeStateAsUpdate(doc));
    return initialDoc !== newDoc;
  }, [doc, initialDoc]);

  const shouldSave = useCallback(() => {
    return hasChanged() && canSave;
  }, [canSave, hasChanged]);

  const saveDoc = useCallback(() => {
    const newDoc = toBase64(Y.encodeStateAsUpdate(doc));
    setInitialDoc(newDoc);

    updateDoc({
      id: docId,
      content: newDoc,
    });
  }, [doc, docId, updateDoc]);

  const timeout = useRef<NodeJS.Timeout>();
  const router = useRouter();

  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    const onSave = (e?: Event) => {
      if (!shouldSave()) {
        return;
      }

      saveDoc();

      /**
       * Firefox does not trigger the request everytime the user leaves the page.
       * Plus the request is not intercepted by the service worker.
       * So we prevent the default behavior to have the popup asking the user
       * if he wants to leave the page, by adding the popup, we let the time to the
       * request to be sent, and intercepted by the service worker (for the offline part).
       */
      if (typeof e !== 'undefined' && e.preventDefault && isFirefox()) {
        e.preventDefault();
      }
    };

    // Save every minute
    timeout.current = setInterval(onSave, 60000);
    // Save when the user leaves the page
    addEventListener('beforeunload', onSave);
    // Save when the user navigates to another page
    router.events.on('routeChangeStart', onSave);

    return () => {
      clearTimeout(timeout.current);
      removeEventListener('beforeunload', onSave);
      router.events.off('routeChangeStart', onSave);
    };
  }, [router.events, saveDoc, shouldSave]);
};

export default useSaveDoc;
