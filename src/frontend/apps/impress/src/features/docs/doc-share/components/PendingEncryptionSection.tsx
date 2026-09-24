import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { UserAvatar } from '@/features/auth';
import type { DocumentEncryptionSettings } from '@/features/docs/doc-collaboration/hook/useDocumentEncryption';
import {
  fetchRegisteredKeys,
  useVaultClient,
} from '@/features/docs/doc-collaboration/vault';
import { toBase64 } from '@/features/docs/doc-editor';
import type { Access, Doc } from '@/features/docs/doc-management';

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
    fetchRegisteredKeys(vaultClient, subs)
      .then(({ publicKeys }) => {
        if (cancelled) {
          return;
        }
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
        if (!cancelled) {
          setProbing(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // pendingSubsSignature intentionally used to avoid re-probing on
    // unrelated access array identity changes.
  }, [pendingSubsSignature, vaultClient]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pending.length === 0) {
    return null;
  }

  const handleAccept = async (access: Access) => {
    const recipient = access.user;
    const sub = recipient?.suite_user_id;
    if (!sub || !recipient || !vaultClient || !documentEncryptionSettings) {
      return;
    }
    setInFlight((prev) => new Set(prev).add(access.id));
    setErrorByAccessId((prev) => {
      const copy = { ...prev };
      delete copy[access.id];
      return copy;
    });
    try {
      const { publicKeys, versions } = await fetchRegisteredKeys(vaultClient, [
        sub,
      ]);
      const userPublicKey = publicKeys[sub];
      if (!userPublicKey) {
        setHasPublicKeyBySub((m) => ({ ...m, [sub]: false }));
        throw new Error(
          t("This user still hasn't completed their encryption onboarding."),
        );
      }
      // The vault resolves + trust-checks the recipient key (binding + TOFU);
      // the fetched userPublicKey above only gates on completed onboarding. The
      // label (email/name) is display-only, shown if the trust modal opens.
      const { encryptedKeys } = await vaultClient.shareKeys(
        documentEncryptionSettings.encryptedSymmetricKey,
        { [sub]: { email: recipient.email, name: recipient.full_name } },
      );
      const wrappedKey = encryptedKeys[sub];
      if (!wrappedKey) {
        throw new Error(t('Failed to wrap the document key for this user.'));
      }
      await acceptMutation({
        docId: doc.id,
        accessId: access.id,
        encrypted_document_symmetric_key_for_user: toBase64(
          new Uint8Array(wrappedKey),
        ),
        encryption_public_key_version: versions[sub],
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
      className="--docs--pending-encryption"
      $margin={{ horizontal: 'base', bottom: 'sm' }}
      $gap="xs"
    >
      <Text $size="xs" $weight="700" $variation="secondary">
        {t('Action needed')}
      </Text>
      <Box $gap="xs">
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
          const name = access.user?.full_name || access.user?.email || '';

          return (
            <Box
              key={access.id}
              $direction="row"
              $align="center"
              $gap="xs"
              $minHeight="42px"
            >
              <Box
                $direction="row"
                $align="center"
                $gap="xs"
                $flex={1}
                $minWidth="0"
              >
                <UserAvatar fullName={name} />
                <Box $minWidth="0">
                  <Text $size="sm" $weight="500" $ellipsis>
                    {name}
                  </Text>
                  {access.user?.email && access.user?.full_name && (
                    <Text $size="xs" $variation="secondary" $ellipsis>
                      {access.user.email}
                    </Text>
                  )}
                  {!canAccept && !probing && (
                    <Text $size="xs" $variation="secondary">
                      {t(
                        'Waiting for them to enable encryption. You will be able to accept them once they have.',
                      )}
                    </Text>
                  )}
                  {error && (
                    <Text $size="xs" $theme="error">
                      {error}
                    </Text>
                  )}
                </Box>
              </Box>
              {canAccept ? (
                <Button
                  size="small"
                  variant="bordered"
                  onClick={() => void handleAccept(access)}
                  disabled={isBusy}
                >
                  {isBusy ? t('Accepting…') : t('Accept')}
                </Button>
              ) : (
                <Box
                  $direction="row"
                  $align="center"
                  $gap="3xs"
                  $padding={{ horizontal: '2xs' }}
                  $radius="4px"
                  $height="24px"
                  $background="var(--c--contextuals--background--surface--tertiary)"
                >
                  <Icon iconName="schedule" $size="sm" $variation="tertiary" />
                  <Text
                    $size="xs"
                    $weight="500"
                    $variation="tertiary"
                    $css="white-space: nowrap;"
                  >
                    {t('Pending encryption')}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
