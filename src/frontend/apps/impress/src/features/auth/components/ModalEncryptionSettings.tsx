/**
 * Encryption settings, delegated to the centralized encryption service.
 *
 * Opens the interface's own encryption home (status, set up for a user with no
 * keys, fingerprint, devices, recovery phrase, trusted contacts), which draws
 * its own modal over the page; Docs only shows a loader until it is on screen.
 */
import { Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserEncryption } from '@/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { EncryptionHostBody } from './EncryptionHostBody';

interface ModalEncryptionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalEncryptionSettings = ({
  isOpen,
  onClose,
}: ModalEncryptionSettingsProps) => {
  const { t } = useTranslation();
  const { client: vaultClient, refreshKeyState } = useVaultClient();
  const { refreshEncryption } = useUserEncryption();
  const openedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isOpen || !vaultClient || openedRef.current) {
      return;
    }

    openedRef.current = true;
    vaultClient.openSettings();
  }, [isOpen, vaultClient]);

  useEffect(() => {
    if (!vaultClient) {
      return;
    }

    const handleReady = () => setReady(true);

    const handleClosed = () => {
      openedRef.current = false;
      setReady(false);
      void refreshKeyState().then(() => refreshEncryption());
      onClose();
    };

    // Keys created (set up from the home) or destroyed: the document page and
    // the encryption actions follow at once, without waiting for the close.
    const handleKeysChanged = () => {
      void refreshKeyState().then(() => refreshEncryption());
    };

    vaultClient.on('interface:ready', handleReady);
    vaultClient.on('interface:closed', handleClosed);
    vaultClient.on('onboarding:complete', handleKeysChanged);
    vaultClient.on('keys-destroyed', handleKeysChanged);

    return () => {
      vaultClient.off('interface:ready', handleReady);
      vaultClient.off('interface:closed', handleClosed);
      vaultClient.off('onboarding:complete', handleKeysChanged);
      vaultClient.off('keys-destroyed', handleKeysChanged);
    };
  }, [vaultClient, refreshKeyState, refreshEncryption, onClose]);

  // Closing the loader: nothing is at stake before the interface is on screen,
  // so the frame is torn down outright.
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
