import { useEffect, useState } from 'react';

import { getEncryptionDB } from '../encryptionDB';

export type EncryptionError =
  | 'missing_private_key'
  | 'missing_public_key'
  | null;

export function useEncryption(
  userId?: string,
  refreshTrigger?: number,
): {
  encryptionLoading: boolean;
  encryptionSettings: {
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null;
  encryptionError: EncryptionError;
} {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null>(null);
  const [error, setError] = useState<EncryptionError>(null);

  const enableEncryption: boolean = true; // TODO: this could be toggled for instances not needing encryption to save some requests

  useEffect(() => {
    let cancelled = false;

    async function initEncryption() {
      // Waiting for asynchronous data before initializing encryption stuff
      if (!userId) {
        setLoading(true);
        setSettings(null);
        setError(null);
        return;
      } else if (enableEncryption === false) {
        setLoading(false);
        setSettings(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // We must first retrieve user keys locally
        const encryptionDatabase = await getEncryptionDB();

        const userPrivateKey = await encryptionDatabase.get(
          'privateKey',
          `user:${userId}`,
        );

        if (!userPrivateKey) {
          if (!cancelled) {
            setError('missing_private_key');
            setSettings(null);
          }
          return;
        }

        const userPublicKey = await encryptionDatabase.get(
          'publicKey',
          `user:${userId}`,
        );

        if (!userPublicKey) {
          if (!cancelled) {
            setError('missing_public_key');
            setSettings(null);
          }
          return;
        }

        if (!cancelled) {
          setSettings({
            userId: userId,
            userPrivateKey: userPrivateKey,
            userPublicKey: userPublicKey,
          });
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setSettings(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initEncryption();

    return () => {
      cancelled = true;
    };
  }, [userId, enableEncryption, refreshTrigger]);

  return {
    encryptionLoading: loading,
    encryptionSettings: settings,
    encryptionError: error,
  };
}
