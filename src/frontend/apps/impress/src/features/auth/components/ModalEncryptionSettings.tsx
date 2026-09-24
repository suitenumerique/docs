/**
 * Encryption settings — delegates to the centralized encryption service.
 *
 * The service's settings interface (fingerprint, key deletion, device transfer,
 * emergency access) draws its own modal over the page; Docs only shows a loader
 * until it is on screen.
 */
import { Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserEncryption } from '@/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import { EncryptionHostBody } from './EncryptionHostBody';

interface ModalEncryptionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestReOnboard: () => void;
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

    const handleKeysDestroyed = () => {
      void refreshKeyState().then(() => refreshEncryption());
    };

    vaultClient.on('interface:ready', handleReady);
    vaultClient.on('interface:closed', handleClosed);
    vaultClient.on('keys-destroyed', handleKeysDestroyed);

    return () => {
      vaultClient.off('interface:ready', handleReady);
      vaultClient.off('interface:closed', handleClosed);
      vaultClient.off('keys-destroyed', handleKeysDestroyed);
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
