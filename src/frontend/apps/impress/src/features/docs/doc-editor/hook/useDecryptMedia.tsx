import { useCallback, useState } from 'react';

import { useEncryption } from '../components/EncryptionProvider';
import { ANALYZE_URL } from '../conf';

export const useDecryptMedia = (url: string | undefined) => {
  const { isEncrypted, decryptFileUrl } = useEncryption();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isAnalyzing = !!url && url.includes(ANALYZE_URL);

  const decrypt = useCallback(async () => {
    if (!url || resolvedUrl || isLoading) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    try {
      const blobUrl = await decryptFileUrl(url);
      setResolvedUrl(blobUrl);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [url, resolvedUrl, isLoading, decryptFileUrl]);

  const showPlaceholder =
    isEncrypted && !resolvedUrl && !hasError && !!url && !isAnalyzing;

  const showMedia = !!url && !isAnalyzing && (!isEncrypted || !!resolvedUrl);

  return {
    isEncrypted,
    resolvedUrl,
    isLoading,
    hasError,
    decrypt,
    showPlaceholder,
    showMedia,
  };
};
