/**
 * Hook to manage document-level encryption state.
 *
 * Stores the user's encrypted symmetric key as an ArrayBuffer.
 * Components pass this to VaultClient.encryptWithKey() / decryptWithKey()
 * for all crypto operations. The vault decrypts the symmetric key internally
 * using the user's private key (with session caching for performance).
 */
import { useEffect, useMemo, useState } from 'react';

import { useUserEncryption } from '../UserEncryptionProvider';

export type DocumentEncryptionError =
  | 'missing_symmetric_key'
  | 'decryption_failed'
  | null;

export interface DocumentEncryptionSettings {
  /**
   * The user's encrypted symmetric key as ArrayBuffer.
   * Pass this to VaultClient.encryptWithKey() / decryptWithKey().
   */
  encryptedSymmetricKey: ArrayBuffer;
  /**
   * The current user's encryption-key VERSION this wrapped symmetric key was
   * produced against (the share-time version stored per access). Passed as the
   * `keyVersion` argument to VaultClient.decryptWithKey() so the vault selects
   * the matching private key. Same source KeyMismatchPanel reads:
   * `doc.accesses_versions_per_user[user.suite_user_id]`.
   */
  keyVersion: number;
}

/** Convert a base64 string to ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export function useDocumentEncryption(
  isDocumentEncrypted: boolean | undefined,
  userEncryptedSymmetricKeyBase64: string | undefined,
  keyVersion: number | undefined,
): {
  documentEncryptionLoading: boolean;
  documentEncryptionSettings: DocumentEncryptionSettings | null;
  documentEncryptionError: DocumentEncryptionError;
} {
  const { encryptionLoading, encryptionSettings } = useUserEncryption();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DocumentEncryptionError>(null);

  // Convert the base64 key from the API to ArrayBuffer (memoized)
  const encryptedSymmetricKey = useMemo(() => {
    if (!userEncryptedSymmetricKeyBase64) {
      return null;
    }

    try {
      return base64ToArrayBuffer(userEncryptedSymmetricKeyBase64);
    } catch {
      return null;
    }
  }, [userEncryptedSymmetricKeyBase64]);

  const settings = useMemo<DocumentEncryptionSettings | null>(() => {
    if (!encryptedSymmetricKey) {
      return null;
    }

    return {
      encryptedSymmetricKey,
      keyVersion: keyVersion ?? 1,
    };
  }, [encryptedSymmetricKey, keyVersion]);

  useEffect(() => {
    if (!encryptionLoading && !encryptionSettings) {
      setLoading(false);

      return;
    }

    if (encryptionLoading || isDocumentEncrypted === undefined) {
      setLoading(true);
      setError(null);

      return;
    }

    if (isDocumentEncrypted === false) {
      setLoading(false);
      setError(null);

      return;
    }

    if (!encryptedSymmetricKey) {
      setError('missing_symmetric_key');
      setLoading(false);

      return;
    }

    setError(null);
    setLoading(false);
  }, [
    encryptionLoading,
    encryptionSettings,
    isDocumentEncrypted,
    encryptedSymmetricKey,
  ]);

  return {
    documentEncryptionLoading: loading,
    documentEncryptionSettings: error ? null : settings,
    documentEncryptionError: error,
  };
}
