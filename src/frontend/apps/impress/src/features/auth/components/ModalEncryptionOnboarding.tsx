import {
  Alert,
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { Badge, Spinner } from '@gouvfr-lasuite/ui-kit';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, ButtonCloseModal, Icon, Text } from '@/components';
import { useUserUpdate } from '@/core/api/useUserUpdate';
import {
  derivePublicJwkFromPrivate,
  exportPrivateKeyAsJwk,
  exportPublicKeyAsBase64,
  generateUserKeyPair,
  getEncryptionDB,
  importPrivateKeyFromJwk,
  importPublicKeyFromJwk,
  jwkToPassphrase,
  passphraseToJwk,
  useUserEncryption,
} from '@/docs/doc-collaboration';

import { useAuth } from '../hooks';

type OnboardingStep =
  | 'explanation'
  | 'existing-key-choice'
  | 'generating'
  | 'restore'
  | 'backup';

interface ModalEncryptionOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalEncryptionOnboarding = ({
  isOpen,
  onClose,
  onSuccess,
}: ModalEncryptionOnboardingProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { user } = useAuth();
  const { refreshEncryption } = useUserEncryption();
  const { mutateAsync: updateUser } = useUserUpdate();

  const hasExistingBackendKey = !!user?.encryption_public_key;

  const [step, setStep] = useState<OnboardingStep>('explanation');
  const [isPending, setIsPending] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStep(hasExistingBackendKey ? 'existing-key-choice' : 'explanation');
      setBackupPassphrase(null);
      setShowPassphrase(false);
      setRestoreInput('');
      setRestoreError(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, hasExistingBackendKey]);

  const handleClose = () => {
    if (isPending) {
      return;
    }

    onClose();
  };

  const generateAndStoreKeys = async () => {
    if (!user) {
      return;
    }

    setIsPending(true);

    try {
      const userKeyPair = await generateUserKeyPair();

      const encryptionDatabase = await getEncryptionDB();

      // TODO: it should use transaction
      // encryptionDatabase.transaction
      await encryptionDatabase.put(
        'privateKey',
        userKeyPair.privateKey,
        `user:${user.id}`,
      );
      await encryptionDatabase.put(
        'publicKey',
        userKeyPair.publicKey,
        `user:${user.id}`,
      );

      const publicKeyBase64 = await exportPublicKeyAsBase64(
        userKeyPair.publicKey,
      );

      await updateUser({
        id: user.id,
        encryption_public_key: publicKeyBase64,
      });

      // Generate backup passphrase
      const privateJwk = await exportPrivateKeyAsJwk(userKeyPair.privateKey);

      setBackupPassphrase(jwkToPassphrase(privateJwk));

      refreshEncryption();

      setStep('backup');
    } catch (error) {
      console.error('Key generation failed:', error);

      toast(
        t('Failed to generate encryption keys. Please try again.'),
        VariantType.ERROR,
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleRestoreKeys = async () => {
    if (!user || !restoreInput.trim()) {
      return;
    }

    setIsPending(true);
    setRestoreError(null);

    try {
      const privateJwk = passphraseToJwk(restoreInput.trim());
      const privateKey = await importPrivateKeyFromJwk(privateJwk);

      const publicJwk = derivePublicJwkFromPrivate(privateJwk);
      const publicKey = await importPublicKeyFromJwk(publicJwk);

      // Verify restored public key matches the backend
      const restoredPublicKeyBase64 = await exportPublicKeyAsBase64(publicKey);

      if (
        user.encryption_public_key &&
        restoredPublicKeyBase64 !== user.encryption_public_key
      ) {
        setRestoreError(
          t(
            'The restored key does not match the one registered on your account. If you want to restore an older key, you must first remove encryption from your account settings (including the server key), then re-enable encryption using this backup.',
          ),
        );
        setIsPending(false);

        return;
      }

      const encryptionDatabase = await getEncryptionDB();
      await encryptionDatabase.put('privateKey', privateKey, `user:${user.id}`);
      await encryptionDatabase.put('publicKey', publicKey, `user:${user.id}`);

      refreshEncryption();

      toast(t('Encryption keys restored successfully.'), VariantType.SUCCESS, {
        duration: 4000,
      });

      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error('Key restoration failed:', error);

      setRestoreError(
        t('Invalid backup data. Please check your passphrase and try again.'),
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleBackupThirdParty = () => {
    alert(t('Third-party backup is not implemented yet.'));
  };

  const handleCopyPassphrase = async () => {
    if (!backupPassphrase) {
      return;
    }

    try {
      await navigator.clipboard.writeText(backupPassphrase);
      toast(t('Passphrase copied to clipboard.'), VariantType.SUCCESS, {
        duration: 2000,
      });
    } catch {
      toast(t('Failed to copy to clipboard.'), VariantType.ERROR);
    }
  };

  const handleBackupDone = () => {
    toast(t('Encryption has been enabled.'), VariantType.SUCCESS, {
      duration: 4000,
    });
    handleClose();
    onSuccess?.();
  };

  const renderExplanation = () => (
    <Box $gap="sm">
      <Alert type={VariantType.WARNING}>
        <Box $gap="xs">
          <Text $size="sm">
            {t(
              'Encryption keys will be stored locally on this device. If these keys are lost (browser data cleared, device lost), you will permanently lose the ability to decrypt your documents.',
            )}
          </Text>
          <Text $size="sm">
            {t(
              'After enabling encryption, you will be prompted to back up your keys. Please do so carefully using a password manager with two-factor authentication (2FA), or by printing your backup.',
            )}
          </Text>
        </Box>
      </Alert>
    </Box>
  );

  const renderExistingKeyChoice = () => (
    <Box $gap="sm">
      <Alert type={VariantType.WARNING}>
        <Box $gap="xs">
          <Text $size="sm" $weight="600">
            {t('Previous encryption setup detected')}
          </Text>
          <Text $size="sm">
            {t(
              'Your account already has an encryption key registered. This could be from a previous setup on this device (with storage cleared) or from another device.',
            )}
          </Text>
        </Box>
      </Alert>

      <Box $gap="sm">
        <Box
          $gap="xs"
          $padding="sm"
          $background="var(--c--contextuals--background--semantic--contextual--primary)"
          $radius="4px"
        >
          <Box $direction="row" $align="center" $gap="xs">
            <Text $size="sm" $weight="600">
              {t('Restore from backup')}
            </Text>
            <Badge>{t('Recommended')}</Badge>
          </Box>
          <Text $size="xs" $variation="secondary">
            {t(
              'If you have a backup of your keys, you can restore them on this device.',
            )}
          </Text>
          <Button
            fullWidth
            color="brand"
            variant="secondary"
            onClick={() => setStep('restore')}
            icon={<Icon iconName="key" $size="sm" $theme="brand" />}
          >
            {t('Restore existing keys from backup')}
          </Button>
        </Box>

        <Box
          $direction="row"
          $align="center"
          $gap="sm"
          $css="color: var(--c--contextuals--content--secondary);"
        >
          <Box $css="flex: 1; height: 1px; background: var(--c--contextuals--border--surface--primary);" />
          <Text $size="xs" $variation="secondary">
            {t('or')}
          </Text>
          <Box $css="flex: 1; height: 1px; background: var(--c--contextuals--border--surface--primary);" />
        </Box>

        <Box
          $gap="xs"
          $padding="sm"
          $background="var(--c--contextuals--background--semantic--contextual--primary)"
          $radius="4px"
        >
          <Text $size="sm" $weight="600">
            {t('Start fresh')}
          </Text>
          <Text $size="xs" $variation="secondary">
            {t(
              'Creating new keys will invalidate your old ones. Documents where you are the sole member will become permanently undecryptable. Documents shared with others will require them to unshare and reshare after you have your new key.',
            )}
          </Text>
          <Button
            fullWidth
            color="error"
            variant="secondary"
            onClick={generateAndStoreKeys}
            disabled={isPending}
            icon={
              isPending ? (
                <div>
                  <Spinner size="sm" />
                </div>
              ) : (
                <Icon iconName="add" $size="sm" $theme="error" />
              )
            }
          >
            {t('Create new key pair (invalidates old keys)')}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  const renderRestore = () => (
    <Box $gap="sm">
      <Text $size="sm">
        {t(
          'Paste your backup passphrase below to restore your encryption keys on this device.',
        )}
      </Text>

      <Box
        as="textarea"
        $padding="sm"
        $radius="4px"
        $width="100%"
        $css="min-height: 100px; font-family: monospace; font-size: 12px; border: 1px solid var(--c--contextuals--border--surface--primary); resize: vertical;"
        value={restoreInput}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setRestoreInput(e.target.value)
        }
        placeholder={t('Paste your backup passphrase here...')}
      />

      {restoreError && <Alert type={VariantType.ERROR}>{restoreError}</Alert>}
    </Box>
  );

  const [showPassphrase, setShowPassphrase] = useState(false);

  const renderBackup = () => (
    <Box $gap="sm">
      <Alert type={VariantType.SUCCESS}>
        <Box $gap="xs">
          <Text $size="sm" $weight="600">
            {t('Keys generated successfully!')}
          </Text>
          <Text $size="sm">
            {t(
              'Please back up your private key using one of the methods below. Without this backup, you will lose access to your encrypted documents if your browser data is cleared.',
            )}
          </Text>
        </Box>
      </Alert>

      <Box
        $gap="xs"
        $padding="sm"
        $background="var(--c--contextuals--background--semantic--contextual--primary)"
        $radius="4px"
      >
        <Box $direction="row" $align="center" $gap="xs">
          <Icon iconName="key" $size="sm" $theme="brand" />
          <Text $size="sm" $weight="600">
            {t('Save passphrase')}
          </Text>
          <Badge>{t('Recommended')}</Badge>
        </Box>
        <Text $size="xs" $variation="secondary">
          {t(
            'Copy this passphrase and store it in a password manager with 2FA enabled, or print it and keep it in a safe place.',
          )}
        </Text>
        {showPassphrase ? (
          <Box $gap="xs">
            <Box
              as="textarea"
              readOnly
              value={backupPassphrase ?? ''}
              rows={4}
              $width="100%"
              $padding="sm"
              $radius="4px"
              $css="font-family: monospace; font-size: 11px; word-break: break-all; resize: none; border: 1px solid var(--c--contextuals--border--surface--primary); background: var(--c--contextuals--background--surface--primary); user-select: all;"
            />
            <Button variant="secondary" onClick={handleCopyPassphrase}>
              {t('Copy to clipboard')}
            </Button>
          </Box>
        ) : (
          <Button variant="secondary" onClick={() => setShowPassphrase(true)}>
            {t('Reveal passphrase')}
          </Button>
        )}
      </Box>

      <Box
        $gap="xs"
        $padding="sm"
        $background="var(--c--contextuals--background--semantic--contextual--primary)"
        $radius="4px"
      >
        <Box $direction="row" $align="center" $gap="xs">
          <Icon iconName="cloud_upload" $size="sm" $theme="brand" />
          <Text $size="sm" $weight="600">
            {t('Third-party backup')}
          </Text>
        </Box>
        <Text $size="xs" $variation="secondary">
          {t(
            'Send your encrypted key to a trusted third-party server for recovery.',
          )}
        </Text>
        <Button variant="secondary" onClick={handleBackupThirdParty}>
          {t('Send to server')}
        </Button>
      </Box>
    </Box>
  );

  const getStepContent = () => {
    switch (step) {
      case 'explanation':
        return renderExplanation();
      case 'existing-key-choice':
        return renderExistingKeyChoice();
      case 'generating':
        return (
          <Box $align="center" $padding="lg">
            <Spinner />
            <Text $size="sm">{t('Generating encryption keys...')}</Text>
          </Box>
        );
      case 'restore':
        return renderRestore();
      case 'backup':
        return renderBackup();
    }
  };

  const getRightActions = () => {
    switch (step) {
      case 'explanation':
        return (
          <>
            <Button variant="secondary" fullWidth onClick={handleClose}>
              {t('Cancel')}
            </Button>
            <Button
              color="brand"
              fullWidth
              onClick={generateAndStoreKeys}
              disabled={isPending}
              icon={
                isPending ? (
                  <div>
                    <Spinner size="sm" />
                  </div>
                ) : undefined
              }
            >
              {t('Enable encryption')}
            </Button>
          </>
        );
      case 'existing-key-choice':
        return (
          <Button variant="secondary" fullWidth onClick={handleClose}>
            {t('Cancel')}
          </Button>
        );
      case 'restore':
        return (
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setRestoreError(null);
                setRestoreInput('');
                setStep(
                  hasExistingBackendKey ? 'existing-key-choice' : 'explanation',
                );
              }}
            >
              {t('Back')}
            </Button>
            <Button
              color="brand"
              fullWidth
              onClick={handleRestoreKeys}
              disabled={isPending || !restoreInput.trim()}
              icon={
                isPending ? (
                  <div>
                    <Spinner size="sm" />
                  </div>
                ) : undefined
              }
            >
              {t('Restore keys')}
            </Button>
          </>
        );
      case 'backup':
        return (
          <Button color="brand" fullWidth onClick={handleBackupDone}>
            {t('I have backed up my keys')}
          </Button>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'backup':
        return t('Back up your encryption keys');
      case 'restore':
        return t('Restore encryption keys');
      default:
        return t('Enable encryption');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      closeOnClickOutside={!isPending && step !== 'backup'}
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-encryption-onboarding-title"
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
            id="modal-encryption-onboarding-title"
            $margin="0"
            $align="flex-start"
          >
            {getTitle()}
          </Text>
          {step !== 'backup' && (
            <ButtonCloseModal
              aria-label={t('Close')}
              onClick={handleClose}
              disabled={isPending}
            />
          )}
        </Box>
      }
    >
      {getStepContent()}
    </Modal>
  );
};
