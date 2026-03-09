import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Box, ButtonCloseModal, Icon, Text } from '@/components';
import { useUserUpdate } from '@/core/api/useUserUpdate';
import {
  exportPublicKeyAsBase64,
  getEncryptionDB,
  useKeyFingerprint,
  useUserEncryption,
} from '@/docs/doc-collaboration';
import { Badge, Spinner } from '@gouvfr-lasuite/ui-kit';

import { useAuth } from '../hooks';

type SettingsView = 'main' | 'confirm-remove';

interface ModalEncryptionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestReOnboard: () => void;
}

export const ModalEncryptionSettings = ({
  isOpen,
  onClose,
  onRequestReOnboard,
}: ModalEncryptionSettingsProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { user } = useAuth();
  const { encryptionSettings, refreshEncryption } = useUserEncryption();
  const { mutateAsync: updateUser } = useUserUpdate();

  const backendFingerprint = useKeyFingerprint(user?.encryption_public_key);
  const [localPublicKeyBase64, setLocalPublicKeyBase64] = useState<
    string | null
  >(null);
  const localFingerprint = useKeyFingerprint(localPublicKeyBase64);

  const [view, setView] = useState<SettingsView>('main');
  const [confirmInput, setConfirmInput] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [alsoRemoveFromServer, setAlsoRemoveFromServer] = useState(false);

  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setView('main');
      setConfirmInput('');
      setAlsoRemoveFromServer(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (encryptionSettings?.userPublicKey) {
      exportPublicKeyAsBase64(encryptionSettings.userPublicKey).then(
        setLocalPublicKeyBase64,
      );
    } else {
      setLocalPublicKeyBase64(null);
    }
  }, [encryptionSettings]);

  const hasMismatch =
    localPublicKeyBase64 !== null &&
    user?.encryption_public_key !== null &&
    localPublicKeyBase64 !== user?.encryption_public_key;

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  const normalizedConfirmInput = confirmInput.trim().toUpperCase();
  const normalizedBackendFingerprint = backendFingerprint?.toUpperCase() ?? '';
  const fingerprintMatches =
    !!normalizedBackendFingerprint &&
    normalizedConfirmInput === normalizedBackendFingerprint;

  const canConfirmRemoval = fingerprintMatches;

  const handleRemoveEncryption = async () => {
    if (!user || !canConfirmRemoval) {
      return;
    }

    setIsPending(true);

    try {
      if (alsoRemoveFromServer) {
        await updateUser({
          id: user.id,
          encryption_public_key: null,
        });
      }

      const encryptionDatabase = await getEncryptionDB();
      await encryptionDatabase.delete('privateKey', `user:${user.id}`);
      await encryptionDatabase.delete('publicKey', `user:${user.id}`);

      refreshEncryption();

      toast(
        alsoRemoveFromServer
          ? t('Encryption has been fully removed from your account.')
          : t('Local encryption keys have been removed from this device.'),
        VariantType.SUCCESS,
        {
          duration: 4000,
        },
      );

      handleClose();
    } catch (error) {
      console.error('Failed to remove encryption:', error);
      toast(
        t('Failed to remove encryption. Please try again.'),
        VariantType.ERROR,
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleReOnboard = () => {
    handleClose();
    onRequestReOnboard();
  };

  const renderMain = () => (
    <Box $gap="sm">
      {hasMismatch && (
        <Alert type={VariantType.ERROR}>
          <Box $gap="xs">
            <Text $size="sm" $weight="600">
              {t('Key mismatch detected')}
            </Text>
            <Text $size="sm">
              {t(
                'The encryption key on this device does not match the one registered on your account. This may happen if you set up encryption on another device or if your local data was modified.',
              )}
            </Text>
            <Text $size="sm">
              {t(
                'It will lead to unexpected behavior since when other people is sharing a document with you they will use the public key stored on the server, and so according to your current local public key your device will not be able to decrypt the document.',
              )}
            </Text>
            <Button
              variant="secondary"
              color="error"
              onClick={handleReOnboard}
              style={{ width: 'fit-content' }}
            >
              {t('Re-setup encryption')}
            </Button>
          </Box>
        </Alert>
      )}

      <Box $gap="xs">
        <Text $size="sm">{t('Your public key fingerprint on the server')}</Text>
        <Box
          $padding="sm"
          $background="var(--c--contextuals--background--semantic--contextual--primary)"
          $radius="4px"
          $css="font-family: monospace; font-size: 14px; letter-spacing: 2px;"
        >
          {backendFingerprint || '...'}
        </Box>
      </Box>

      {localFingerprint && (
        <Box $gap="xs">
          <Text $size="sm">
            {t('Your public key fingerprint on this current device')}
          </Text>
          <Box
            $padding="sm"
            $background="var(--c--contextuals--background--semantic--contextual--primary)"
            $radius="4px"
            $css="font-family: monospace; font-size: 14px; letter-spacing: 2px;"
          >
            {localFingerprint}
          </Box>
        </Box>
      )}

      {!encryptionSettings && user?.encryption_public_key && (
        <Alert type={VariantType.WARNING}>
          <Box $gap="xs">
            <Text $size="sm" $weight="600">
              {t('No local keys on this device')}
            </Text>
            <Text $size="sm">
              {t(
                'Your account has a public key registered on the server, but no encryption keys were found on this device. You will not be able to decrypt documents until you restore your keys from a backup.',
              )}
            </Text>
            <Button
              variant="secondary"
              onClick={handleReOnboard}
              style={{ width: 'fit-content' }}
            >
              {t('Restore keys on this device')}
            </Button>
          </Box>
        </Alert>
      )}
    </Box>
  );

  const renderConfirmRemove = () => (
    <Box $gap="sm">
      <Alert type={VariantType.WARNING}>
        <Text $size="sm">
          {t(
            'This will delete your local encryption keys from this device. You will no longer be able to decrypt documents from this browser unless you restore your keys from a backup.',
          )}
        </Text>
      </Alert>

      <Box
        $gap="xs"
        $padding="sm"
        $background="var(--c--contextuals--background--semantic--contextual--primary)"
        $radius="4px"
      >
        <Checkbox
          label={t('Also remove my public key from the server')}
          checked={alsoRemoveFromServer}
          onChange={() => {
            setAlsoRemoveFromServer((prev) => !prev);
            setConfirmInput('');
          }}
        />
        <Text $size="xs" $variation="secondary" $margin={{ left: 'lg' }}>
          {t(
            'If enabled, other users will no longer find this current public key to share new documents with you.',
          )}
        </Text>
      </Box>

      <Box $gap="xs">
        <Text $size="sm" $direction="row" $align="center" $gap="0.3rem">
          <Trans t={t}>
            To confirm, type your public key fingerprint:{' '}
            <Badge style={{ width: 'fit-content' }}>{backendFingerprint}</Badge>
          </Trans>
        </Text>
        <Input
          label={t('Fingerprint')}
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          state={confirmInput && !fingerprintMatches ? 'error' : 'default'}
          text={
            confirmInput && !fingerprintMatches
              ? t('Fingerprint does not match')
              : undefined
          }
        />
      </Box>
    </Box>
  );

  const getRightActions = () => {
    if (view === 'main') {
      return (
        <>
          <Button variant="secondary" fullWidth onClick={handleClose}>
            {t('Close')}
          </Button>
          <Button
            color="error"
            fullWidth
            onClick={() => setView('confirm-remove')}
          >
            {t('Remove encryption')}
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setView('main');
            setConfirmInput('');
          }}
        >
          {t('Back')}
        </Button>
        <Button
          color="error"
          fullWidth
          onClick={handleRemoveEncryption}
          disabled={isPending || !canConfirmRemoval}
          icon={
            isPending ? (
              <div>
                <Spinner size="sm" />
              </div>
            ) : undefined
          }
        >
          {t('Confirm removal')}
        </Button>
      </>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      closeOnClickOutside={!isPending}
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-encryption-settings-title"
      rightActions={getRightActions()}
      size={ModalSize.MEDIUM}
      title={
        <Box
          $direction="row"
          $justify="space-between"
          $align="center"
          $width="100%"
        >
          <Text
            $size="h6"
            as="h1"
            id="modal-encryption-settings-title"
            $margin="0"
            $align="flex-start"
          >
            {view === 'main'
              ? t('Encryption settings')
              : t('Remove encryption')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close')}
            onClick={handleClose}
            disabled={isPending}
          />
        </Box>
      }
    >
      {view === 'main' ? renderMain() : renderConfirmRemove()}
    </Modal>
  );
};
