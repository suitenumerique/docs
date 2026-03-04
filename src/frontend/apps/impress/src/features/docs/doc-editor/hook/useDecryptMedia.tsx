import { useCallback, useEffect, useRef, useState } from 'react';

import { useEncryption } from '../components/EncryptionProvider';
import { ANALYZE_URL } from '../conf';

export const useDecryptMedia = (url: string | undefined) => {
  const {
    isEncrypted,
    decryptFileUrl,
    revealAllCounter,
    registerPlaceholder,
    unregisterPlaceholder,
  } = useEncryption();
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

  // Auto-decrypt when "Reveal all" is requested
  const decryptRef = useRef(decrypt);
  decryptRef.current = decrypt;

  useEffect(() => {
    if (revealAllCounter > 0 && isEncrypted && url && !isAnalyzing) {
      void decryptRef.current();
    }
  }, [revealAllCounter, isEncrypted, url, isAnalyzing]);

  const showPlaceholder =
    isEncrypted && !resolvedUrl && !hasError && !!url && !isAnalyzing;

  const showMedia = !!url && !isAnalyzing && (!isEncrypted || !!resolvedUrl);

  // Track pending placeholders in the provider
  const wasShowingPlaceholder = useRef(false);
  useEffect(() => {
    if (showPlaceholder && !wasShowingPlaceholder.current) {
      registerPlaceholder();
      wasShowingPlaceholder.current = true;
    } else if (!showPlaceholder && wasShowingPlaceholder.current) {
      unregisterPlaceholder();
      wasShowingPlaceholder.current = false;
    }
  }, [showPlaceholder, registerPlaceholder, unregisterPlaceholder]);

  useEffect(() => {
    return () => {
      if (wasShowingPlaceholder.current) {
        unregisterPlaceholder();
      }
    };
  }, [unregisterPlaceholder]);

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
