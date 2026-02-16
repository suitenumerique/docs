import { useEffect, useState } from 'react';

import { decryptSymmetricKey } from '@/docs/doc-collaboration/encryption';

export function useDocumentEncryption(
  encryptionLoading: boolean,
  encryptionSettings: {
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null,
  userEncryptedSymmetricKey: string | undefined,
): {
  documentEncryptionLoading: boolean;
  documentEncryptionSettings: {
    documentSymmetricKey: CryptoKey;
  } | null;
} {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    documentSymmetricKey: CryptoKey;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initDocumentEncryption() {
      // Waiting for global encryption settings to be ready, or for asynchronous document data to be fetch
      if (encryptionLoading || !userEncryptedSymmetricKey) {
        setLoading(true);
        setSettings(null);
        return;
      } else if (!encryptionLoading && !encryptionSettings) {
        setLoading(false);
        setSettings(null);
        return;
      }

      try {
        setLoading(true);

        // TODO: maybe the backend field should be another type or encoded as base64
        const userEncryptedSymmetricKeyArrayBuffer = Buffer.from(
          userEncryptedSymmetricKey,
          // 'base64'
        );

        const symmetricKey = await decryptSymmetricKey(
          userEncryptedSymmetricKeyArrayBuffer.buffer,
          encryptionSettings!.userPrivateKey,
        );

        if (!cancelled) {
          setSettings({ documentSymmetricKey: symmetricKey });
        }
      } catch (err) {
        console.error(err);

        //
        // TODO: this should display a global error since if encryption needed it should able
        // to retrieve information (except if onboarding needed, but still...)
        //
        // maybe this should be a return value so the parent knows where to set the CTA
        //

        if (!cancelled) {
          setSettings(null);
        }
      } finally {
        setLoading(false);
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
  };
}
