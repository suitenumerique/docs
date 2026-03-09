import { useEffect, useState } from 'react';

import { decryptSymmetricKey } from '@/docs/doc-collaboration/encryption';

import { useUserEncryption } from '../UserEncryptionProvider';

export type DocumentEncryptionError =
  | 'missing_symmetric_key'
  | 'decryption_failed'
  | null;

export function useDocumentEncryption(
  isDocumentEncrypted: boolean | undefined,
  userEncryptedSymmetricKey: string | undefined,
): {
  documentEncryptionLoading: boolean;
  documentEncryptionSettings: {
    documentSymmetricKey: CryptoKey;
  } | null;
  documentEncryptionError: DocumentEncryptionError;
} {
  const { encryptionLoading, encryptionSettings } = useUserEncryption();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    documentSymmetricKey: CryptoKey;
  } | null>(null);
  const [error, setError] = useState<DocumentEncryptionError>(null);

  useEffect(() => {
    let cancelled = false;

    async function initDocumentEncryption() {
      // Waiting for global encryption settings to be ready, or for asynchronous document data to be fetch
      if (!encryptionLoading && !encryptionSettings) {
        setLoading(false);
        setSettings(null);
        return;
      } else if (encryptionLoading || isDocumentEncrypted === undefined) {
        setLoading(true);
        setSettings(null);
        setError(null);
        return;
      } else if (isDocumentEncrypted === false) {
        setLoading(false);
        setSettings(null);
        setError(null);
        return;
      }

      if (!userEncryptedSymmetricKey) {
        if (!cancelled) {
          setError('missing_symmetric_key');
          setSettings(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const userEncryptedSymmetricKeyArrayBuffer = Buffer.from(
          userEncryptedSymmetricKey,
          'base64',
        );

        const symmetricKey = await decryptSymmetricKey(
          userEncryptedSymmetricKeyArrayBuffer.buffer,
          encryptionSettings!.userPrivateKey,
        );

        if (!cancelled) {
          setSettings({ documentSymmetricKey: symmetricKey });
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setError('decryption_failed');
          setSettings(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initDocumentEncryption();

    return () => {
      cancelled = true;
    };
  }, [encryptionLoading, encryptionSettings, userEncryptedSymmetricKey]);

  return {
    documentEncryptionLoading: loading,
    documentEncryptionSettings: settings,
    documentEncryptionError: error,
  };
}
