import { useEffect, useState } from 'react';

import { computeKeyFingerprint } from '../encryption';

/**
 * Computes a SHA-256 fingerprint of a base64-encoded public key.
 * Returns a formatted hex string like "A1B2 C3D4 E5F6 7890", or null
 * if the key is not provided or still computing.
 */
export function useKeyFingerprint(
  base64Key: string | null | undefined,
): string | null {
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!base64Key) {
      setFingerprint(null);
      return;
    }

    let cancelled = false;
    computeKeyFingerprint(base64Key).then((fp) => {
      if (!cancelled) {
        setFingerprint(fp);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [base64Key]);

  return fingerprint;
}
