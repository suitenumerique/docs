import { openDB } from 'idb';
import { useEffect, useState } from 'react';

export function useEncryption(
  userId?: string,
  enableEncryption?: boolean,
): {
  encryptionLoading: boolean;
  encryptionSettings: {
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null;
} {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initEncryption() {
      // Waiting for asynchronous data before initializing encryption stuff
      if (!userId || enableEncryption === undefined) {
        setLoading(true);
        setSettings(null);
        return;
      }

      if (enableEncryption === false) {
        setLoading(false);
        setSettings(null);
        return;
      }

      try {
        setLoading(true);

        // We must first retrieve user keys locally
        const encryptionDatabase = await openDB('encryption');

        const userPrivateKey = await encryptionDatabase.get(
          'privateKey',
          `user:${userId}`,
        );

        if (!userPrivateKey) {
          throw new Error('user has no local private key (needs onboarding)');
        }

        const userPublicKey = await encryptionDatabase.get(
          'publicKey',
          `user:${userId}`,
        );

        if (!userPublicKey) {
          throw new Error('user is missing his public key');
        }

        if (!cancelled) {
          setSettings({ userPrivateKey, userPublicKey });
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

    initEncryption();

    return () => {
      cancelled = true;
    };
  }, [userId, enableEncryption]);

  return { encryptionLoading: loading, encryptionSettings: settings };
}
