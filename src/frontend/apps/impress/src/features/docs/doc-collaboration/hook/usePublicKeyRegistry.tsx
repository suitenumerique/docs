import { useCallback, useEffect, useState } from 'react';

import { STORE_KNOWN_PUBLIC_KEYS, getEncryptionDB } from '../encryptionDB';

export interface PublicKeyMismatch {
  userId: string;
  knownKey: string;
  currentKey: string;
}

// module-level listener set to keep all hook instances in sync
const registryListeners = new Set<() => void>();

function notifyRegistryUpdated() {
  registryListeners.forEach((fn) => fn());
}

/**
 * TOFU (Trust On First Use) public key registry.
 *
 * - On first encounter, a user's public key is stored locally in IndexedDB.
 * - On subsequent encounters, if the key differs from the stored one, it is
 *   flagged as a mismatch.
 * - The caller can accept a new key via `acceptNewKey(userId)`, which updates
 *   the locally stored key.
 *
 * All instances stay in sync via a module-level listener set.
 */
export function usePublicKeyRegistry(
  accessesPublicKeysPerUser: Record<string, string> | undefined,
  currentUserId?: string,
) {
  const [mismatches, setMismatches] = useState<PublicKeyMismatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // listen for updates from other hook instances
  useEffect(() => {
    const handler = () => setRefreshTrigger((prev) => prev + 1);

    registryListeners.add(handler);

    return () => {
      registryListeners.delete(handler);
    };
  }, []);

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
          // Skip the current user — they know about their own key changes
          if (currentUserId && userId === currentUserId) {
            // Still store the key so it stays up to date locally
            await db.put(STORE_KNOWN_PUBLIC_KEYS, currentKey, `user:${userId}`);
            continue;
          }

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
      } catch (error) {
        console.error('usePublicKeyRegistry: failed to check keys', error);
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
  }, [accessesPublicKeysPerUser, currentUserId, refreshTrigger]);

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

      // notify other instances to re-check
      notifyRegistryUpdated();
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
