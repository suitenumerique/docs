import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';

import { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import { useProviderStore, useUpdateDoc } from '@/docs/doc-management/';
import { KEY_LIST_DOC_VERSIONS } from '@/docs/doc-versioning';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { isFirefox } from '@/utils/userAgent';

import { toBase64 } from '../utils';

const SAVE_INTERVAL = 60000;

export const useSaveDoc = (
  docId: string,
  yDoc: Y.Doc,
  isConnectedToCollabServer: boolean,
  isEncrypted: boolean,
  documentEncryptionSettings: DocumentEncryptionSettings | null,
) => {
  const { encryptionTransition } = useProviderStore();
  const { client: vaultClient } = useVaultClient();
  const { mutate: updateDoc } = useUpdateDoc({
    listInvalidQueries: [KEY_LIST_DOC_VERSIONS],
    onSuccess: () => {
      setIsLocalChange(false);
    },
  });
  const [isLocalChange, setIsLocalChange] = useState<boolean>(false);

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
    } else if (encryptionTransition) {
      return false;
    } else if (isEncrypted && (!documentEncryptionSettings || !vaultClient)) {
      return false;
    }

    const state = Y.encodeStateAsUpdate(yDoc);

    if (isEncrypted && documentEncryptionSettings && vaultClient) {
      // Encrypt via vault with ArrayBuffer — zero-copy
      vaultClient
        .encryptWithKey(
          state.buffer as ArrayBuffer,
          documentEncryptionSettings.encryptedSymmetricKey,
        )
        .then(({ encryptedData }) => {
          updateDoc({
            id: docId,
            content: toBase64(new Uint8Array(encryptedData)),
            contentEncrypted: true,
            websocket: isConnectedToCollabServer,
          });
        })
        .catch((err) => {
          console.error('Failed to encrypt document for save:', err);
        });
    } else {
      updateDoc({
        id: docId,
        content: toBase64(state),
        contentEncrypted: false,
        websocket: isConnectedToCollabServer,
      });
    }

    return true;
  }, [
    isLocalChange,
    encryptionTransition,
    updateDoc,
    docId,
    yDoc,
    isConnectedToCollabServer,
    isEncrypted,
    documentEncryptionSettings,
    vaultClient,
  ]);

  const router = useRouter();

  useEffect(() => {
    const onSave = (e?: Event) => {
      const isSaving = saveDoc();

      if (
        isSaving &&
        typeof e !== 'undefined' &&
        e.preventDefault &&
        isFirefox()
      ) {
        e.preventDefault();
      }
    };

    const timeout = setInterval(onSave, SAVE_INTERVAL);
    addEventListener('beforeunload', onSave);
    router.events.on('routeChangeStart', onSave);

    return () => {
      clearInterval(timeout);
      removeEventListener('beforeunload', onSave);
      router.events.off('routeChangeStart', onSave);
    };
  }, [router.events, saveDoc]);
};
