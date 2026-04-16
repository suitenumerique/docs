import { useEffect, useState } from 'react';

import { useVaultClient } from '../vault';

/**
 * Computes a SHA-256 fingerprint of a base64-encoded public key.
 * Returns a formatted hex string like "A1B2 C3D4 E5F6 7890", or null
 * if the key is not provided or still computing.
 */
export function useKeyFingerprint(
  base64Key: string | null | undefined,
): string | null {
  const { client: vaultClient } = useVaultClient();
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!base64Key || !vaultClient) {
      setFingerprint(null);
      return;
    }

    let cancelled = false;
    const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
    vaultClient.computeKeyFingerprint(raw.buffer).then((fp) => {
      if (!cancelled) {
        setFingerprint(vaultClient.formatFingerprint(fp));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [base64Key, vaultClient]);

  return fingerprint;
}
