/**
 * Encryption context for document content and file attachments.
 * Uses VaultClient SDK with ArrayBuffer for all decrypt operations.
 */
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
};

interface EncryptionContextValue {
  isEncrypted: boolean;
  decryptFileUrl: (url: string) => Promise<string>;
  revealAllCounter: number;
  requestRevealAll: () => void;
  pendingPlaceholders: number;
  registerPlaceholder: () => void;
  unregisterPlaceholder: () => void;
}

const noop = () => {};

const DEFAULT_VALUE: EncryptionContextValue = {
  isEncrypted: false,
  decryptFileUrl: async (url: string) => url,
  revealAllCounter: 0,
  requestRevealAll: noop,
  pendingPlaceholders: 0,
  registerPlaceholder: noop,
  unregisterPlaceholder: noop,
};

const EncryptionContext = createContext<EncryptionContextValue>(DEFAULT_VALUE);

interface EncryptionProviderProps {
  encryptedSymmetricKey: ArrayBuffer | undefined;
  keyVersion: number | undefined;
  children: ReactNode;
}

export const EncryptionProvider = ({
  encryptedSymmetricKey,
  keyVersion,
  children,
}: EncryptionProviderProps) => {
  const { client: vaultClient } = useVaultClient();
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const [revealAllCounter, setRevealAllCounter] = useState(0);
  const [pendingPlaceholders, setPendingPlaceholders] = useState(0);

  const requestRevealAll = useCallback(() => {
    setRevealAllCounter((c) => c + 1);
  }, []);

  const registerPlaceholder = useCallback(() => {
    setPendingPlaceholders((c) => c + 1);
  }, []);

  const unregisterPlaceholder = useCallback(() => {
    setPendingPlaceholders((c) => Math.max(0, c - 1));
  }, []);

  const decryptFileUrl = useCallback(
    async (url: string): Promise<string> => {
      if (!encryptedSymmetricKey || !vaultClient) {
        return url;
      }

      const cached = blobUrlCacheRef.current.get(url);

      if (cached) {
        return cached;
      }

      const response = await fetch(url, { credentials: 'include' });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch encrypted attachment: ${response.status}`,
        );
      }

      // Get file as ArrayBuffer directly — no base64 conversion
      const encryptedBuffer = await response.arrayBuffer();

      const { data: decryptedBuffer } = await vaultClient.decryptWithKey(
        encryptedBuffer,
        encryptedSymmetricKey,
        keyVersion ?? 1,
      );

      const ext = url.split('.').pop()?.toLowerCase() || '';
      const mime = MIME_MAP[ext] || 'application/octet-stream';

      const blob = new Blob([decryptedBuffer], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCacheRef.current.set(url, blobUrl);

      return blobUrl;
    },
    [encryptedSymmetricKey, keyVersion, vaultClient],
  );

  useEffect(() => {
    const blobUrlCache = blobUrlCacheRef.current;

    return () => {
      blobUrlCache.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
      blobUrlCache.clear();
    };
  }, [encryptedSymmetricKey]);

  const value = useMemo(
    () => ({
      isEncrypted: !!encryptedSymmetricKey,
      decryptFileUrl,
      revealAllCounter,
      requestRevealAll,
      pendingPlaceholders,
      registerPlaceholder,
      unregisterPlaceholder,
    }),
    [
      encryptedSymmetricKey,
      decryptFileUrl,
      revealAllCounter,
      requestRevealAll,
      pendingPlaceholders,
      registerPlaceholder,
      unregisterPlaceholder,
    ],
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = (): EncryptionContextValue =>
  useContext(EncryptionContext);
