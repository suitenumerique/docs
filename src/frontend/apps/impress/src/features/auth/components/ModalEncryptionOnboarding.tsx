/**
 * Encryption onboarding — delegates to the centralized encryption service.
 *
 * The service's interface handles everything (key generation, backup, restore,
 * device transfer, server registration) and draws its own modal over the page;
 * Docs only shows a loader until it is on screen. The product doesn't manage
 * public keys — it only stores fingerprints on document accesses for UI purposes.
 */
import { Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserEncryption } from '@/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { EncryptionHostBody } from './EncryptionHostBody';

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
  const { client: vaultClient, refreshKeyState } = useVaultClient();
  const { refreshEncryption } = useUserEncryption();
  const openedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Open once the SDK is there; the interface then draws its own modal.
  useEffect(() => {
    if (!isOpen || !vaultClient || openedRef.current) {
      return;
    }

    openedRef.current = true;
    vaultClient.openOnboarding();
  }, [isOpen, vaultClient]);

  useEffect(() => {
    if (!vaultClient) {
      return;
    }

    const handleReady = () => setReady(true);

    const handleComplete = async () => {
      // The encryption service registered the public key on its central server.
      // Docs doesn't need to store it — just refresh the vault key state.
      await refreshKeyState();
      refreshEncryption();
      onSuccess?.();
    };

    const handleClosed = () => {
      openedRef.current = false;
      setReady(false);
      onClose();
    };

    vaultClient.on('interface:ready', handleReady);
    vaultClient.on('onboarding:complete', handleComplete);
    vaultClient.on('interface:closed', handleClosed);

    return () => {
      vaultClient.off('interface:ready', handleReady);
      vaultClient.off('onboarding:complete', handleComplete);
      vaultClient.off('interface:closed', handleClosed);
    };
  }, [vaultClient, refreshKeyState, refreshEncryption, onSuccess, onClose]);

  // Closing the loader: nothing is at stake before the interface is on screen,
  // so the frame is torn down outright (the interface's own close control takes
  // over from there, with its confirmations).
  const handleClose = useCallback(() => {
    vaultClient?.closeInterface();
    openedRef.current = false;
    onClose();
  }, [vaultClient, onClose]);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      setReady(false);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen && !ready}
      closeOnClickOutside={false}
      onClose={handleClose}
      size={ModalSize.SMALL}
      aria-label={t('Encryption')}
    >
      <EncryptionHostBody onClose={handleClose} />
    </Modal>
  );
};
