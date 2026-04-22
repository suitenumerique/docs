import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { useAuth } from '@/features/auth';

import type { Doc } from '../types';

/**
 * "Wrong secret key for the given ciphertext" from the vault means the
 * document was encrypted against a PREVIOUS public key of the current
 * user (reset, different device without backup restore, etc.). The
 * ciphertext itself is still valid for whoever holds the old key, but
 * this user's current key can't unwrap it. The fix is social: someone
 * with access has to re-share the doc so the symmetric key gets
 * wrapped against their CURRENT public key.
 */
export const isWrongSecretKeyError = (
  err: Error | null | undefined,
): boolean => {
  if (!err) return false;
  const msg = err.message?.toLowerCase() ?? '';
  return msg.includes('wrong secret key');
};

interface Props {
  /**
   * The doc — used to read the share-time fingerprint from
   * `doc.accesses_fingerprints_per_user[currentUser.suite_user_id]`.
   * Docs exposes this as a per-user map on the document. (We may
   * later collapse it to a single `encryption_public_key_fingerprint_for_user`
   * scalar once we take the same "current user only" approach Drive
   * does, but keeping it as a map for now matches the existing API.)
   */
  doc: Doc;
}

/**
 * Friendly panel shown when the page / websocket surfaces a "wrong
 * secret key" decryption failure. Explains the key rotation, shows the
 * share-time fingerprint (from the doc's fingerprint map) AND the
 * user's current key fingerprint so whoever re-shares can verify
 * they're wrapping against the key the user actually holds now.
 */
export const KeyMismatchPanel = ({ doc }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { client: vaultClient } = useVaultClient();
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(
    null,
  );

  const shareTimeFingerprint = user?.suite_user_id
    ? (doc.accesses_fingerprints_per_user?.[user.suite_user_id] ?? null)
    : null;

  useEffect(() => {
    if (!vaultClient) return;
    let cancelled = false;
    (async () => {
      try {
        const { publicKey } = await vaultClient.getPublicKey();
        const raw = await vaultClient.computeKeyFingerprint(publicKey);
        const formatted = vaultClient.formatFingerprint(raw);
        if (!cancelled) setCurrentFingerprint(formatted);
      } catch {
        // Ignore — we just won't render the fingerprint row.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultClient]);

  const formattedShareTime = (() => {
    if (!shareTimeFingerprint) return null;
    if (!vaultClient) return shareTimeFingerprint;
    try {
      return vaultClient.formatFingerprint(shareTimeFingerprint);
    } catch {
      return shareTimeFingerprint;
    }
  })();

  return (
    <Box $align="center" $margin="auto" $gap="md" $padding="2rem">
      <Icon iconName="key_off" $size="3rem" $theme="warning" />
      <Text as="h2" $textAlign="center" $margin="0">
        {t('This document was encrypted with a different key')}
      </Text>
      <Box $maxWidth="500px" $gap="sm">
        <Text $variation="secondary" $textAlign="center">
          {t(
            "The document was encrypted for you at a time when you were using a different encryption key — possibly before you reset your keys or switched device without restoring a backup. Your current key can no longer decrypt it. Ask an owner or administrator of this document to remove you from the access list and add you back so it gets re-encrypted for your current key.",
          )}
        </Text>
      </Box>
      {(formattedShareTime || currentFingerprint) && (
        <Box $gap="2xs" $maxWidth="500px" $align="center">
          {formattedShareTime && (
            <Text $variation="secondary" $size="sm" $textAlign="center">
              {t('Fingerprint at the time it was shared with you:')}{' '}
              <Text
                as="span"
                $css={`
                  font-family: monospace;
                  background: var(--c--theme--colors--greyscale-100, #f4f4f5);
                  padding: 2px 6px;
                  border-radius: 3px;
                `}
              >
                {formattedShareTime}
              </Text>
            </Text>
          )}
          {currentFingerprint && (
            <Text $variation="secondary" $size="sm" $textAlign="center">
              {t('Your current key fingerprint:')}{' '}
              <Text
                as="span"
                $css={`
                  font-family: monospace;
                  background: var(--c--theme--colors--greyscale-100, #f4f4f5);
                  padding: 2px 6px;
                  border-radius: 3px;
                `}
              >
                {currentFingerprint}
              </Text>
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
