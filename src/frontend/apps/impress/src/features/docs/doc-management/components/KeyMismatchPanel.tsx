import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { useAuth } from '@/features/auth';
import {
  fetchRegisteredKeys,
  useVaultClient,
} from '@/features/docs/doc-collaboration/vault';

import type { Doc } from '../types';

/**
 * True when the SDK threw a `VaultError` carrying the
 * `WRONG_SECRET_KEY` code. In docs this means the document was
 * encrypted against a PREVIOUS public key of the current user (reset,
 * different device without backup restore, etc.) — the ciphertext is
 * still valid for whoever holds the old key, but the current key
 * can't unwrap it. The fix is social: someone with access has to
 * re-share the doc so the symmetric key gets wrapped against the
 * user's CURRENT public key.
 */
export const isWrongSecretKeyError = (
  err: Error | null | undefined,
): boolean => {
  if (!err) {
    return false;
  }
  return (err as VaultError).code === 'WRONG_SECRET_KEY';
};

interface Props {
  /**
   * The doc — used to read the share-time encryption key version from
   * `doc.accesses_versions_per_user[currentUser.suite_user_id]`.
   * Docs exposes this as a per-user map on the document. (We may
   * later collapse it to a single `encryption_public_key_version_for_user`
   * scalar once we take the same "current user only" approach Drive
   * does, but keeping it as a map for now matches the existing API.)
   */
  doc: Doc;
}

/**
 * Friendly panel shown when the page / websocket surfaces a "wrong
 * secret key" decryption failure. Explains the key rotation, shows the
 * share-time key version (from the doc's version map) AND the user's
 * current key version so whoever re-shares can see the access was
 * wrapped for an older key and needs re-encryption.
 */
export const KeyMismatchPanel = ({ doc }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { client: vaultClient } = useVaultClient();
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);

  const shareTimeVersion = user?.suite_user_id
    ? (doc.accesses_versions_per_user?.[user.suite_user_id] ?? null)
    : null;

  useEffect(() => {
    if (!vaultClient || !user?.suite_user_id) {
      return;
    }
    const sub = user.suite_user_id;
    let cancelled = false;
    void (async () => {
      try {
        const { versions } = await fetchRegisteredKeys(vaultClient, [sub]);
        if (!cancelled) {
          setCurrentVersion(versions[sub] ?? null);
        }
      } catch {
        // Ignore — we just won't render the version row.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultClient, user?.suite_user_id]);

  return (
    <Box $align="center" $margin="auto" $gap="md" $padding="2rem">
      <Icon iconName="key_off" $size="3rem" $theme="warning" />
      <Text as="h2" $textAlign="center" $margin="0">
        {t('This document was encrypted with a different key')}
      </Text>
      <Box $maxWidth="500px" $gap="sm">
        <Text $variation="secondary" $textAlign="center">
          {t(
            'The document was encrypted for you at a time when you were using a different encryption key — possibly before you reset your keys or switched device without restoring a backup. Your current key can no longer decrypt it. Ask an owner or administrator of this document to remove you from the access list and add you back so it gets re-encrypted for your current key.',
          )}
        </Text>
      </Box>
      {(shareTimeVersion !== null || currentVersion !== null) && (
        <Box $gap="2xs" $maxWidth="500px" $align="center">
          {shareTimeVersion !== null && (
            <Text $variation="secondary" $size="sm" $textAlign="center">
              {t('Encryption key version at the time it was shared with you:')}{' '}
              <Text
                as="span"
                $css={`
                  font-family: monospace;
                  background: var(--c--theme--colors--greyscale-100, #f4f4f5);
                  padding: 2px 6px;
                  border-radius: 3px;
                `}
              >
                {shareTimeVersion}
              </Text>
            </Text>
          )}
          {currentVersion !== null && (
            <Text $variation="secondary" $size="sm" $textAlign="center">
              {t('Your current encryption key version:')}{' '}
              <Text
                as="span"
                $css={`
                  font-family: monospace;
                  background: var(--c--theme--colors--greyscale-100, #f4f4f5);
                  padding: 2px 6px;
                  border-radius: 3px;
                `}
              >
                {currentVersion}
              </Text>
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
