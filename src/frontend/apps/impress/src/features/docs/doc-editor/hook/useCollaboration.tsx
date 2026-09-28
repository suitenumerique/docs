import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useCollaborationUrl, useConfig } from '@/core/config';
import { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import { useVaultClient } from '@/docs/doc-collaboration/vault';
import { KEY_DOC } from '@/docs/doc-management/api/useDoc';
import {
  KEY_DOC_CONTENT,
  useDocContent,
} from '@/docs/doc-management/api/useDocContent';
import {
  decryptionFailureOf,
  useProviderStore,
} from '@/docs/doc-management/stores/useProviderStore';
import { useAuth } from '@/features/auth';
import { useIsOffline } from '@/features/service-worker/hooks/useOffline';
import { useBroadcastStore } from '@/stores/useBroadcastStore';

/**
 * `room` stays undefined until the document is loaded, and `isEncrypted`
 * until its encryption state is known: nothing is fetched before.
 */
export const useCollaboration = (
  room: string | undefined,
  isEncrypted: boolean | undefined,
  documentEncryptionSettings: DocumentEncryptionSettings | null,
) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { addTask } = useBroadcastStore();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { user } = useAuth();
  const { client: vaultClient } = useVaultClient();
  const {
    setBroadcastProvider,
    cleanupBroadcast,
    provider: broadcastProvider,
  } = useBroadcastStore();
  const {
    provider,
    createProvider,
    destroyProvider,
    setReady,
    isReady,
    hasLostConnection,
    resetLostConnection,
    pauseForInactivity,
    resumeFromInactivity,
    encryptionTransition,
    setDecryptionFailure,
  } = useProviderStore();
  const isOffline = useIsOffline((state) => state.isOffline);
  const { data: docContent } = useDocContent(
    { id: room ?? '' },
    {
      staleTime: 30000, // 30 seconds - We keep the data fresh as it is a highly collaborative page
      queryKey: [KEY_DOC_CONTENT, { id: room }],
      // During an encryption transition the stored content switches between
      // clear and encrypted: it is fetched again once the transition is over
      enabled: !!room && isEncrypted !== undefined && !encryptionTransition,
    },
  );

  /**
   * When offline, the WebSocket never connects so the provider would stay
   * in a non-ready state for a long time. Immediately mark it as ready so
   * the editor can render with the cached content.
   */
  useEffect(() => {
    if (isOffline && provider && !isReady) {
      setReady(true);
    }
  }, [isOffline, isReady, provider, setReady]);

  /**
   * When the provider detects a lost connection, we invalidate the document query to trigger a refetch.
   * Because it can be because the user has access to the document that are modified
   * (e.g., permissions changed, document deleted, user removed)
   */
  useEffect(() => {
    if (hasLostConnection && room) {
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: room }],
      });
      resetLostConnection();
    }
  }, [hasLostConnection, room, queryClient, resetLostConnection]);

  /**
   * We add a broadcast task to reset the query cache
   * when the document visibility changes.
   */
  useEffect(() => {
    if (!room || broadcastProvider?.document?.guid !== room) {
      return;
    }

    addTask(`${KEY_DOC}-${room}`, () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: room }],
      });
    });
  }, [addTask, room, queryClient, broadcastProvider?.document?.guid]);

  /**
   * Set the provider when the collaboration URL and the document content are available,
   * after decrypting the content for an encrypted document.
   */
  useEffect(() => {
    if (
      !room ||
      !collaborationUrl ||
      provider ||
      encryptionTransition ||
      docContent === undefined ||
      isEncrypted === undefined ||
      (isEncrypted && (!user || !documentEncryptionSettings || !vaultClient))
    ) {
      return;
    }

    const initialDocState = docContent
      ? Buffer.from(docContent, 'base64')
      : undefined;

    if (!isEncrypted || !documentEncryptionSettings || !vaultClient) {
      const newProvider = createProvider(
        collaborationUrl,
        room,
        initialDocState,
      );
      setBroadcastProvider(newProvider);
      return;
    }

    // The effect can run again while the vault decrypts: only the latest run
    // creates the provider
    let isCancelled = false;

    (async () => {
      let decryptedState: Uint8Array | undefined;

      if (initialDocState) {
        const { data: decryptedBuffer } = await vaultClient.decryptWithKey(
          initialDocState.buffer.slice(
            initialDocState.byteOffset,
            initialDocState.byteOffset + initialDocState.byteLength,
          ),
          documentEncryptionSettings.encryptedSymmetricKey,
          documentEncryptionSettings.keyVersion,
        );

        decryptedState = new Uint8Array(decryptedBuffer);
      }

      if (isCancelled) {
        return;
      }

      const newProvider = createProvider(
        collaborationUrl,
        room,
        decryptedState,
        {
          vaultClient,
          encryptedSymmetricKey:
            documentEncryptionSettings.encryptedSymmetricKey,
          keyVersion: documentEncryptionSettings.keyVersion,
        },
      );

      setBroadcastProvider(newProvider);
    })().catch((err) => {
      if (isCancelled) {
        return;
      }

      console.error('Failed to decrypt document content:', err);
      setDecryptionFailure(decryptionFailureOf(err));
    });

    return () => {
      isCancelled = true;
    };
  }, [
    provider,
    collaborationUrl,
    createProvider,
    docContent,
    room,
    setBroadcastProvider,
    user,
    isEncrypted,
    documentEncryptionSettings,
    vaultClient,
    encryptionTransition,
    setDecryptionFailure,
  ]);

  /**
   * Destroy the provider when the component is unmounted
   */
  useEffect(() => {
    return () => {
      if (room) {
        cleanupBroadcast();
        destroyProvider();
      }
    };
  }, [destroyProvider, room, cleanupBroadcast]);

  useEffect(() => {
    if (!provider || !config?.COLLABORATION_WS_INACTIVITY_TIMEOUT) {
      return;
    }

    const timeoutMs = config.COLLABORATION_WS_INACTIVITY_TIMEOUT * 1000;
    let inactivityTimeout: ReturnType<typeof setTimeout> | undefined;

    const startInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(pauseForInactivity, timeoutMs);
    };

    if (document.hidden) {
      startInactivityTimer();
    }

    const visibilityChangeHandler = () => {
      if (document.hidden) {
        startInactivityTimer();
      } else {
        clearTimeout(inactivityTimeout);
        resumeFromInactivity();
      }
    };

    document.addEventListener('visibilitychange', visibilityChangeHandler);

    return () => {
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      clearTimeout(inactivityTimeout);
    };
  }, [
    pauseForInactivity,
    provider,
    resumeFromInactivity,
    config?.COLLABORATION_WS_INACTIVITY_TIMEOUT,
  ]);
};
