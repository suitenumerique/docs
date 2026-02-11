import { useCallback, useEffect, useState } from 'react';

import {
  STORE_KNOWN_PUBLIC_KEYS,
  getEncryptionDB,
} from '../encryptionDB';

export interface PublicKeyMismatch {
  userId: string;
  knownKey: string;
  currentKey: string;
}

/**
 * TOFU (Trust On First Use) public key registry.
 *
 * - On first encounter, a user's public key is stored locally in IndexedDB.
 * - On subsequent encounters, if the key differs from the stored one, it is
 *   flagged as a mismatch.
 * - The caller can accept a new key via `acceptNewKey(userId)`, which updates
 *   the locally stored key.
 */
export function usePublicKeyRegistry(
  accessesPublicKeysPerUser: Record<string, string> | undefined,
) {
  const [mismatches, setMismatches] = useState<PublicKeyMismatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessesPublicKeysPerUser) {
      setMismatches([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function checkKeys() {
      try {
        const db = await getEncryptionDB();
        const newMismatches: PublicKeyMismatch[] = [];

        for (const [userId, currentKey] of Object.entries(
          accessesPublicKeysPerUser!,
        )) {
          const knownKey: string | undefined = await db.get(
            STORE_KNOWN_PUBLIC_KEYS,
            `user:${userId}`,
          );

          if (!knownKey) {
            // First time seeing this user's key — trust on first use
            await db.put(STORE_KNOWN_PUBLIC_KEYS, currentKey, `user:${userId}`);
          } else if (knownKey !== currentKey) {
            newMismatches.push({ userId, knownKey, currentKey });
          }
        }

        if (!cancelled) {
          setMismatches(newMismatches);
        }
      } catch (err) {
        console.error('usePublicKeyRegistry: failed to check keys', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    checkKeys();

    return () => {
      cancelled = true;
    };
  }, [accessesPublicKeysPerUser]);

  const acceptNewKey = useCallback(
    async (userId: string) => {
      const mismatch = mismatches.find((m) => m.userId === userId);
      if (!mismatch) {
        return;
      }

      const db = await getEncryptionDB();
      await db.put(
        STORE_KNOWN_PUBLIC_KEYS,
        mismatch.currentKey,
        `user:${userId}`,
      );

      setMismatches((prev) => prev.filter((m) => m.userId !== userId));
    },
    [mismatches],
  );

  return {
    mismatches,
    hasMismatches: mismatches.length > 0,
    loading,
    acceptNewKey,
  };
}
