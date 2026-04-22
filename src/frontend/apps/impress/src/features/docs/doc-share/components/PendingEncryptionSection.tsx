import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { toBase64 } from '@/features/docs/doc-editor';
import type { Access, Doc } from '@/features/docs/doc-management';
import type { DocumentEncryptionSettings } from '@/features/docs/doc-collaboration/hook/useDocumentEncryption';

import { useAcceptEncryptionAccess } from '../api/useAcceptEncryptionAccess';

interface Props {
  doc: Doc;
  accesses: Access[];
  documentEncryptionSettings: DocumentEncryptionSettings | null;
}

/**
 * Lists users who were added to an encrypted doc before completing
 * their encryption onboarding (`is_pending_encryption`).
 *
 * Two sub-states per row, driven by an upfront public-key probe:
 *  - invitee HAS a public key → Accept button actionable. One click
 *    re-wraps the document key against their key and PATCHes the row.
 *  - invitee has NO public key yet → no button, just a hint saying we're
 *    waiting for them to complete onboarding. This prevents the
 *    "click Accept, get a cryptic error" loop.
 */
export const PendingEncryptionSection = ({
  doc,
  accesses,
  documentEncryptionSettings,
}: Props) => {
  const { t } = useTranslation();
  const { client: vaultClient } = useVaultClient();
  const { mutateAsync: acceptMutation } = useAcceptEncryptionAccess();

  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const [errorByAccessId, setErrorByAccessId] = useState<
    Record<string, string>
  >({});
  const [hasPublicKeyBySub, setHasPublicKeyBySub] = useState<
    Record<string, boolean>
  >({});
  const [probing, setProbing] = useState(true);

  const pending = useMemo(
    () =>
      accesses.filter(
        (a) => a.is_pending_encryption && a.document.id === doc.id,
      ),
    [accesses, doc.id],
  );
  const pendingSubsSignature = useMemo(
    () =>
      pending
        .map((a) => a.user?.suite_user_id)
        .filter((s): s is string => !!s)
        .sort()
        .join(','),
    [pending],
  );

  useEffect(() => {
    if (pending.length === 0 || !vaultClient) {
      setProbing(false);
      return;
    }
    let cancelled = false;
    setProbing(true);
    const subs = pending
      .map((a) => a.user?.suite_user_id)
      .filter((s): s is string => !!s);
    if (subs.length === 0) {
      setProbing(false);
      return;
    }
    vaultClient
      .fetchPublicKeys(subs)
      .then(({ publicKeys }) => {
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const sub of subs) {
          next[sub] = !!publicKeys[sub];
        }
        setHasPublicKeyBySub(next);
      })
      .catch(() => {
        /* leave empty — fall back to "waiting for their onboarding" */
      })
      .finally(() => {
        if (!cancelled) setProbing(false);
      });
    return () => {
      cancelled = true;
    };
    // pendingSubsSignature intentionally used to avoid re-probing on
    // unrelated access array identity changes.
  }, [pendingSubsSignature, vaultClient]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pending.length === 0) return null;

  const handleAccept = async (access: Access) => {
    const sub = access.user?.suite_user_id;
    if (!sub || !vaultClient || !documentEncryptionSettings) return;
    setInFlight((prev) => new Set(prev).add(access.id));
    setErrorByAccessId((prev) => {
      const copy = { ...prev };
      delete copy[access.id];
      return copy;
    });
    try {
      const { publicKeys } = await vaultClient.fetchPublicKeys([sub]);
      const userPublicKey = publicKeys[sub];
      if (!userPublicKey) {
        setHasPublicKeyBySub((m) => ({ ...m, [sub]: false }));
        throw new Error(
          t("This user still hasn't completed their encryption onboarding."),
        );
      }
      const { encryptedKeys } = await vaultClient.shareKeys(
        documentEncryptionSettings.encryptedSymmetricKey,
        { [sub]: userPublicKey },
      );
      const wrappedKey = encryptedKeys[sub];
      if (!wrappedKey) {
        throw new Error(t('Failed to wrap the document key for this user.'));
      }
      const fingerprint = await vaultClient.computeKeyFingerprint(userPublicKey);
      await acceptMutation({
        docId: doc.id,
        accessId: access.id,
        encrypted_document_symmetric_key_for_user: toBase64(
          new Uint8Array(wrappedKey),
        ),
        encryption_public_key_fingerprint: fingerprint,
      });
    } catch (err) {
      setErrorByAccessId((prev) => ({
        ...prev,
        [access.id]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setInFlight((prev) => {
        const copy = new Set(prev);
        copy.delete(access.id);
        return copy;
      });
    }
  };

  return (
    <Box
      $padding="sm"
      $margin={{ horizontal: 'base', bottom: 'sm' }}
      $gap="xs"
      $css={`
        background: var(--c--theme--colors--warning-050, #fffbf0);
        border: 1px solid var(--c--theme--colors--warning-300, #ffd591);
        border-radius: 4px;
      `}
    >
      <Box $direction="row" $align="center" $gap="xs">
        <Icon iconName="hourglass_empty" $size="sm" $theme="warning" />
        <Text $weight="600" $size="sm">
          {t('Users pending encryption access ({{count}})', {
            count: pending.length,
          })}
        </Text>
      </Box>
      <Box $gap="2xs">
        {pending.map((access) => {
          const sub = access.user?.suite_user_id;
          const isBusy = inFlight.has(access.id);
          const error = errorByAccessId[access.id];
          const hasPublicKey = sub ? hasPublicKeyBySub[sub] : false;
          const canAccept =
            !!sub &&
            !!documentEncryptionSettings &&
            hasPublicKey === true &&
            !probing;
          return (
            <Box
              key={access.id}
              $direction="row"
              $align="center"
              $gap="xs"
              $wrap="wrap"
              $padding={{ vertical: '3xs' }}
            >
              <Box $flex={1} $minWidth="0">
                <Text $weight="500" $size="sm">
                  {access.user?.full_name || access.user?.email}
                </Text>
                {access.user?.email && access.user?.full_name && (
                  <Text $size="xs" $variation="secondary">
                    {access.user.email}
                  </Text>
                )}
                {!canAccept && !probing && (
                  <Text $size="xs" $variation="secondary">
                    {t(
                      "Waiting for this user to complete their encryption onboarding. You'll be able to accept them once they have.",
                    )}
                  </Text>
                )}
                {error && (
                  <Text $size="xs" $theme="error">
                    {error}
                  </Text>
                )}
              </Box>
              {canAccept && (
                <Button
                  size="small"
                  onClick={() => void handleAccept(access)}
                  disabled={isBusy}
                >
                  {isBusy ? t('Accepting…') : t('Accept')}
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
