import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { decryptContent } from '@/docs/doc-collaboration/encryption';

const MIME_MAP: Record<string, string> = {
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  // PDF
  pdf: 'application/pdf',
};

interface EncryptionContextValue {
  isEncrypted: boolean;
  decryptFileUrl: (url: string) => Promise<string>;
}

const DEFAULT_VALUE: EncryptionContextValue = {
  isEncrypted: false,
  decryptFileUrl: async (url: string) => url,
};

const EncryptionContext = createContext<EncryptionContextValue>(DEFAULT_VALUE);

interface EncryptionProviderProps {
  symmetricKey: CryptoKey | undefined;
  children: ReactNode;
}

export const EncryptionProvider = ({
  symmetricKey,
  children,
}: EncryptionProviderProps) => {
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());

  const decryptFileUrl = useCallback(
    async (url: string): Promise<string> => {
      if (!symmetricKey) {
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

      const fileBytes = new Uint8Array(await response.arrayBuffer());
      const decryptedBytes = await decryptContent(fileBytes, symmetricKey);

      const ext = url.split('.').pop()?.toLowerCase() || '';
      const mime = MIME_MAP[ext] || 'application/octet-stream';

      const blob = new Blob([decryptedBytes as BlobPart], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCacheRef.current.set(url, blobUrl);

      return blobUrl;
    },
    [symmetricKey],
  );

  useEffect(() => {
    return () => {
      blobUrlCacheRef.current.forEach((blobUrl) =>
        URL.revokeObjectURL(blobUrl),
      );
      blobUrlCacheRef.current.clear();
    };
  }, [symmetricKey]);

  const value = useMemo(
    () => ({
      isEncrypted: !!symmetricKey,
      decryptFileUrl,
    }),
    [symmetricKey, decryptFileUrl],
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = (): EncryptionContextValue =>
  useContext(EncryptionContext);
